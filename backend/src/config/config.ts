import * as dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3001),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  
  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Cookies
  COOKIE_SECRET: z.string().min(32, 'Cookie secret must be at least 32 characters'),
  
  // AI Provider Configuration
  AI_PROVIDER: z.enum(['openai', 'ollama']).default('ollama'),
  
  // Ollama Configuration
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3'),
  OLLAMA_MAX_TOKENS: z.string().transform(Number).default(2048),
  OLLAMA_TEMPERATURE: z.string().transform(Number).default(0.7),
  OLLAMA_TIMEOUT: z.string().transform(Number).default(30000),
  
  // OpenAI Configuration (Fallback)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default(2048),
  OPENAI_TEMPERATURE: z.string().transform(Number).default(0.7),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  
  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).default(10485760), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  
  // Monitoring
  ENABLE_METRICS: z.string().transform(Boolean).default(false),
  METRICS_PORT: z.string().transform(Number).default(9090),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/app.log'),
});

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:');
  parseResult.error.issues.forEach((issue: any) => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

const env = parseResult.data;

// Export configuration object
const config = {
  // Server
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  
  // Database
  DATABASE_URL: env.DATABASE_URL,
  
  // Redis
  REDIS_URL: env.REDIS_URL,
  redis: {
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    enableOfflineQueue: false,
    maxMemoryPolicy: 'noeviction',
  },
  
  // JWT
  JWT_SECRET: env.JWT_SECRET,
  JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: env.JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN,
  jwt: {
    accessSecret: env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_EXPIRES_IN,
    refreshExpiry: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'va-chat-app',
    audience: 'va-chat-users',
  },
  
  // Cookies
  COOKIE_SECRET: env.COOKIE_SECRET,
  
  // AI Provider
  AI_PROVIDER: env.AI_PROVIDER,
  
  // Ollama
  ollama: {
    baseUrl: env.OLLAMA_BASE_URL,
    model: env.OLLAMA_MODEL,
    maxTokens: env.OLLAMA_MAX_TOKENS,
    temperature: env.OLLAMA_TEMPERATURE,
    timeout: env.OLLAMA_TIMEOUT,
  },
  
  // OpenAI (Fallback)
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    maxTokens: env.OPENAI_MAX_TOKENS,
    temperature: env.OPENAI_TEMPERATURE,
  },
  
  // CORS
  cors: {
    origin: env.CORS_ORIGIN.split(',').map((origin: string) => origin.trim()),
    credentials: true,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  
  // File Upload
  upload: {
    maxFileSize: env.MAX_FILE_SIZE,
    maxFiles: 5, // Default max files per upload
    uploadDir: env.UPLOAD_DIR,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  
  // Email
  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.EMAIL_FROM,
  },
  
  // Monitoring
  metrics: {
    enabled: env.ENABLE_METRICS,
    port: env.METRICS_PORT,
  },
  
  // Logging
  logging: {
    level: env.LOG_LEVEL,
    file: env.LOG_FILE,
  },
  
  // Security
  security: {
    bcryptRounds: 12,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
  },
  
  // Socket.IO
  socket: {
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB
  },
  
  // Development
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
} as const;

// Type for configuration
type ConfigType = typeof config;

// Validate required secrets in production
if (config.isProduction) {
  const requiredSecrets = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'COOKIE_SECRET',
    'OPENAI_API_KEY',
  ];
  
  const missingSecrets = requiredSecrets.filter(
    (secret) => !process.env[secret] || process.env[secret]!.length < 32
  );
  
  if (missingSecrets.length > 0) {
    console.error('❌ Missing or invalid required secrets in production:');
    missingSecrets.forEach((secret) => {
      console.error(`  ${secret}`);
    });
    process.exit(1);
  }
}

console.log('✅ Configuration loaded successfully');
console.log(`🚀 Environment: ${config.NODE_ENV}`);
console.log(`🔌 Port: ${config.PORT}`);
console.log(`🔗 CORS Origin: ${config.cors.origin.join(', ')}`);

export { config as default, config };
export type { ConfigType as Config };