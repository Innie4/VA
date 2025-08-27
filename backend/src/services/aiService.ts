import { config } from '../config/config';
import { logger } from '../utils/logger';
import { ollamaService } from './ollamaService';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  message: string;
  model: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface StreamChunk {
  content: string;
  done: boolean;
}

class AIService {
  private openaiClient?: OpenAI;
  private provider: 'openai' | 'ollama';

  constructor() {
    this.provider = config.AI_PROVIDER;
    
    // Initialize OpenAI client only if using OpenAI or as fallback
    if (this.provider === 'openai' && config.openai.apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: config.openai.apiKey,
      });
    }

    logger.info('AI Service initialized', {
      provider: this.provider,
      hasOpenAIKey: !!config.openai.apiKey,
    });
  }

  /**
   * Check if the AI service is healthy and ready
   */
  async healthCheck(): Promise<{ healthy: boolean; provider: string; error?: string }> {
    try {
      if (this.provider === 'ollama') {
        const healthy = await ollamaService.healthCheck();
        return {
          healthy,
          provider: 'ollama',
          error: healthy ? undefined : 'Ollama server is not accessible',
        };
      } else if (this.provider === 'openai' && this.openaiClient) {
        // Test OpenAI connection
        await this.openaiClient.models.list();
        return {
          healthy: true,
          provider: 'openai',
        };
      } else {
        return {
          healthy: false,
          provider: this.provider,
          error: 'No valid AI provider configured',
        };
      }
    } catch (error) {
      logger.error('AI service health check failed', {
        provider: this.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return {
        healthy: false,
        provider: this.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    try {
      if (this.provider === 'ollama') {
        return await ollamaService.getModels();
      } else if (this.provider === 'openai' && this.openaiClient) {
        const models = await this.openaiClient.models.list();
        return models.data
          .filter(model => model.id.includes('gpt'))
          .map(model => model.id);
      } else {
        throw new Error('No valid AI provider configured');
      }
    } catch (error) {
      logger.error('Failed to get AI models', {
        provider: this.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send a chat completion request
   */
  async chatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResponse> {
    try {
      if (this.provider === 'ollama') {
        const response = await ollamaService.chatCompletion(messages, {
          model: options.model || config.ollama.model,
          temperature: options.temperature || config.ollama.temperature,
          maxTokens: options.maxTokens || config.ollama.maxTokens,
          stream: false,
        });

        return {
          message: response.message.content,
          model: response.model,
          usage: {
            total_tokens: response.eval_count,
            prompt_tokens: response.prompt_eval_count,
            completion_tokens: response.eval_count,
          },
        };
      } else if (this.provider === 'openai' && this.openaiClient) {
        const completion = await this.openaiClient.chat.completions.create({
          model: options.model || config.openai.model,
          messages: messages,
          temperature: options.temperature || config.openai.temperature,
          max_tokens: options.maxTokens || config.openai.maxTokens,
          stream: false,
        });

        const assistantMessage = completion.choices[0]?.message?.content;
        if (!assistantMessage) {
          throw new Error('No response from OpenAI');
        }

        return {
          message: assistantMessage,
          model: completion.model,
          usage: completion.usage,
        };
      } else {
        throw new Error('No valid AI provider configured');
      }
    } catch (error) {
      logger.error('AI chat completion failed', {
        provider: this.provider,
        messageCount: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send a streaming chat completion request
   */
  async *chatCompletionStream(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      if (this.provider === 'ollama') {
        const stream = ollamaService.chatCompletionStream(messages, {
          model: options.model || config.ollama.model,
          temperature: options.temperature || config.ollama.temperature,
          maxTokens: options.maxTokens || config.ollama.maxTokens,
        });

        for await (const chunk of stream) {
          yield {
            content: chunk.message.content,
            done: chunk.done,
          };
        }
      } else if (this.provider === 'openai' && this.openaiClient) {
        const stream = await this.openaiClient.chat.completions.create({
          model: options.model || config.openai.model,
          messages: messages,
          temperature: options.temperature || config.openai.temperature,
          max_tokens: options.maxTokens || config.openai.maxTokens,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          const done = chunk.choices[0]?.finish_reason !== null;
          
          yield {
            content,
            done,
          };
        }
      } else {
        throw new Error('No valid AI provider configured');
      }
    } catch (error) {
      logger.error('AI streaming chat completion failed', {
        provider: this.provider,
        messageCount: messages.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get the current AI provider
   */
  getProvider(): string {
    return this.provider;
  }

  /**
   * Get provider-specific configuration
   */
  getConfig() {
    if (this.provider === 'ollama') {
      return {
        provider: 'ollama',
        baseUrl: config.ollama.baseUrl,
        model: config.ollama.model,
        maxTokens: config.ollama.maxTokens,
        temperature: config.ollama.temperature,
      };
    } else {
      return {
        provider: 'openai',
        model: config.openai.model,
        maxTokens: config.openai.maxTokens,
        temperature: config.openai.temperature,
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;