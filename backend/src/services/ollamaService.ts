import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config/config';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
    top_k?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

class OllamaService {
  private client: AxiosInstance;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.defaultModel = config.ollama.model;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.ollama.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Ollama request', {
          url: config.url,
          method: config.method,
          data: config.data,
        });
        return config;
      },
      (error) => {
        logger.error('Ollama request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Ollama response', {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error('Ollama response error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if Ollama server is running and accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      return response.status === 200;
    } catch (error) {
      logger.error('Ollama health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        baseUrl: this.baseUrl,
      });
      return false;
    }
  }

  /**
   * Get list of available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      logger.error('Failed to get Ollama models', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to fetch available models');
    }
  }

  /**
   * Send a chat completion request to Ollama
   */
  async chatCompletion(
    messages: OllamaMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<OllamaChatResponse> {
    const {
      model = this.defaultModel,
      temperature = config.ollama.temperature,
      maxTokens = config.ollama.maxTokens,
      stream = false,
    } = options;

    const requestData: OllamaChatRequest = {
      model,
      messages,
      stream,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    try {
      logger.info('Sending chat completion to Ollama', {
        model,
        messageCount: messages.length,
        temperature,
        maxTokens,
      });

      const response = await this.client.post('/api/chat', requestData);
      
      if (!response.data.message?.content) {
        throw new Error('No content in Ollama response');
      }

      logger.info('Received response from Ollama', {
        model: response.data.model,
        responseLength: response.data.message.content.length,
        evalCount: response.data.eval_count,
        totalDuration: response.data.total_duration,
      });

      return response.data;
    } catch (error) {
      logger.error('Ollama chat completion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model,
        messageCount: messages.length,
      });
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Ollama server is not running. Please start Ollama and try again.');
        }
        if (error.response?.status === 404) {
          throw new Error(`Model '${model}' not found. Please pull the model first: ollama pull ${model}`);
        }
      }
      
      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Send a streaming chat completion request to Ollama
   */
  async *chatCompletionStream(
    messages: OllamaMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): AsyncGenerator<OllamaStreamChunk, void, unknown> {
    const {
      model = this.defaultModel,
      temperature = config.ollama.temperature,
      maxTokens = config.ollama.maxTokens,
    } = options;

    const requestData: OllamaChatRequest = {
      model,
      messages,
      stream: true,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    try {
      logger.info('Starting streaming chat completion with Ollama', {
        model,
        messageCount: messages.length,
        temperature,
        maxTokens,
      });

      const response = await this.client.post('/api/chat', requestData, {
        responseType: 'stream',
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data: OllamaStreamChunk = JSON.parse(line);
              yield data;
              
              if (data.done) {
                logger.info('Ollama streaming completed', {
                  model: data.model,
                });
                return;
              }
            } catch (parseError) {
              logger.warn('Failed to parse Ollama stream chunk', {
                line,
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Ollama streaming chat completion failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model,
        messageCount: messages.length,
      });
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Ollama server is not running. Please start Ollama and try again.');
        }
        if (error.response?.status === 404) {
          throw new Error(`Model '${model}' not found. Please pull the model first: ollama pull ${model}`);
        }
      }
      
      throw new Error('Failed to generate streaming AI response');
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    try {
      logger.info('Pulling Ollama model', { modelName });
      
      await this.client.post('/api/pull', {
        name: modelName,
      });
      
      logger.info('Successfully pulled Ollama model', { modelName });
    } catch (error) {
      logger.error('Failed to pull Ollama model', {
        modelName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to pull model: ${modelName}`);
    }
  }
}

// Export singleton instance
export const ollamaService = new OllamaService();
export default ollamaService;