import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { getSystemPrompt, getAssistantConfig } from '../config/assistantConfig';
import { aiService } from '../services/aiService';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  messages?: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Send a chat message to OpenAI GPT-4
 */
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const {
      message,
      messages = [],
      model = 'gpt-4',
      temperature = 0.7,
      maxTokens = 1000
    }: ChatRequest = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Prepare conversation history with virtual assistant system prompt
    const conversationMessages: ChatMessage[] = [
      {
        role: 'system',
        content: getSystemPrompt()
      },
      ...messages,
      {
        role: 'user',
        content: message
      }
    ];

    logger.info('Sending message to OpenAI', {
      model,
      messageCount: conversationMessages.length,
      userId: req.user?.id
    });

    // Get assistant configuration for better defaults
    const assistantConfig = getAssistantConfig();
    
    // Call AI service with enhanced configuration
    const response = await aiService.chatCompletion(conversationMessages, {
      model: model || assistantConfig.defaultModel,
      temperature: temperature ?? assistantConfig.defaultTemperature,
      maxTokens: maxTokens || assistantConfig.defaultMaxTokens,
    });

    logger.info('Received response from AI service', {
      provider: aiService.getProvider(),
      responseLength: response.message.length,
      tokensUsed: response.usage?.total_tokens,
      userId: req.user?.id
    });

    return res.json({
      success: true,
      data: {
        message: response.message,
        usage: response.usage,
        model: response.model,
        conversationId: req.body.conversationId || `conv_${Date.now()}`
      }
    });

  } catch (error) {
    logger.error('Error in chat completion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to process chat message'
    });
  }
};

/**
 * Send a streaming chat message to OpenAI GPT-4
 */
export const sendStreamingMessage = async (req: Request, res: Response) => {
  try {
    const {
      message,
      messages = [],
      model = 'gpt-4',
      temperature = 0.7,
      maxTokens = 1000
    }: ChatRequest = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Prepare conversation history with virtual assistant system prompt
    const conversationMessages: ChatMessage[] = [
      {
        role: 'system',
        content: getSystemPrompt()
      },
      ...messages,
      {
        role: 'user',
        content: message
      }
    ];

    logger.info('Starting streaming chat completion', {
      provider: aiService.getProvider(),
      model,
      messageCount: conversationMessages.length,
      userId: req.user?.id
    });

    // Get assistant configuration for better defaults
    const assistantConfig = getAssistantConfig();
    
    // Call AI service with streaming and enhanced configuration
    const stream = aiService.chatCompletionStream(conversationMessages, {
      model: model || assistantConfig.defaultModel,
      temperature: temperature ?? assistantConfig.defaultTemperature,
      maxTokens: maxTokens || assistantConfig.defaultMaxTokens,
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

    // Send completion signal
    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: '',
      done: true,
      fullResponse,
      conversationId: req.body.conversationId || `conv_${Date.now()}`
    })}\n\n`);

    res.end();

    logger.info('Completed streaming chat', {
      responseLength: fullResponse.length,
      userId: req.user?.id
    });

    return;

  } catch (error) {
    logger.error('Error in streaming chat completion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Failed to process chat message',
      done: true
    })}\n\n`);
    
    return res.end();
  }
};

/**
 * Get available AI models
 */
export const getModels = async (req: Request, res: Response) => {
  try {
    const models = await aiService.getModels();
    
    const modelList = models.map(model => ({
      id: model,
      provider: aiService.getProvider(),
    }));

    res.json({
      success: true,
      data: modelList
    });

  } catch (error) {
    logger.error('Error fetching AI models', {
      provider: aiService.getProvider(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch models'
    });
  }
};

/**
 * Health check for AI service
 */
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const healthStatus = await aiService.healthCheck();
    const config = aiService.getConfig();
    
    if (healthStatus.healthy) {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          provider: healthStatus.provider,
          config,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          provider: healthStatus.provider,
          error: healthStatus.error,
          config,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error('AI service health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'AI service health check failed'
    });
  }
};