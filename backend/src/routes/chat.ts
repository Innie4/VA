import { Router, Request, Response } from 'express';
import Joi from 'joi';
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
  chatSchemas,
  commonSchemas,
} from '../middleware/validation';
import { sanitizeInput } from '../middleware/sanitization';
import {
  authenticate,
  requireOwnership,
} from '../middleware/auth';
import {
  chatRateLimiter,
  apiRateLimiter,
} from '../middleware/rateLimiter';
import { aiService } from '../services/aiService';
import { getSystemPrompt, getAssistantConfig } from '../config/assistantConfig';

const router = Router();

// Apply sanitization to all routes (authentication removed)
// router.use(authenticate);
router.use(sanitizeInput);

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags: [Chat]
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
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/conversations',
  apiRateLimiter,
  validate({ query: commonSchemas.pagination }),
  asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {
      userId: req.user!.id,
    };

    if (search) {
      where.title = {
        contains: search as string,
        mode: 'insensitive',
      };
    }

    const [conversations, total] = await Promise.all([
      db.getClient().conversation.findMany({
        where,
        include: {
          messages: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              content: true,
              role: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip: offset,
        take: Number(limit),
      }),
      db.getClient().conversation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        conversations: conversations.map((conv: any) => ({
          ...conv,
          lastMessage: conv.messages[0] || null,
          messages: undefined,
        })),
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
 * /api/chat/conversations:
 *   post:
 *     summary: Create a new conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               initialMessage:
 *                 type: string
 *                 maxLength: 4000
 *     responses:
 *       201:
 *         description: Conversation created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/conversations',
  apiRateLimiter,
  validate({ body: chatSchemas.createConversation }),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, initialMessage } = req.body;

    // Check user's conversation limit based on tier
    const conversationCount = await db.getClient().conversation.count({
      where: { userId: req.user!.id },
    });

    const maxConversations = req.user!.tier === 'premium' ? 1000 : 50;
    if (conversationCount >= maxConversations) {
      throw createValidationError(
        `You have reached the maximum number of conversations (${maxConversations}) for your tier`
      );
    }

    const conversation = await db.getClient().conversation.create({
      data: {
        userId: req.user!.id,
        title: title || 'New Conversation',
      },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    // Create initial message if provided
    let initialMsg = null;
    if (initialMessage) {
      initialMsg = await db.getClient().message.create({
        data: {
          conversationId: conversation.id,
          content: initialMessage,
          role: 'user',
          userId: req.user!.id,
          metadata: JSON.stringify({
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          }),
        },
      });
    }

    // Log conversation creation
    logger.info('Conversation created', {
      userId: req.user!.id,
      conversationId: conversation.id,
      hasInitialMessage: !!initialMessage,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: {
        conversation: {
          ...conversation,
          lastMessage: initialMsg,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/chat/conversations/{id}:
 *   get:
 *     summary: Get conversation details with messages
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully
 *       404:
 *         description: Conversation not found
 *       403:
 *         description: Access denied
 */
router.get(
  '/conversations/:id',
  apiRateLimiter,
  validate({ 
    params: commonSchemas.id,
    query: commonSchemas.pagination,
  }),
  // requireOwnership('conversation'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [conversation, messages, totalMessages] = await Promise.all([
      db.getClient().conversation.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
      db.getClient().message.findMany({
        where: { conversationId: id },
        include: {
          files: {
            include: {
              file: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        skip: offset,
        take: Number(limit),
      }),
      db.getClient().message.count({
        where: { conversationId: id },
      }),
    ]);

    if (!conversation) {
      throw createNotFoundError('Conversation not found');
    }

    // Update last accessed time
    await db.getClient().conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    const totalPages = Math.ceil(totalMessages / Number(limit));

    res.json({
      success: true,
      data: {
        conversation,
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalMessages,
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
 * /api/chat/conversations/{id}/messages:
 *   post:
 *     summary: Send a message in a conversation
 *     tags: [Chat]
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
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 4000
 *               fileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 5
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Conversation not found
 *       403:
 *         description: Access denied
 */
router.post(
  '/conversations/:id/messages',
  chatRateLimiter,
  validate({ 
    params: commonSchemas.id,
    body: chatSchemas.sendMessage,
  }),
  // requireOwnership('conversation'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id: conversationId } = req.params;
    const { content, fileIds = [] } = req.body;

    // Check message limit based on user tier
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayMessageCount = await db.getClient().message.count({
      where: {
        conversation: {
          userId: req.user!.id,
        },
        role: 'user',
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const maxDailyMessages = req.user!.tier === 'premium' ? 1000 : 100;
    if (todayMessageCount >= maxDailyMessages) {
      throw createValidationError(
        `You have reached the daily message limit (${maxDailyMessages}) for your tier`
      );
    }

    // Validate file ownership if fileIds provided
    if (fileIds.length > 0) {
      const files = await db.getClient().file.findMany({
        where: {
          id: { in: fileIds },
          userId: req.user!.id,
        },
      });

      if (files.length !== fileIds.length) {
        throw createValidationError('One or more files not found or access denied');
      }
    }

    // Create user message
    const userMessage = await db.getClient().message.create({
      data: {
        conversationId: conversationId!,
        content,
        role: 'user',
        userId: req.user!.id,
        metadata: JSON.stringify({
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        }),
        files: fileIds.length > 0 ? {
          create: fileIds.map((fileId: string) => ({
            fileId,
          })),
        } : undefined,
      },
      include: {
        files: {
          include: {
            file: true,
          },
        },
      },
    });

    // Get conversation history for context
    const recentMessages = await db.getClient().message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Last 20 messages for context
      select: {
        role: true,
        content: true,
      },
    });

    // Prepare messages for OpenAI (reverse to get chronological order)
    const messages = recentMessages.reverse().map((msg: any) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    try {
      // Get assistant configuration
      const assistantConfig = getAssistantConfig();

      // Generate AI response
      const completion = await aiService.chatCompletion([
        {
          role: 'system',
          content: getSystemPrompt(),
        },
        ...messages,
      ], {
        model: assistantConfig.defaultModel,
        temperature: assistantConfig.defaultTemperature,
        maxTokens: assistantConfig.defaultMaxTokens,
      });

      const aiResponse = completion.message;
      if (!aiResponse) {
        throw new AppError('Failed to generate AI response', 500);
      }

      // Create AI message
      const aiMessage = await db.getClient().message.create({
        data: {
          conversationId: conversationId!,
          content: aiResponse,
          role: 'assistant',
          userId: req.user!.id,
          metadata: JSON.stringify({
            model: assistantConfig.defaultModel,
            provider: aiService.getProvider(),
            tokens: completion.usage?.total_tokens || 0,
            promptTokens: completion.usage?.prompt_tokens || 0,
            completionTokens: completion.usage?.completion_tokens || 0,
          }),
        },
      });

      // Update conversation
      await db.getClient().conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      });

      // Log message exchange
      logger.info('Message exchange completed', {
        userId: req.user!.id,
        conversationId,
        userMessageId: userMessage.id,
        aiMessageId: aiMessage.id,
        tokens: completion.usage?.total_tokens || 0,
        hasFiles: fileIds.length > 0,
      });

      // Cache recent conversation in Redis for faster access
      const cacheKey = `conversation:${conversationId}:recent`;
      await redis.setJSON(cacheKey, {
        messages: [userMessage, aiMessage],
        updatedAt: new Date(),
      }, 300); // 5 minutes

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          userMessage,
          aiMessage,
          usage: completion.usage,
        },
      });
    } catch (error) {
      logger.error('OpenAI API error', {
        userId: req.user!.id,
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Create error message for user
      await db.getClient().message.create({
        data: {
          conversationId: conversationId!,
          content: 'I apologize, but I encountered an error while processing your message. Please try again.',
          role: 'assistant',
          userId: req.user!.id,
          metadata: JSON.stringify({
            error: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      });

      throw new AppError('Failed to process message', 500);
    }
  })
);

/**
 * @swagger
 * /api/chat/conversations/{id}:
 *   put:
 *     summary: Update conversation title
 *     tags: [Chat]
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
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *     responses:
 *       200:
 *         description: Conversation updated successfully
 *       404:
 *         description: Conversation not found
 *       403:
 *         description: Access denied
 */
router.put(
  '/conversations/:id',
  apiRateLimiter,
  validate({ 
    params: commonSchemas.id,
    body: chatSchemas.updateConversation,
  }),
  // requireOwnership('conversation'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title } = req.body;

    const conversation = await db.getClient().conversation.update({
      where: { id },
      data: { title },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    logger.info('Conversation updated', {
      userId: req.user!.id,
      conversationId: id,
      newTitle: title,
    });

    res.json({
      success: true,
      message: 'Conversation updated successfully',
      data: {
        conversation,
      },
    });
  })
);

/**
 * @swagger
 * /api/chat/conversations/{id}:
 *   delete:
 *     summary: Delete a conversation
 *     tags: [Chat]
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
 *         description: Conversation deleted successfully
 *       404:
 *         description: Conversation not found
 *       403:
 *         description: Access denied
 */
router.delete(
  '/conversations/:id',
  apiRateLimiter,
  validate({ params: commonSchemas.id }),
  // requireOwnership('conversation'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Delete conversation and all related data (cascade)
    await db.getClient().conversation.delete({
      where: { id },
    });

    // Clear cache
    const cacheKey = `conversation:${id}:recent`;
    await redis.del(cacheKey);

    logger.info('Conversation deleted', {
      userId: req.user!.id,
      conversationId: id,
    });

    res.json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  })
);

/**
 * @swagger
 * /api/chat/messages/{id}:
 *   delete:
 *     summary: Delete a message
 *     tags: [Chat]
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
 *         description: Message deleted successfully
 *       404:
 *         description: Message not found
 *       403:
 *         description: Access denied
 */
router.delete(
  '/messages/:id',
  apiRateLimiter,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Find message and verify ownership
    const message = await db.getClient().message.findUnique({
      where: { id },
      include: {
        conversation: {
          select: {
            userId: true,
            id: true,
          },
        },
      },
    });

    if (!message) {
      throw createNotFoundError('Message not found');
    }

    if (message.conversation.userId !== req.user!.id) {
      throw createForbiddenError('Access denied');
    }

    // Delete message
    await db.getClient().message.delete({
      where: { id },
    });

    // Update conversation timestamp
    await db.getClient().conversation.update({
      where: { id: message.conversation.id },
      data: {
        updatedAt: new Date(),
      },
    });

    logger.info('Message deleted', {
      userId: req.user!.id,
      messageId: id,
      conversationId: message.conversation.id,
    });

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  })
);

/**
 * @swagger
 * /api/chat/search:
 *   get:
 *     summary: Search messages across conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
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
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       400:
 *         description: Invalid search query
 */
router.get(
  '/search',
  apiRateLimiter,
  validate({ query: commonSchemas.search }),
  asyncHandler(async (req: Request, res: Response) => {
    const { q: query, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [messages, total] = await Promise.all([
      db.getClient().message.findMany({
        where: {
          conversation: {
            userId: req.user!.id,
          },
          content: {
            contains: query as string,
          },
        },
        include: {
          conversation: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: Number(limit),
      }),
      db.getClient().message.count({
        where: {
          conversation: {
            userId: req.user!.id,
          },
          content: {
            contains: query as string,
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNext: Number(page) < totalPages,
          hasPrev: Number(page) > 1,
        },
        query,
      },
    });
  })
);

/**
 * @swagger
 * /api/chat/conversations/{conversationId}/stream:
 *   post:
 *     summary: Send a streaming message to a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Message content
 *                 minLength: 1
 *                 maxLength: 4000
 *     responses:
 *       200:
 *         description: Streaming response
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Conversation not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post(
  '/conversations/:conversationId/stream',
  chatRateLimiter,
  validate({
    params: Joi.object({
      conversationId: Joi.string().uuid().required()
    }),
    body: chatSchemas.sendMessage,
  }),
  // requireOwnership('conversation'), // Removed authentication
  asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const { content } = req.body;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      // Create user message
      const userMessage = await db.getClient().message.create({
        data: {
          conversationId: conversationId!,
          content,
          role: 'user',
          userId: req.user!.id,
        },
      });

      // Get recent messages for context (last 10)
      const recentMessages = await db.getClient().message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          content: true,
          role: true,
        },
      });

      // Prepare messages for OpenAI (reverse to get chronological order)
      const messages = recentMessages.reverse().map((msg: any) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }));

      // Get assistant configuration
      const assistantConfig = getAssistantConfig();

      // Prepare conversation messages
      const conversationMessages = [
        {
          role: 'system' as const,
          content: getSystemPrompt(),
        },
        ...messages,
      ];

      // Generate AI response with streaming
      const stream = aiService.chatCompletionStream(conversationMessages, {
        model: assistantConfig.defaultModel,
        temperature: assistantConfig.defaultTemperature,
        maxTokens: assistantConfig.defaultMaxTokens,
      });

      let fullResponse = '';
      let tokenCount = 0;

      // Stream the response
      for await (const chunk of stream) {
        if (chunk.content) {
          fullResponse += chunk.content;
          tokenCount++;
          
          // Send chunk to client
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            content: chunk.content,
            done: chunk.done
          })}\n\n`);
        }
        
        if (chunk.done) {
          break;
        }
      }

      // Create AI message in database
      const aiMessage = await db.getClient().message.create({
        data: {
          conversationId: conversationId!,
          content: fullResponse,
          role: 'assistant',
          userId: req.user!.id,
          metadata: JSON.stringify({
            model: assistantConfig.defaultModel,
            provider: aiService.getProvider(),
            tokens: tokenCount,
            streaming: true,
          }),
        },
      });

      // Update conversation
      await db.getClient().conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      });

      // Send completion signal
      res.write(`data: ${JSON.stringify({
        type: 'done',
        content: '',
        done: true,
        messageId: aiMessage.id,
        fullResponse
      })}\n\n`);

      res.end();

      logger.info('Streaming chat completed', {
        conversationId,
        userId: req.user!.id,
        responseLength: fullResponse.length,
        tokens: tokenCount,
      });

    } catch (error) {
      logger.error('Error in streaming chat', {
        error: error instanceof Error ? error.message : 'Unknown error',
        conversationId,
        userId: req.user!.id,
      });

      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Failed to process streaming message',
        done: true
      })}\n\n`);
      
      res.end();
    }
  })
);

export default router;