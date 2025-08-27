import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createValidationError,
  createAuthError,
  createNotFoundError,
  createConflictError,
  AppError,
} from '../middleware/errorHandler';
import { validate } from '../middleware/validation';
import * as AuthSchemas from '../schemas/authJoi';
import {
  authenticate,
  optionalAuthenticate,
  generateTokens,
  verifyRefreshToken,
  authorize,
  requireEmailVerification,
  adminOnly,
  moderatorOrAdmin,
} from '../middleware/auth';
import { sanitizeInput } from '../middleware/sanitization';
import {
  authRateLimiter,
  passwordResetRateLimiter,
  strictRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

// Apply sanitization to all routes
router.use(sanitizeInput);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - confirmPassword
 *               - firstName
 *               - lastName
 *               - acceptTerms
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               acceptTerms:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post(
  '/register',
  authRateLimiter,
  validate(AuthSchemas.registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await db.getClient().user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw createConflictError('User with this email already exists');
    }

    // Get default user role
    const userRole = await db.getClient().role.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      throw new AppError('Default user role not found', 500);
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await db.getClient().user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        roleId: userRole.id,
      },
      include: {
        role: true,
        preferences: true,
      },
    });

    // Create default user preferences
    await db.getClient().userPreferences.create({
      data: {
        userId: user.id,
      },
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.getClient().emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        email: user.email,
        expiresAt: verificationExpiry,
      },
    });

    // Log registration
    logger.info('User registered', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'USER_REGISTER',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        newValues: JSON.stringify({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }),
      },
    });

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: userWithoutPassword,
        verificationRequired: true,
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account disabled or email not verified
 */
router.post(
  '/login',
  authRateLimiter,
  validate(AuthSchemas.loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password, rememberMe = false } = req.body;

    // Find user with role and preferences
    const user = await db.getClient().user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        role: true,
        preferences: true,
      },
    });

    if (!user) {
      throw createAuthError('Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw createAuthError('Account has been disabled');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Log failed login attempt
      logger.warn('Failed login attempt', {
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw createAuthError('Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role.name,
      tier: user.tier,
      isEmailVerified: user.isEmailVerified,
      permissions: user.role.permissions.split(',').map(p => p.trim()),
    });

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
    ); // 30 days if remember me, otherwise 1 day

    await db.getClient().session.create({
      data: {
        userId: user.id,
        sessionToken,
        refreshToken,
        deviceInfo: JSON.stringify({
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        }),
        ipAddress: req.ip,
        expiresAt,
      },
    });

    // Update last login
    await db.getClient().user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    // Store session in Redis
    await redis.createSession(sessionToken, {
      userId: user.id,
      email: user.email,
      role: user.role.name,
      tier: user.tier,
    }, rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60);

    // Log successful login
    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      rememberMe,
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'USER_LOGIN',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: JSON.stringify({ rememberMe }),
      },
    });

    // Set HTTP-only cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    };

    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie('sessionToken', sessionToken, cookieOptions);

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        tokens: {
          accessToken,
          refreshToken,
          sessionToken,
        },
        expiresAt,
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const sessionToken = req.cookies?.sessionToken;
    const refreshToken = req.cookies?.refreshToken;

    if (sessionToken) {
      // Remove session from database
      await db.getClient().session.updateMany({
        where: {
          userId: req.user!.id,
          sessionToken,
        },
        data: {
          isActive: false,
        },
      });

      // Remove session from Redis
      await redis.destroySession(sessionToken);
    }

    if (refreshToken) {
      // Invalidate refresh token
      await db.getClient().session.updateMany({
        where: {
          userId: req.user!.id,
          refreshToken,
        },
        data: {
          isActive: false,
        },
      });
    }

    // Log logout
    logger.info('User logged out', {
      userId: req.user!.id,
      email: req.user!.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'USER_LOGOUT',
        resource: 'user',
        resourceId: req.user!.id,
        userId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.clearCookie('sessionToken');

    res.json({
      success: true,
      message: 'Logout successful',
    });
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

    if (!refreshToken) {
      throw createAuthError('Refresh token is required');
    }

    try {
      // Verify refresh token
      const decoded = await verifyRefreshToken(refreshToken);

      // Check if session exists and is active
      const session = await db.getClient().session.findFirst({
        where: {
          refreshToken,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!session || !session.user.isActive) {
        throw createAuthError('Invalid or expired refresh token');
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens({
        id: session.user.id,
        email: session.user.email,
        role: session.user.role.name,
        tier: session.user.tier,
        isEmailVerified: session.user.isEmailVerified,
        permissions: session.user.role.permissions.split(',').map(p => p.trim()),
      });

      // Update session with new refresh token
      await db.getClient().session.update({
        where: { id: session.id },
        data: {
          refreshToken: newRefreshToken,
        },
      });

      // Update last active time
      await db.getClient().user.update({
        where: { id: session.user.id },
        data: {
          lastActiveAt: new Date(),
        },
      });

      // Log token refresh
      logger.info('Token refreshed', {
        userId: session.user.id,
        email: session.user.email,
        ip: req.ip,
      });

      // Set new cookies
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict' as const,
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      };

      res.cookie('accessToken', accessToken, cookieOptions);
      res.cookie('refreshToken', newRefreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (error) {
      // Invalidate the refresh token
      await db.getClient().session.updateMany({
        where: { refreshToken },
        data: { isActive: false },
      });

      throw createAuthError('Invalid or expired refresh token');
    }
  })
);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate(AuthSchemas.forgotPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    const user = await db.getClient().user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      logger.warn('Password reset requested for non-existent email', {
        email,
        ip: req.ip,
      });

      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate existing reset tokens
    await db.getClient().passwordReset.updateMany({
      where: {
        userId: user.id,
        isUsed: false,
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Create new reset token
    await db.getClient().passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: resetExpiry,
      },
    });

    // Log password reset request
    logger.info('Password reset requested', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'PASSWORD_RESET_REQUEST',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    // TODO: Send email with reset link
    // In a real application, you would send an email here
    logger.info('Password reset email would be sent', {
      userId: user.id,
      email: user.email,
      resetToken,
    });

    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/reset-password',
  strictRateLimiter,
  validate(AuthSchemas.resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;

    // Find valid reset token
    const resetRecord = await db.getClient().passwordReset.findFirst({
      where: {
        token,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!resetRecord) {
      throw createValidationError('Invalid or expired reset token');
    }

    // Check if account is active
    if (!resetRecord.user.isActive) {
      throw createValidationError('Account has been disabled');
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update password and mark token as used
    await db.getClient().$transaction([
      db.getClient().user.update({
        where: { id: resetRecord.user.id },
        data: {
          password: hashedPassword,
        },
      }),
      db.getClient().passwordReset.update({
        where: { id: resetRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      }),
      // Invalidate all active sessions
      db.getClient().session.updateMany({
        where: {
          userId: resetRecord.user.id,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      }),
    ]);

    // Remove all sessions from Redis
    const sessions = await db.getClient().session.findMany({
      where: { userId: resetRecord.user.id },
      select: { sessionToken: true },
    });

    for (const session of sessions) {
      await redis.destroySession(session.sessionToken);
    }

    // Log password reset
    logger.info('Password reset completed', {
      userId: resetRecord.user.id,
      email: resetRecord.user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'PASSWORD_RESET_COMPLETE',
        resource: 'user',
        resourceId: resetRecord.user.id,
        userId: resetRecord.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.json({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });
  })
);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/verify-email',
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
      throw createValidationError('Verification token is required');
    }

    // Find valid verification token
    const verificationRecord = await db.getClient().emailVerification.findFirst({
      where: {
        token,
        isUsed: false,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!verificationRecord) {
      throw createValidationError('Invalid or expired verification token');
    }

    // Update user and mark token as used
    await db.getClient().$transaction([
      db.getClient().user.update({
        where: { id: verificationRecord.user.id },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      db.getClient().emailVerification.update({
        where: { id: verificationRecord.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      }),
    ]);

    // Log email verification
    logger.info('Email verified', {
      userId: verificationRecord.user.id,
      email: verificationRecord.user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'EMAIL_VERIFIED',
        resource: 'user',
        resourceId: verificationRecord.user.id,
        userId: verificationRecord.user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await db.getClient().user.findUnique({
      where: { id: req.user!.id },
      include: {
        role: true,
        preferences: true,
      },
    });

    if (!user) {
      throw createNotFoundError('User not found');
    }

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword,
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/change-password',
  authenticate,
  strictRateLimiter,
  validate(AuthSchemas.changePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    const user = await db.getClient().user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      throw createNotFoundError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw createValidationError('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.getClient().user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
    });

    // Invalidate all other sessions except current
    const currentSessionToken = req.cookies?.sessionToken;
    await db.getClient().session.updateMany({
      where: {
        userId: user.id,
        isActive: true,
        sessionToken: {
          not: currentSessionToken,
        },
      },
      data: {
        isActive: false,
      },
    });

    // Log password change
    logger.info('Password changed', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'PASSWORD_CHANGE',
        resource: 'user',
        resourceId: user.id,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

export default router;