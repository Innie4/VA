import { Request, Response } from 'express';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger as authLogger } from '../utils/logger';
import { config as authConfig } from '../config/config';
import { getRedisClient } from '../utils/redis';
import { sendEmail } from '../utils/email';
import { generateTokens, verifyRefreshToken } from '../middleware/auth';
import * as crypto from 'crypto';
import * as AuthSchemas from '../schemas/authJoi';
import { db as authDb } from '../config/database';

const redisClient = getRedisClient();

// Register new user
const register = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { email, password, firstName, lastName, bio } = req.body;

    // Check if user already exists
    const existingUser = await authDb.getClient().user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Get default user role
    const userRole = await authDb.getClient().role.findUnique({
      where: { name: 'user' },
    });

    if (!userRole) {
      authLogger.error('Default user role not found');
      return res.status(500).json({
        success: false,
        message: 'System configuration error',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, authConfig.security.bcryptRounds);

    // Create user
    const user = await authDb.getClient().user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        bio: bio || null,
        roleId: userRole.id,
        isActive: true,
        isEmailVerified: false,
      },
      include: {
        role: true,
      },
    });

    // Create user preferences
    await authDb.getClient().userPreferences.create({
      data: {
        userId: user.id,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        emailNotifications: true,
        pushNotifications: true,
        desktopNotifications: true,
        autoSave: true,
        showTypingIndicator: true,
        soundEnabled: true,
        defaultModel: 'gpt-4',
        defaultTemperature: 0.7,
        defaultMaxTokens: 1024,
      },
    });

    // Create user statistics
    await authDb.getClient().userStatistics.create({
      data: {
        userId: user.id,
        totalMessages: 0,
        totalFiles: 0,
      },
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await authDb.getClient().emailVerification.create({
      data: {
        userId: user.id,
        email: user.email,
        token: verificationToken,
        expiresAt: verificationExpiry,
      },
    });

    // Send verification email (in production)
    if (authConfig.NODE_ENV === 'production') {
      try {
        await sendEmail({
          to: user.email,
          subject: 'Verify your email address',
          template: 'email-verification',
          data: {
            firstName: user.firstName,
            verificationUrl: `${authConfig.cors.origin}/verify-email?token=${verificationToken}`,
          },
        });
      } catch (emailError) {
        authLogger.error('Failed to send verification email:', emailError);
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role.name,
      isEmailVerified: user.isEmailVerified,
    });

    // Store refresh token in Redis
    if (redisClient) {
      await redisClient.setex(`refresh_token:${user.id}`, parseInt(authConfig.jwt.refreshExpiry) * 24 * 60 * 60, refreshToken);
    }

    // Update last login
    await authDb.getClient().user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    authLogger.info(`User registered successfully: ${user.email}`);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          avatar: user.avatar,
          tier: user.tier,
          isEmailVerified: user.isEmailVerified,
          role: user.role.name,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    authLogger.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};



// Login user
const login = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { email, password } = req.body;

    // Find user with role
    const user = await authDb.getClient().user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role.name,
      isEmailVerified: user.isEmailVerified,
    });

    // Store refresh token in Redis
    if (redisClient) {
      await redisClient.setex(`refresh_token:${user.id}`, parseInt(authConfig.jwt.refreshExpiry) * 24 * 60 * 60, refreshToken);
    }

    // Update last login and statistics
    await Promise.all([
      authDb.getClient().user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        },
      }),
      authDb.getClient().userStatistics.update({
        where: { userId: user.id },
        data: {
          lastActiveAt: new Date(),
        },
      }),
    ]);

    authLogger.info(`User logged in successfully: ${user.email}`);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          avatar: user.avatar,
          tier: user.tier,
          isEmailVerified: user.isEmailVerified,
          role: user.role.name,
          lastLoginAt: user.lastLoginAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    authLogger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Refresh access token
const refreshToken = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Check if token exists in Redis
    const storedToken = redisClient ? await redisClient.get(`refresh_token:${(await decoded).id}`) : null;
    if (!storedToken || storedToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Get user with role
    const user = await authDb.getClient().user.findUnique({
      where: { id: (await decoded).id },
      include: {
        role: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens({
      id: user.id,
      email: user.email,
      role: user.role.name,
      isEmailVerified: user.isEmailVerified,
    });

    // Update refresh token in Redis
    if (redisClient) {
      await redisClient.setex(`refresh_token:${user.id}`, parseInt(authConfig.jwt.refreshExpiry) * 24 * 60 * 60, newRefreshToken);
    }

    // Update last active
    await authDb.getClient().user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    authLogger.error('Token refresh error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
};

// Logout user
const logout = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      // Remove refresh token from Redis
      if (redisClient) {
        await redisClient.del(`refresh_token:${userId}`);
      }
      
      // Update last active
       await authDb.getClient().user.update({
        where: { id: userId },
        data: {
          lastActiveAt: new Date(),
        },
      });

      authLogger.info(`User logged out: ${req.user?.email}`);
    }

    return res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    authLogger.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get current user profile
const getProfile = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = req.user?.id;

    const user = await authDb.getClient().user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        preferences: true,
        statistics: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          bio: user.bio,
          avatar: user.avatar,
          tier: user.tier,
          isEmailVerified: user.isEmailVerified,
          role: user.role.name,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          preferences: user.preferences,
          statistics: user.statistics,
        },
      },
    });
  } catch (error) {
    authLogger.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Forgot password
const forgotPassword = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { email } = req.body;

    const user = await authDb.getClient().user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this user
    await authDb.getClient().passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Create new reset token
    await authDb.getClient().passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: resetExpiry,
      },
    });

    // Send reset email (in production)
    if (authConfig.NODE_ENV === 'production') {
      try {
        await sendEmail({
          to: user.email,
          subject: 'Password Reset Request',
          template: 'password-reset',
          data: {
            firstName: user.firstName,
            resetUrl: `${authConfig.cors.origin}/reset-password?token=${resetToken}`,
          },
        });
      } catch (emailError) {
        authLogger.error('Failed to send password reset email:', emailError);
      }
    }

    authLogger.info(`Password reset requested for: ${user.email}`);

    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    authLogger.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Reset password
const resetPassword = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { token, password } = req.body;

    // Find valid reset token
    const resetRecord = await authDb.getClient().passwordReset.findFirst({
      where: {
        token,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, authConfig.security.bcryptRounds);

    // Update user password
    await authDb.getClient().user.update({
      where: { id: resetRecord.userId },
      data: {
        password: hashedPassword,
        lastActiveAt: new Date(),
      },
    });

    // Delete reset token
    await authDb.getClient().passwordReset.delete({
      where: { id: resetRecord.id },
    });

    // Invalidate all refresh tokens for this user
    if (redisClient) {
      await redisClient.del(`refresh_token:${resetRecord.userId}`);
    }

    authLogger.info(`Password reset successful for: ${resetRecord.user.email}`);

    return res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    authLogger.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Change password (authenticated)
const changePassword = async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    const user = await authDb.getClient().user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, authConfig.security.bcryptRounds);

    // Update password
    await authDb.getClient().user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        lastActiveAt: new Date(),
      },
    });

    // Invalidate all refresh tokens for this user
    if (redisClient) {
      await redisClient.del(`refresh_token:${userId}`);
    }

    authLogger.info(`Password changed for: ${user.email}`);

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    authLogger.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
};