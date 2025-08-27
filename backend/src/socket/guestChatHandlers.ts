import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './index';
import { logger } from '../utils/logger';
import { aiService } from '../services/aiService';
import { getSystemPrompt, getAssistantConfig } from '../config/assistantConfig';

interface GuestMessageData {
  content: string;
  sessionId?: string;
}

interface GuestMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// In-memory storage for guest conversations (temporary)
const guestConversations = new Map<string, GuestMessage[]>();

export default function guestChatHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const sessionId = socket.id;

  // Initialize guest conversation
  if (!guestConversations.has(sessionId)) {
    guestConversations.set(sessionId, []);
  }

  // Send a message as guest
  socket.on('send_message', async (data: GuestMessageData) => {
    try {
      const { content } = data;

      // Validate input
      if (!content?.trim()) {
        socket.emit('error', {
          message: 'Message content is required',
          code: 'INVALID_MESSAGE_DATA',
        });
        return;
      }

      // Rate limiting for guests
      const conversation = guestConversations.get(sessionId) || [];
      const recentMessages = conversation.filter(
        (msg: GuestMessage) => Date.now() - msg.timestamp.getTime() < 60000
      );
      
      if (recentMessages.length >= 10) {
        socket.emit('error', {
          message: 'Rate limit exceeded. Please wait before sending more messages.',
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return;
      }

      // Add user message to conversation
      const userMessage: GuestMessage = {
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };
      
      conversation.push(userMessage);
      guestConversations.set(sessionId, conversation);

      // Emit user message back to confirm receipt
      socket.emit('message_received', {
        id: `guest_${Date.now()}_user`,
        role: 'user',
        content: userMessage.content,
        timestamp: userMessage.timestamp.toISOString(),
        isGuest: true,
      });

      logger.info('Guest message received', {
        sessionId,
        socketId: socket.id,
        contentLength: content.length,
        ip: socket.handshake.address,
      });

      // Generate AI response
      try {
        // Emit typing indicator
        socket.emit('ai_typing', {
          isTyping: true,
        });

        // Prepare conversation context
        const conversationMessages = conversation
          .slice(-10)
          .map((msg: GuestMessage) => ({
            role: msg.role,
            content: msg.content,
          }));

        // Add system prompt for guest users
        const systemPrompt = getSystemPrompt();
        const messages = [
          { role: 'system' as const, content: `${systemPrompt}\n\nNote: This is a guest user session. Responses should be helpful but encourage registration for full features.` },
          ...conversationMessages,
        ];

        // Get assistant configuration
        const assistantConfig = getAssistantConfig();

        // Generate AI response
        const response = await aiService.chatCompletion(messages, {
          model: assistantConfig.defaultModel,
          temperature: assistantConfig.defaultTemperature,
          maxTokens: Math.min(assistantConfig.defaultMaxTokens, 500),
        });

        const aiResponse = response.message;

        if (aiResponse) {
          // Add AI message to conversation
          const aiMessage: GuestMessage = {
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date(),
          };
          
          conversation.push(aiMessage);
          guestConversations.set(sessionId, conversation);

          // Stop typing indicator
          socket.emit('ai_typing', {
            isTyping: false,
          });

          // Emit AI response
          socket.emit('message_received', {
            id: `guest_${Date.now()}_assistant`,
            role: 'assistant',
            content: aiMessage.content,
            timestamp: aiMessage.timestamp.toISOString(),
            isGuest: true,
          });

          logger.info('AI response sent to guest', {
            sessionId,
            socketId: socket.id,
            responseLength: aiResponse.length,
          });
        } else {
          throw new Error('No AI response generated');
        }
      } catch (aiError) {
        logger.error('Error generating AI response for guest', {
          error: aiError instanceof Error ? aiError.message : 'Unknown error',
          sessionId,
          socketId: socket.id,
        });

        socket.emit('ai_typing', {
          isTyping: false,
        });

        socket.emit('error', {
          message: 'Failed to generate AI response. Please try again.',
          code: 'AI_RESPONSE_ERROR',
        });
      }
    } catch (error) {
      logger.error('Error handling guest message', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
        socketId: socket.id,
        data,
      });

      socket.emit('error', {
        message: 'Failed to process message',
        code: 'MESSAGE_PROCESSING_ERROR',
      });
    }
  });

  // Get conversation history for guest
  socket.on('get_conversation_history', () => {
    try {
      const conversation = guestConversations.get(sessionId) || [];
      
      const messages = conversation.map((msg: GuestMessage, index: number) => ({
        id: `guest_${sessionId}_${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        isGuest: true,
      }));

      socket.emit('conversation_history', {
        messages,
        isGuest: true,
        sessionId,
      });

      logger.debug('Guest conversation history sent', {
        sessionId,
        messageCount: messages.length,
      });
    } catch (error) {
      logger.error('Error getting guest conversation history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });

      socket.emit('error', {
        message: 'Failed to get conversation history',
        code: 'GET_HISTORY_ERROR',
      });
    }
  });

  // Clear conversation for guest
  socket.on('clear_conversation', () => {
    try {
      guestConversations.set(sessionId, []);
      
      socket.emit('conversation_cleared', {
        message: 'Conversation cleared successfully',
        sessionId,
      });

      logger.info('Guest conversation cleared', {
        sessionId,
        socketId: socket.id,
      });
    } catch (error) {
      logger.error('Error clearing guest conversation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });

      socket.emit('error', {
        message: 'Failed to clear conversation',
        code: 'CLEAR_CONVERSATION_ERROR',
      });
    }
  });

  // Clean up guest conversation on disconnect
  socket.on('disconnect', () => {
    setTimeout(() => {
      if (guestConversations.has(sessionId)) {
        guestConversations.delete(sessionId);
        logger.debug('Guest conversation cleaned up', { sessionId });
      }
    }, 60 * 60 * 1000);
  });

  logger.info('Guest chat handlers registered', {
    sessionId,
    socketId: socket.id,
  });
}