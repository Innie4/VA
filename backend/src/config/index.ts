import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
}

interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  db: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  maxMemoryPolicy: string;
}

interface JWTConfig {
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
}

interface ServerConfig {
  port: number;
  environment: string;
  nodeEnv: string;
  logLevel: string;
}

interface CORSConfig {
  origin: string | string[] | boolean;
  credentials: boolean;
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  uploadPath: string;
  maxFilesPerUser: {
    standard: number;
    premium: number;
  };
  maxStoragePerUser: {
    standard: number;
    premium: number;
  };
}

interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user?: string | undefined;
    pass?: string | undefined;
  };
  from: {
    name: string;
    email: string;
  };
  templates: {
    dir: string;
  };
}

interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: JWTConfig;
  cors: CORSConfig;
  openai: OpenAIConfig;
  fileUpload: FileUploadConfig;
  email: EmailConfig;
}

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'REDIS_HOST',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  // 'OPENAI_API_KEY' // Temporarily commented out for development
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Helper function to parse boolean environment variables
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to parse JSON environment variables
const parseJSON = <T>(value: string | undefined, defaultValue: T): T => {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
};

// Helper function to parse CORS origin
const parseCorsOrigin = (value: string | undefined): string | string[] | boolean => {
  if (!value) return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.includes(',')) {
    return value.split(',').map(origin => origin.trim());
  }
  return value;
};

const appConfig: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    environment: process.env.NODE_ENV || 'development',
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000', 10),
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
    enableOfflineQueue: parseBoolean(process.env.REDIS_OFFLINE_QUEUE, false),
    maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
  },
  
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET!,
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET!,
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'ai-chat-app',
    audience: process.env.JWT_AUDIENCE || 'ai-chat-users',
  },
  
  cors: {
    origin: parseCorsOrigin(process.env.CORS_ORIGIN || 'http://localhost:5173'),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true),
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'placeholder-key',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
  },
  
  fileUpload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
    allowedMimeTypes: parseJSON(
      process.env.ALLOWED_MIME_TYPES,
      [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/json',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]
    ),
    uploadPath: process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'),
    maxFilesPerUser: {
      standard: parseInt(process.env.MAX_FILES_STANDARD || '50', 10),
      premium: parseInt(process.env.MAX_FILES_PREMIUM || '500', 10),
    },
    maxStoragePerUser: {
      standard: parseInt(process.env.MAX_STORAGE_STANDARD || '104857600', 10), // 100MB
      premium: parseInt(process.env.MAX_STORAGE_PREMIUM || '1073741824', 10), // 1GB
    },
  },
  
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: parseBoolean(process.env.SMTP_SECURE, false),
      user: process.env.SMTP_USER || undefined,
      pass: process.env.SMTP_PASS || undefined,
    },
    from: {
      name: process.env.SMTP_FROM_NAME || 'AI Chat Application',
      email: process.env.SMTP_FROM_EMAIL || 'noreply@ai-chat.com',
    },
    templates: {
      dir: process.env.EMAIL_TEMPLATES_DIR || path.join(process.cwd(), 'src', 'templates', 'emails'),
    },
  },
};

// Validate configuration
if (appConfig.server.port < 1 || appConfig.server.port > 65535) {
  throw new Error('Invalid server port. Must be between 1 and 65535.');
}

if (appConfig.redis.port < 1 || appConfig.redis.port > 65535) {
  throw new Error('Invalid Redis port. Must be between 1 and 65535.');
}

if (appConfig.openai.temperature < 0 || appConfig.openai.temperature > 2) {
  throw new Error('Invalid OpenAI temperature. Must be between 0 and 2.');
}

if (appConfig.fileUpload.maxFileSize < 1) {
  throw new Error('Invalid max file size. Must be greater than 0.');
}

export { appConfig as default, appConfig as config };
export type {
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  JWTConfig,
  ServerConfig,
  CORSConfig,
  OpenAIConfig,
  FileUploadConfig,
  EmailConfig
};