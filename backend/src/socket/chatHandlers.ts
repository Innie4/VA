import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './index';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { emitToUser, emitToConversation } from './index';
import { aiService } from '../services/aiService';
import { getSystemPrompt, getAssistantConfig } from '../config/assistantConfig';

interface MessageData {
  conversationId: string;
  content: string;
  fileIds?: string[];
}

interface JoinConversationData {
  conversationId: string;
}

interface LeaveConversationData {
  conversationId: string;
}

export default function chatHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const userId = socket.userId!;
  const user = socket.user!;

  // Join a conversation room
  socket.on('join_conversation', async (data: JoinConversationData) => {
    try {
      const { conversationId } = data;

      // Verify user has access to this conversation
      const conversation = await db.getClient().conversation.findFirst({
        where: {
          id: conversationId,
          userId: userId,
        },
      });

      if (!conversation) {
        socket.emit('error', {
          message: 'Conversation not found or access denied',
          code: 'CONVERSATION_NOT_FOUND',
        });
        return;
      }

      // Join the conversation room
      await socket.join(`conversation:${conversationId}`);

      // Update user's active conversation in Redis
      await redis.setUserActiveConversation(userId, conversationId);

      logger.info('User joined conversation', {
        userId,
        conversationId,
        socketId: socket.id,
      });

      socket.emit('conversation_joined', {
        conversationId,
        message: 'Successfully joined conversation',
      });

      // Notify other participants (if any)
      socket.to(`conversation:${conversationId}`).emit('user_joined_conversation', {
        userId,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        conversationId,
      });
    } catch (error) {
      logger.error('Error joining conversation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to join conversation',
        code: 'JOIN_CONVERSATION_ERROR',
      });
    }
  });

  // Leave a conversation room
  socket.on('leave_conversation', async (data: LeaveConversationData) => {
    try {
      const { conversationId } = data;

      // Leave the conversation room
      await socket.leave(`conversation:${conversationId}`);

      // Clear user's active conversation in Redis
      await redis.clearUserActiveConversation(userId);

      logger.info('User left conversation', {
        userId,
        conversationId,
        socketId: socket.id,
      });

      socket.emit('conversation_left', {
        conversationId,
        message: 'Successfully left conversation',
      });

      // Notify other participants
      socket.to(`conversation:${conversationId}`).emit('user_left_conversation', {
        userId,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        conversationId,
      });
    } catch (error) {
      logger.error('Error leaving conversation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to leave conversation',
        code: 'LEAVE_CONVERSATION_ERROR',
      });
    }
  });

  // Send a message
  socket.on('send_message', async (data: MessageData) => {
    try {
      const { conversationId, content, fileIds = [] } = data;

      // Validate input
      if (!conversationId || !content?.trim()) {
        socket.emit('error', {
          message: 'Conversation ID and content are required',
          code: 'INVALID_MESSAGE_DATA',
        });
        return;
      }

      // Verify user has access to this conversation
      const conversation = await db.getClient().conversation.findFirst({
        where: {
          id: conversationId,
          userId: userId,
        },
      });

      if (!conversation) {
        socket.emit('error', {
          message: 'Conversation not found or access denied',
          code: 'CONVERSATION_NOT_FOUND',
        });
        return;
      }

      // Check daily message limit based on user tier
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayMessageCount = await db.getClient().message.count({
        where: {
          conversation: {
            userId: userId,
          },
          role: 'user',
          createdAt: {
            gte: today,
          },
        },
      });

      const messageLimit = user.tier === 'premium' ? 1000 : 50;
      if (todayMessageCount >= messageLimit) {
        socket.emit('error', {
          message: `Daily message limit reached (${messageLimit} messages)`,
          code: 'MESSAGE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Verify file ownership if files are attached
      if (fileIds.length > 0) {
        const files = await db.getClient().file.findMany({
          where: {
            id: { in: fileIds },
            userId: userId,
          },
        });

        if (files.length !== fileIds.length) {
          socket.emit('error', {
            message: 'One or more files not found or access denied',
            code: 'FILE_ACCESS_DENIED',
          });
          return;
        }
      }

      // Create user message
      const userMessage = await db.getClient().message.create({
        data: {
          conversationId,
          role: 'user',
          content: content.trim(),
          userId: socket.user!.id,
          files: fileIds.length > 0 ? {
            create: fileIds.map(fileId => ({ fileId }))
          } : undefined,
        },
        include: {
          files: {
            include: {
              file: {
                select: {
                  id: true,
                  filename: true,
                  originalName: true,
                  mimeType: true,
                  size: true,
                },
              },
            },
          },
        },
      });

      // Update conversation
      await db.getClient().conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      });

      // Emit user message to conversation participants
      const messagePayload = {
        id: userMessage.id,
        conversationId,
        role: userMessage.role,
        content: userMessage.content,
        files: userMessage.files.map((f: any) => f.file),
        createdAt: userMessage.createdAt,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };

      // Emit to conversation room
      io.to(`conversation:${conversationId}`).emit('message_received', messagePayload);

      // Also emit to user's personal room (for multiple devices)
      emitToUser(io, userId, 'message_sent', messagePayload);

      logger.info('User message sent', {
        userId,
        conversationId,
        messageId: userMessage.id,
        hasFiles: fileIds.length > 0,
        fileCount: fileIds.length,
      });

      // Generate AI response
      try {
        // Get conversation history for context
        const recentMessages = await db.getClient().message.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            role: true,
            content: true,
          },
        });

        // Reverse to get chronological order
        const messages = recentMessages.reverse();

        // Prepare messages for AI service
        const conversationMessages = [
          {
            role: 'system' as const,
            content: getSystemPrompt(),
          },
          ...messages.map((msg: any) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
        ];

        // Emit typing indicator
        io.to(`conversation:${conversationId}`).emit('ai_typing', {
          conversationId,
          isTyping: true,
        });

        // Get assistant configuration
        const assistantConfig = getAssistantConfig();

        // Generate AI response
        const response = await aiService.chatCompletion(conversationMessages, {
          model: assistantConfig.defaultModel,
          temperature: assistantConfig.defaultTemperature,
          maxTokens: assistantConfig.defaultMaxTokens,
        });

        const aiResponse = response.message;

        if (aiResponse) {
          // Create AI message
          const aiMessage = await db.getClient().message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: aiResponse,
              userId: socket.user!.id,
            },
          });

          // Update conversation
          await db.getClient().conversation.update({
            where: { id: conversationId },
            data: {
              updatedAt: new Date(),
            },
          });

          // Stop typing indicator
          io.to(`conversation:${conversationId}`).emit('ai_typing', {
            conversationId,
            isTyping: false,
          });

          // Emit AI response
          const aiMessagePayload = {
            id: aiMessage.id,
            conversationId,
            role: aiMessage.role,
            content: aiMessage.content,
            files: [],
            createdAt: aiMessage.createdAt,
          };

          io.to(`conversation:${conversationId}`).emit('message_received', aiMessagePayload);
          emitToUser(io, userId, 'ai_response', aiMessagePayload);

          logger.info('AI response generated', {
            userId,
            conversationId,
            messageId: aiMessage.id,
            responseLength: aiResponse.length,
          });
        }
      } catch (aiError) {
        logger.error('Error generating AI response', {
          error: aiError instanceof Error ? aiError.message : 'Unknown error',
          userId,
          conversationId,
        });

        // Stop typing indicator
        io.to(`conversation:${conversationId}`).emit('ai_typing', {
          conversationId,
          isTyping: false,
        });

        // Emit error to user
        socket.emit('ai_error', {
          conversationId,
          message: 'Failed to generate AI response',
          code: 'AI_RESPONSE_ERROR',
        });
      }
    } catch (error) {
      logger.error('Error sending message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to send message',
        code: 'SEND_MESSAGE_ERROR',
      });
    }
  });

  // Request conversation history
  socket.on('get_conversation_history', async (data: { conversationId: string; page?: number; limit?: number }) => {
    try {
      const { conversationId, page = 1, limit = 50 } = data;
      const offset = (page - 1) * limit;

      // Verify user has access to this conversation
      const conversation = await db.getClient().conversation.findFirst({
        where: {
          id: conversationId,
          userId: userId,
        },
      });

      if (!conversation) {
        socket.emit('error', {
          message: 'Conversation not found or access denied',
          code: 'CONVERSATION_NOT_FOUND',
        });
        return;
      }

      // Get messages with pagination
      const [messages, total] = await Promise.all([
        db.getClient().message.findMany({
          where: { conversationId },
          include: {
            files: {
              include: {
                file: {
                  select: {
                    id: true,
                    filename: true,
                    originalName: true,
                    mimeType: true,
                    size: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        db.getClient().message.count({ where: { conversationId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      socket.emit('conversation_history', {
        conversationId,
        messages: messages.reverse(), // Reverse to get chronological order
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });

      logger.debug('Conversation history sent', {
        userId,
        conversationId,
        page,
        messageCount: messages.length,
      });
    } catch (error) {
      logger.error('Error getting conversation history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to get conversation history',
        code: 'GET_HISTORY_ERROR',
      });
    }
  });

  // Delete a message
  socket.on('delete_message', async (data: { messageId: string; conversationId: string }) => {
    try {
      const { messageId, conversationId } = data;

      // Verify user owns the message
      const message = await db.getClient().message.findFirst({
        where: {
          id: messageId,
          conversation: {
            userId: userId,
          },
        },
      });

      if (!message) {
        socket.emit('error', {
          message: 'Message not found or access denied',
          code: 'MESSAGE_NOT_FOUND',
        });
        return;
      }

      // Only allow deletion of user messages
      if (message.role !== 'user') {
        socket.emit('error', {
          message: 'Can only delete your own messages',
          code: 'DELETE_NOT_ALLOWED',
        });
        return;
      }

      // Delete message
      await db.getClient().message.delete({
        where: { id: messageId },
      });

      // Update conversation timestamp
      await db.getClient().conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date(),
        },
      });

      // Emit deletion to conversation participants
      io.to(`conversation:${conversationId}`).emit('message_deleted', {
        messageId,
        conversationId,
        deletedBy: userId,
      });

      logger.info('Message deleted', {
        userId,
        messageId,
        conversationId,
      });
    } catch (error) {
      logger.error('Error deleting message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to delete message',
        code: 'DELETE_MESSAGE_ERROR',
      });
    }
  });
}