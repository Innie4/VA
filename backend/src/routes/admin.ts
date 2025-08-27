import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { db as adminDb } from '../config/database';
import { redis } from '../config/redis';
import { logger as adminLogger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createValidationError,
  createNotFoundError,
  createForbiddenError,
  createConflictError,
} from '../middleware/errorHandler';
import {
  validate,
  adminSchemas,
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

// Apply sanitization to all routes (authentication and authorization removed)
// router.use(authenticate);
// router.use(authorize('admin', 'moderator'));
router.use(sanitizeInput);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/dashboard',
  apiRateLimiter,
  // requirePermission('admin:read'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    // Check cache first
    const cacheKey = 'admin:dashboard:stats';
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
    const [userStats, conversationStats, messageStats, fileStats, systemStats] = await Promise.all([
      // User statistics
      adminDb.getClient().user.groupBy({
        by: ['tier', 'isActive'],
        _count: { id: true },
      }),
      // Conversation statistics
      adminDb.getClient().conversation.aggregate({
        _count: { id: true },
      }),
      // Message statistics by role
      adminDb.getClient().message.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      // File statistics
      adminDb.getClient().file.aggregate({
        _count: { id: true },
        _sum: { size: true },
      }),
      // System statistics
      Promise.all([
        adminDb.getClient().session.count({
          where: {
            isActive: true,
            expiresAt: { gt: new Date() },
          },
        }),
        adminDb.getClient().auditLog.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
      ]),
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivity = await adminDb.getClient().user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      _count: { id: true },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const stats = {
      users: {
        total: userStats.reduce((sum: number, stat: any) => sum + stat._count.id, 0),
        active: userStats
          .filter((stat: any) => stat.isActive)
          .reduce((sum: number, stat: any) => sum + stat._count.id, 0),
        byTier: userStats.reduce((acc: Record<string, number>, stat: any) => {
          if (!acc[stat.tier]) acc[stat.tier] = 0;
          acc[stat.tier] += stat._count.id;
          return acc;
        }, {} as Record<string, number>),
      },
      conversations: {
        total: conversationStats._count.id || 0,
        totalMessages: messageStats.reduce((sum: number, stat: any) => sum + stat._count.id, 0),
      },
      messages: {
        byRole: messageStats.reduce((acc: Record<string, number>, stat: any) => {
          acc[stat.role] = stat._count.id;
          return acc;
        }, {} as Record<string, number>),
        total: messageStats.reduce((sum: number, stat: any) => sum + stat._count.id, 0),
      },
      files: {
        total: fileStats._count.id || 0,
        totalSize: fileStats._sum?.size || 0,
      },
      system: {
        activeSessions: systemStats[0],
        recentAuditLogs: systemStats[1],
      },
      activity: {
        last7Days: recentActivity.map((activity: any) => ({
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
 * /api/admin/users:
 *   get:
 *     summary: Get all users with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [free, premium]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/users',
  apiRateLimiter,
  // requirePermission('admin:users:read'), // Removed authentication
  validate({ query: adminSchemas.getUsers }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search, tier, isActive } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        {
          email: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (tier) {
      where.tier = tier;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [users, total] = await Promise.all([
      adminDb.getClient().user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          tier: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          lastLoginAt: true,
          lastActiveAt: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              conversations: true,
              files: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: Number(limit),
      }),
      adminDb.getClient().user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/users/:id',
  apiRateLimiter,
  // requirePermission('admin:users:read'), // Removed authentication
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await adminDb.getClient().user.findUnique({
      where: { id },
      include: {
        role: true,
        preferences: true,
        sessions: {
          where: {
            isActive: true,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            deviceInfo: true,
            ipAddress: true,
            createdAt: true,
            lastAccessedAt: true,
          },
        },
        _count: {
          select: {
            conversations: true,
            files: true,
            auditLogs: true,
          },
        },
      },
    });

    if (!user) {
      throw createNotFoundError('User not found');
    }

    // Get recent audit logs
    const recentAuditLogs = await adminDb.getClient().auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        resource: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: {
          ...userWithoutPassword,
          recentAuditLogs,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [free, premium]
 *               isActive:
 *                 type: boolean
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put(
  '/users/:id',
  apiRateLimiter,
  // requirePermission('admin:users:write'), // Removed authentication
  validate({ 
    params: commonSchemas.id,
    body: adminSchemas.updateUser,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { tier, isActive, roleId } = req.body;

    // Check if user exists
    const existingUser = await adminDb.getClient().user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!existingUser) {
      throw createNotFoundError('User not found');
    }

    // Prevent modifying super admin
    if (existingUser.role.name === 'super_admin' && req.user!.role !== 'super_admin') {
      throw createForbiddenError('Cannot modify super admin user');
    }

    // Validate role if provided
    if (roleId) {
      const role = await adminDb.getClient().role.findUnique({ where: { id: roleId } });
      if (!role) {
        throw createValidationError('Invalid role ID');
      }

      // Prevent non-super-admin from assigning admin roles
      if (role.name === 'super_admin' && req.user!.role !== 'super_admin') {
        throw createForbiddenError('Cannot assign super admin role');
      }
    }

    const updateData: any = {};
    if (tier !== undefined) updateData.tier = tier;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (roleId !== undefined) updateData.roleId = roleId;

    // If deactivating user, invalidate all sessions
    if (isActive === false) {
      await adminDb.getClient().session.updateMany({
        where: { userId: id },
        data: { isActive: false },
      });

      // Remove from Redis
      const sessions = await adminDb.getClient().session.findMany({
        where: { userId: id },
        select: { sessionToken: true },
      });

      for (const session of sessions) {
        await redis.destroySession(session.sessionToken);
      }
    }

    const user = await adminDb.getClient().user.update({
      where: { id },
      data: updateData,
      include: {
        role: true,
        _count: {
          select: {
            conversations: true,
            files: true,
          },
        },
      },
    });

    // Log admin action
    adminLogger.info('User updated by admin', {
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      targetUserId: id,
      targetUserEmail: user.email,
      changes: updateData,
      ip: req.ip,
    });

    // Create audit log
    await adminDb.getClient().auditLog.create({
      data: {
        action: 'ADMIN_USER_UPDATE',
        resource: 'user',
        resourceId: id,
        userId: req.user!.id,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        oldValues: JSON.stringify({
          tier: existingUser.tier,
          isActive: existingUser.isActive,
          roleId: existingUser.roleId,
        }),
        newValues: JSON.stringify(updateData),
      },
    });

    // Remove sensitive data
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: userWithoutPassword,
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/users/{id}/sessions:
 *   delete:
 *     summary: Revoke all user sessions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All user sessions revoked successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  '/users/:id/sessions',
  strictRateLimiter,
  // requirePermission('admin:users:write'), // Removed authentication
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await adminDb.getClient().user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!user) {
      throw createNotFoundError('User not found');
    }

    // Get all active sessions
    const sessions = await adminDb.getClient().session.findMany({
      where: {
        userId: id,
        isActive: true,
      },
      select: {
        id: true,
        sessionToken: true,
      },
    });

    // Deactivate all sessions
    await adminDb.getClient().session.updateMany({
      where: {
        userId: id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Remove from Redis
    for (const session of sessions) {
      await redis.destroySession(session.sessionToken);
    }

    // Log admin action
    adminLogger.info('User sessions revoked by admin', {
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      targetUserId: id,
      targetUserEmail: user.email,
      revokedCount: sessions.length,
      ip: req.ip,
    });

    // Create audit log
    await adminDb.getClient().auditLog.create({
      data: {
        action: 'ADMIN_REVOKE_USER_SESSIONS',
        resource: 'user',
        resourceId: id,
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
      message: `${sessions.length} session(s) revoked successfully`,
    });
  })
);

/**
 * @swagger
 * /api/admin/system/settings:
 *   get:
 *     summary: Get system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System settings retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/system/settings',
  apiRateLimiter,
  // requirePermission('admin:system:read'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await adminDb.getClient().systemSetting.findMany({
      orderBy: {
        key: 'asc',
      },
    });

    const settingsMap = settings.reduce((acc: any, setting: any) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updatedAt,
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({
      success: true,
      data: {
        settings: settingsMap,
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/system/settings:
 *   put:
 *     summary: Update system settings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *     responses:
 *       200:
 *         description: System settings updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.put(
  '/system/settings',
  strictRateLimiter,
  // requirePermission('admin:system:write'), // Removed authentication
  validate({ body: adminSchemas.updateSystemSettings }),
  asyncHandler(async (req: Request, res: Response) => {
    const { settings } = req.body;

    const updatedSettings = [];
    for (const [key, value] of Object.entries(settings)) {
      const setting = await adminDb.getClient().systemSetting.upsert({
        where: { key },
        update: {
          value: value as string,
        },
        create: {
          key,
          value: value as string,
        },
      });
      updatedSettings.push(setting);
    }

    // Log admin action
    adminLogger.info('System settings updated by admin', {
      adminId: req.user!.id,
      adminEmail: req.user!.email,
      updatedSettings: Object.keys(settings),
      ip: req.ip,
    });

    // Create audit log
    await adminDb.getClient().auditLog.create({
      data: {
        action: 'ADMIN_UPDATE_SYSTEM_SETTINGS',
        resource: 'system',
        resourceId: 'settings',
        userId: req.user!.id,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        newValues: JSON.stringify(settings),
      },
    });

    res.json({
      success: true,
      message: 'System settings updated successfully',
      data: {
        updatedSettings,
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/audit-logs',
  apiRateLimiter,
  // requirePermission('admin:audit:read'), // Removed authentication
  validate({ query: adminSchemas.getAuditLogs }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 50, action, resource, userId } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (action) {
      where.action = {
        contains: action as string,
        mode: 'insensitive',
      };
    }

    if (resource) {
      where.resource = resource;
    }

    if (userId) {
      where.userId = userId;
    }

    const [auditLogs, total] = await Promise.all([
      adminDb.getClient().auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: Number(limit),
      }),
      adminDb.getClient().auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        auditLogs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/admin/analytics:
 *   get:
 *     summary: Get system analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: week
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/analytics',
  apiRateLimiter,
  // requirePermission('admin:analytics:read'), // Removed authentication
  validate({ query: adminSchemas.getAnalytics }),
  asyncHandler(async (req: Request, res: Response) => {
    const { period = 'week' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    const [userGrowth, messageActivity, fileUploads, errorLogs] = await Promise.all([
      // User registration growth
      adminDb.getClient().user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: { id: true },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      // Message activity
      adminDb.getClient().message.groupBy({
        by: ['createdAt', 'role'],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: { id: true },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      // File upload activity
      adminDb.getClient().file.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        _count: { id: true },
        _sum: { size: true },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      // Error logs from audit
      adminDb.getClient().auditLog.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: startDate,
          },
          action: {
            contains: 'ERROR',
          },
        },
        _count: { id: true },
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    const analytics = {
      period,
      startDate,
      endDate: now,
      userGrowth: userGrowth.map((item: any) => ({
        date: item.createdAt,
        count: item._count.id,
      })),
      messageActivity: messageActivity.map((item: any) => ({
        date: item.createdAt,
        role: item.role,
        count: item._count.id,
      })),
      fileUploads: fileUploads.map((item: any) => ({
        date: item.createdAt,
        count: item._count.id,
        totalSize: item._sum.size || 0,
      })),
      errorLogs: errorLogs.map((item: any) => ({
        date: item.createdAt,
        count: item._count.id,
      })),
    };

    res.json({
      success: true,
      data: {
        analytics,
      },
    });
  })
);

export default router;