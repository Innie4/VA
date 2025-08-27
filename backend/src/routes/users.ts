import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createValidationError,
  createNotFoundError,
  createForbiddenError,
  createConflictError,
} from '../middleware/errorHandler';
import {
  validate,
  userSchemas,
  commonSchemas,
} from '../middleware/validation';
import { sanitizeInput } from '../middleware/sanitization';
import {
  authenticate,
  authorize,
  requirePermission,
} from '../middleware/auth';
import {
  apiRateLimiter,
  strictRateLimiter,
} from '../middleware/rateLimiter';

const router = Router();

// Apply sanitization to all routes (authentication removed)
// router.use(authenticate);
router.use(sanitizeInput);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/profile',
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const user = await db.getClient().user.findUnique({
      where: { id: req.user!.id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
        preferences: true,
        _count: {
          select: {
            conversations: true,
            files: true,
          },
        },
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
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               timezone:
 *                 type: string
 *               language:
 *                 type: string
 *                 enum: [en, es, fr, de, it, pt, ru, zh, ja, ko]
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/profile',
  apiRateLimiter,
  validate({ body: userSchemas.updateProfile }),
  asyncHandler(async (req: Request, res: Response) => {
    const { firstName, lastName, bio, timezone, language } = req.body;

    const user = await db.getClient().user.update({
      where: { id: req.user!.id },
      data: {
        firstName,
        lastName,
        bio,
        timezone,
        language,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            permissions: true,
          },
        },
        preferences: true,
      },
    });

    // Log profile update
    logger.info('User profile updated', {
      userId: req.user!.id,
      email: req.user!.email,
      changes: { firstName, lastName, bio, timezone, language },
      ip: req.ip,
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'USER_PROFILE_UPDATE',
        resource: 'user',
        resourceId: req.user!.id,
        userId: req.user!.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        newValues: JSON.stringify({ firstName, lastName, bio, timezone, language }),
      },
    });

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: userWithoutPassword,
      },
    });
  })
);

/**
 * @swagger
 * /api/users/preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/preferences',
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const preferences = await db.getClient().userPreferences.findUnique({
      where: { userId: req.user!.id },
    });

    if (!preferences) {
      // Create default preferences if they don't exist
      const newPreferences = await db.getClient().userPreferences.create({
        data: {
          userId: req.user!.id,
        },
      });

      return res.json({
        success: true,
        data: {
          preferences: newPreferences,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        preferences,
      },
    });
  })
);

/**
 * @swagger
 * /api/users/preferences:
 *   put:
 *     summary: Update user preferences
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark, auto]
 *               language:
 *                 type: string
 *                 enum: [en, es, fr, de, it, pt, ru, zh, ja, ko]
 *               emailNotifications:
 *                 type: boolean
 *               pushNotifications:
 *                 type: boolean
 *               soundEnabled:
 *                 type: boolean
 *               autoSave:
 *                 type: boolean
 *               compactMode:
 *                 type: boolean
 *               showTimestamps:
 *                 type: boolean
 *               fontSize:
 *                 type: string
 *                 enum: [small, medium, large]
 *               codeTheme:
 *                 type: string
 *                 enum: [github, monokai, solarized, dracula]
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/preferences',
  apiRateLimiter,
  validate({ body: userSchemas.updatePreferences }),
  asyncHandler(async (req: Request, res: Response) => {
    const updateData = req.body;

    const preferences = await db.getClient().userPreferences.upsert({
      where: { userId: req.user!.id },
      update: updateData,
      create: {
        userId: req.user!.id,
        ...updateData,
      },
    });

    // Cache preferences in Redis for faster access
    await redis.setJSON(
      `user:${req.user!.id}:preferences`,
      preferences,
      3600 // 1 hour
    );

    // Log preferences update
    logger.info('User preferences updated', {
      userId: req.user!.id,
      email: req.user!.email,
      changes: updateData,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences,
      },
    });
  })
);

/**
 * @swagger
 * /api/users/sessions:
 *   get:
 *     summary: Get user's active sessions
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/sessions',
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const sessions = await db.getClient().session.findMany({
      where: {
        userId: req.user!.id,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        sessionToken: true,
        deviceInfo: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Mark current session
    const currentSessionToken = req.cookies?.sessionToken;
    const sessionsWithCurrent = sessions.map((session: any) => ({
      ...session,
      isCurrent: session.sessionToken === currentSessionToken,
    }));

    res.json({
      success: true,
      data: {
        sessions: sessionsWithCurrent,
      },
    });
  })
);

/**
 * @swagger
 * /api/users/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked successfully
 *       404:
 *         description: Session not found
 *       403:
 *         description: Access denied
 */
router.delete(
  '/sessions/:sessionId',
  apiRateLimiter,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const session = await db.getClient().session.findFirst({
      where: {
        id: sessionId,
        userId: req.user!.id,
        isActive: true,
      },
    });

    if (!session) {
      throw createNotFoundError('Session not found');
    }

    // Deactivate session
    await db.getClient().session.update({
      where: { id: sessionId },
      data: {
        isActive: false,
      },
    });

    // Remove from Redis
    await redis.destroySession(session.sessionToken);

    // Log session revocation
    logger.info('Session revoked', {
      userId: req.user!.id,
      sessionId,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  })
);

/**
 * @swagger
 * /api/users/sessions:
 *   delete:
 *     summary: Revoke all sessions except current
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All other sessions revoked successfully
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/sessions',
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const currentSessionToken = req.cookies?.sessionToken;

    // Get all sessions to revoke
    const sessions = await db.getClient().session.findMany({
      where: {
        userId: req.user!.id,
        isActive: true,
        sessionToken: {
          not: currentSessionToken,
        },
      },
      select: {
        id: true,
        sessionToken: true,
      },
    });

    // Deactivate all other sessions
    await db.getClient().session.updateMany({
      where: {
        userId: req.user!.id,
        isActive: true,
        sessionToken: {
          not: currentSessionToken,
        },
      },
      data: {
        isActive: false,
      },
    });

    // Remove from Redis
    for (const session of sessions) {
      await redis.destroySession(session.sessionToken);
    }

    // Log bulk session revocation
    logger.info('All other sessions revoked', {
      userId: req.user!.id,
      revokedCount: sessions.length,
      ip: req.ip,
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'SESSIONS_REVOKED',
        resource: 'user',
        resourceId: req.user!.id,
        userId: req.user!.id,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        metadata: JSON.stringify({
          revokedCount: sessions.length,
        }),
      },
    });

    res.json({
      success: true,
      message: `${sessions.length} sessions revoked successfully`,
    });
  })
);

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/stats',
  apiRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Check cache first
    const cacheKey = `user:${userId}:stats`;
    const cachedStats = await redis.getJSON(cacheKey);

    if (cachedStats) {
      return res.json({
        success: true,
        data: {
          stats: cachedStats,
          cached: true,
        },
      });
    }

    // Calculate statistics
    const [conversationStats, messageStats, fileStats, user] = await Promise.all([
      db.getClient().conversation.aggregate({
        where: { userId },
        _count: { id: true },
      }),
      db.getClient().message.groupBy({
        by: ['role'],
        where: {
          conversation: { userId },
        },
        _count: { id: true },
      }),
      db.getClient().file.aggregate({
        where: { userId },
        _count: { id: true },
        _sum: { size: true },
      }),
      db.getClient().user.findUnique({
        where: { id: userId },
        select: {
          createdAt: true,
          lastLoginAt: true,
          tier: true,
        },
      }),
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await db.getClient().message.groupBy({
      by: ['createdAt'],
      where: {
        conversation: { userId },
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _count: { id: true },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const stats = {
      conversations: {
        total: conversationStats._count.id || 0,
        totalMessages: messageStats.reduce((sum: any, stat: any) => sum + stat._count.id, 0),
      },
      messages: {
        byRole: messageStats.reduce((acc: any, stat: any) => {
          acc[stat.role] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
        total: messageStats.reduce((sum: any, stat: any) => sum + stat._count.id, 0),
      },
      files: {
        total: fileStats._count.id || 0,
        totalSize: fileStats._sum?.size || 0,
      },
      account: {
        tier: user?.tier || 'free',
        memberSince: user?.createdAt,
        lastLogin: user?.lastLoginAt,
      },
      activity: {
        last30Days: recentActivity.map((activity: any) => ({
          date: activity.createdAt,
          count: activity._count.id,
        })),
      },
    };

    // Cache for 5 minutes
    await redis.setJSON(cacheKey, stats, 300);

    return res.json({
      success: true,
      data: {
        stats,
        cached: false,
      },
    });
  })
);

/**
 * @swagger
 * /api/users/export:
 *   post:
 *     summary: Request user data export
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data export initiated successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/export',
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Check if there's already a recent export request
    const recentExport = await redis.get(`user:${userId}:export:request`);
    if (recentExport) {
      throw createValidationError('Export request already in progress. Please wait before requesting another export.');
    }

    // Mark export as requested
    await redis.set(`user:${userId}:export:request`, 'pending', 3600); // 1 hour

    // Log export request
    logger.info('Data export requested', {
      userId,
      email: req.user!.email,
      ip: req.ip,
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'DATA_EXPORT_REQUEST',
        resource: 'user',
        resourceId: userId,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      },
    });

    // TODO: Implement actual data export logic
    // This would typically involve:
    // 1. Queuing a background job
    // 2. Collecting all user data
    // 3. Creating a downloadable archive
    // 4. Sending an email with download link

    res.json({
      success: true,
      message: 'Data export request submitted. You will receive an email when your export is ready.',
    });
  })
);

/**
 * @swagger
 * /api/users/delete-account:
 *   post:
 *     summary: Request account deletion
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - confirmDeletion
 *             properties:
 *               password:
 *                 type: string
 *               confirmDeletion:
 *                 type: string
 *                 enum: [DELETE_MY_ACCOUNT]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Account deletion initiated successfully
 *       400:
 *         description: Invalid password or confirmation
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/delete-account',
  strictRateLimiter,
  validate({ body: userSchemas.deleteAccount }),
  asyncHandler(async (req: Request, res: Response) => {
    const { password, confirmDeletion, reason } = req.body;
    const userId = req.user!.id;

    if (confirmDeletion !== 'DELETE_MY_ACCOUNT') {
      throw createValidationError('Please type "DELETE_MY_ACCOUNT" to confirm account deletion');
    }

    // Verify password
    const user = await db.getClient().user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw createNotFoundError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createValidationError('Invalid password');
    }

    // Check if there's already a deletion request
    const existingRequest = await redis.get(`user:${userId}:deletion:request`);
    if (existingRequest) {
      throw createValidationError('Account deletion already in progress.');
    }

    // Mark account for deletion (30-day grace period)
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    await redis.setJSON(`user:${userId}:deletion:request`, {
      requestedAt: new Date(),
      scheduledFor: deletionDate,
      reason,
    }, 30 * 24 * 60 * 60); // 30 days

    // Deactivate account immediately
    await db.getClient().user.update({
      where: { id: userId },
      data: {
        isActive: false,
      },
    });

    // Invalidate all sessions
    await db.getClient().session.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    // Log account deletion request
    logger.warn('Account deletion requested', {
      userId,
      email: user.email,
      reason,
      scheduledFor: deletionDate,
      ip: req.ip,
    });

    // Create audit log
    await db.getClient().auditLog.create({
      data: {
        action: 'ACCOUNT_DELETION_REQUEST',
        resource: 'user',
        resourceId: userId,
        userId,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        metadata: JSON.stringify({
          reason,
          scheduledFor: deletionDate,
        }),
      },
    });

    res.json({
      success: true,
      message: 'Account deletion initiated. Your account will be permanently deleted in 30 days. Contact support if you change your mind.',
      data: {
        scheduledDeletionDate: deletionDate,
      },
    });
  })
);

export default router;