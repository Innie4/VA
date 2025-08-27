import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import {
  createValidationError,
  createNotFoundError,
  createForbiddenError,
  AppError,
} from '../middleware/errorHandler';
import {
  validate,
  fileSchemas,
  commonSchemas,
} from '../middleware/validation';
import { sanitizeInput } from '../middleware/sanitization';
import {
  authenticate,
  requireOwnership,
} from '../middleware/auth';
import {
  uploadRateLimiter,
  apiRateLimiter,
} from '../middleware/rateLimiter';
import { config } from '../config/config';

const router = Router();

// Apply sanitization to all routes (authentication removed)
// router.use(authenticate);
router.use(sanitizeInput);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', req.user!.id);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/json',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} is not allowed`));
  }

  // Check file size (handled by multer limits)
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFiles,
  },
});

/**
 * @swagger
 * /api/files/upload:
 *   post:
 *     summary: Upload files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Files uploaded successfully
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 */
router.post(
  '/upload',
  uploadRateLimiter,
  upload.array('files', config.upload.maxFiles),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    const { description } = req.body;

    if (!files || files.length === 0) {
      throw createValidationError('No files provided');
    }

    // Check user's storage quota
    const userFiles = await db.getClient().file.aggregate({
      where: { userId: req.user!.id },
      _sum: { size: true },
      _count: { id: true },
    });

    const currentStorageUsed = userFiles._sum.size || 0;
    const currentFileCount = userFiles._count.id || 0;
    const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);

    // Check storage limits based on user tier
    const maxStorage = req.user!.tier === 'premium' ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 10GB vs 100MB
    const maxFiles = req.user!.tier === 'premium' ? 10000 : 100;

    if (currentStorageUsed + newFilesSize > maxStorage) {
      // Clean up uploaded files
      for (const file of files) {
        await fs.unlink(file.path).catch(() => {});
      }
      throw createValidationError(
        `Storage quota exceeded. You have used ${Math.round(currentStorageUsed / 1024 / 1024)}MB of ${Math.round(maxStorage / 1024 / 1024)}MB`
      );
    }

    if (currentFileCount + files.length > maxFiles) {
      // Clean up uploaded files
      for (const file of files) {
        await fs.unlink(file.path).catch(() => {});
      }
      throw createValidationError(
        `File count limit exceeded. You have ${currentFileCount} of ${maxFiles} files`
      );
    }

    // Process and save file records
    const savedFiles = [];
    for (const file of files) {
      try {
        // Calculate file hash for deduplication
        const fileBuffer = await fs.readFile(file.path);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check if file already exists
        const existingFile = await db.getClient().file.findFirst({
          where: {
            userId: req.user!.id,
            originalName: file.originalname,
          },
        });

        if (existingFile) {
          // Remove duplicate file
          await fs.unlink(file.path).catch(() => {});
          savedFiles.push(existingFile);
          continue;
        }

        // Save file record
        const savedFile = await db.getClient().file.create({
          data: {
            userId: req.user!.id,
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            mimeType: file.mimetype,
            size: file.size,
            description,
            metadata: JSON.stringify({
              uploadedFrom: req.ip,
              userAgent: req.get('User-Agent'),
            }),
          },
        });

        savedFiles.push(savedFile);
      } catch (error) {
        // Clean up file on error
        await fs.unlink(file.path).catch(() => {});
        logger.error('File processing error', {
          userId: req.user!.id,
          filename: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new AppError('Failed to process file', 500);
      }
    }

    // Log file upload
    logger.info('Files uploaded', {
      userId: req.user!.id,
      fileCount: savedFiles.length,
      totalSize: savedFiles.reduce((sum, file) => sum + file.size, 0),
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `${savedFiles.length} file(s) uploaded successfully`,
      data: {
        files: savedFiles,
      },
    });
  })
);

/**
 * @swagger
 * /api/files:
 *   get:
 *     summary: Get user's files
 *     tags: [Files]
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
 *         name: mimetype
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  apiRateLimiter,
  validate({ query: fileSchemas.getFiles }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search, mimetype } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {
      userId: req.user!.id,
    };

    if (search) {
      where.OR = [
        {
          originalName: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search as string,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (mimetype) {
      where.mimetype = {
        startsWith: mimetype as string,
      };
    }

    const [files, total, storageStats] = await Promise.all([
      db.getClient().file.findMany({
        where,
        select: {
          id: true,
          originalName: true,
          filename: true,
          mimeType: true,
          size: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              messageFiles: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: Number(limit),
      }),
      db.getClient().file.count({ where }),
      db.getClient().file.aggregate({
        where: { userId: req.user!.id },
        _sum: { size: true },
        _count: { id: true },
      }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));
    const maxStorage = req.user!.tier === 'premium' ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024;
    const maxFiles = req.user!.tier === 'premium' ? 10000 : 100;

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
        storage: {
          used: storageStats._sum.size || 0,
          max: maxStorage,
          fileCount: storageStats._count.id || 0,
          maxFiles,
          usagePercentage: Math.round(((storageStats._sum.size || 0) / maxStorage) * 100),
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/files/{id}:
 *   get:
 *     summary: Get file details
 *     tags: [Files]
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
 *         description: File details retrieved successfully
 *       404:
 *         description: File not found
 *       403:
 *         description: Access denied
 */
router.get(
  '/:id',
  apiRateLimiter,
  validate({ params: commonSchemas.id }),
  // requireOwnership('file'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const file = await db.getClient().file.findUnique({
      where: { id },
      include: {
        messageFiles: {
          include: {
            message: {
              include: {
                conversation: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw createNotFoundError('File not found');
    }

    res.json({
      success: true,
      data: {
        file,
      },
    });
  })
);

/**
 * @swagger
 * /api/files/{id}/download:
 *   get:
 *     summary: Download a file
 *     tags: [Files]
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
 *         description: File downloaded successfully
 *       404:
 *         description: File not found
 *       403:
 *         description: Access denied
 */
router.get(
  '/:id/download',
  apiRateLimiter,
  validate({ params: commonSchemas.id }),
  // requireOwnership('file'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const file = await db.getClient().file.findUnique({
      where: { id },
    });

    if (!file) {
      throw createNotFoundError('File not found');
    }

    // Check if file exists on disk
    try {
      await fs.access(file.path);
    } catch (error) {
      logger.error('File not found on disk', {
        fileId: id,
        path: file.path,
        userId: req.user!.id,
      });
      throw createNotFoundError('File not found on server');
    }

    // Update download count
    await db.getClient().file.update({
      where: { id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    // Log file download
    logger.info('File downloaded', {
      userId: req.user!.id,
      fileId: id,
      filename: file.originalName,
      ip: req.ip,
    });

    // Set appropriate headers
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    res.setHeader('Content-Length', file.size.toString());

    // Stream file
    res.sendFile(path.resolve(file.path));
  })
);

/**
 * @swagger
 * /api/files/{id}:
 *   put:
 *     summary: Update file details
 *     tags: [Files]
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
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: File updated successfully
 *       404:
 *         description: File not found
 *       403:
 *         description: Access denied
 */
router.put(
  '/:id',
  apiRateLimiter,
  validate({ 
    params: commonSchemas.id,
    body: fileSchemas.updateFile,
  }),
  // requireOwnership('file'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { description } = req.body;

    const file = await db.getClient().file.update({
      where: { id },
      data: { description },
    });

    logger.info('File updated', {
      userId: req.user!.id,
      fileId: id,
      changes: { description },
    });

    res.json({
      success: true,
      message: 'File updated successfully',
      data: {
        file,
      },
    });
  })
);

/**
 * @swagger
 * /api/files/{id}:
 *   delete:
 *     summary: Delete a file
 *     tags: [Files]
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
 *         description: File deleted successfully
 *       404:
 *         description: File not found
 *       403:
 *         description: Access denied
 */
router.delete(
  '/:id',
  apiRateLimiter,
  validate({ params: commonSchemas.id }),
  // requireOwnership('file'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const file = await db.getClient().file.findUnique({
      where: { id },
      include: {
        messageFiles: true,
      },
    });

    if (!file) {
      throw createNotFoundError('File not found');
    }

    // Check if file is being used in messages
    if (file.messageFiles.length > 0) {
      throw createValidationError(
        'Cannot delete file that is attached to messages. Remove from messages first.'
      );
    }

    // Delete file from database
    await db.getClient().file.delete({
      where: { id },
    });

    // Delete file from disk
    try {
      await fs.unlink(file.path);
    } catch (error) {
      logger.warn('Failed to delete file from disk', {
        fileId: id,
        path: file.path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info('File deleted', {
      userId: req.user!.id,
      fileId: id,
      filename: file.originalName,
    });

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  })
);

/**
 * @swagger
 * /api/files/bulk-delete:
 *   post:
 *     summary: Delete multiple files
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileIds
 *             properties:
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 50
 *     responses:
 *       200:
 *         description: Files deleted successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 */
router.post(
  '/bulk-delete',
  apiRateLimiter,
  validate({ body: fileSchemas.bulkDelete }),
  asyncHandler(async (req: Request, res: Response) => {
    const { fileIds } = req.body;

    // Verify all files belong to user and are not in use
    const files = await db.getClient().file.findMany({
      where: {
        id: { in: fileIds },
        userId: req.user!.id,
      },
      include: {
        messageFiles: true,
      },
    });

    if (files.length !== fileIds.length) {
      throw createValidationError('One or more files not found or access denied');
    }

    const filesInUse = files.filter((file: any) => file.messageFiles.length > 0);
    if (filesInUse.length > 0) {
      throw createValidationError(
        `Cannot delete ${filesInUse.length} file(s) that are attached to messages`
      );
    }

    // Delete files from database
    await db.getClient().file.deleteMany({
      where: {
        id: { in: fileIds },
        userId: req.user!.id,
      },
    });

    // Delete files from disk
    let deletedFromDisk = 0;
    for (const file of files) {
      try {
        await fs.unlink(file.path);
        deletedFromDisk++;
      } catch (error) {
        logger.warn('Failed to delete file from disk', {
          fileId: file.id,
          path: file.path,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk file deletion', {
      userId: req.user!.id,
      deletedCount: files.length,
      deletedFromDisk,
      fileIds,
    });

    res.json({
      success: true,
      message: `${files.length} file(s) deleted successfully`,
      data: {
        deletedCount: files.length,
        deletedFromDisk,
      },
    });
  })
);

export default router;