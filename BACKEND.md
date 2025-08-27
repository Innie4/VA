# Backend Architecture Documentation

## Overview

The VA Chat application backend is built with Node.js, Express.js, and TypeScript, providing a robust REST API and WebSocket server for real-time chat functionality. The architecture follows a layered approach with clear separation of concerns, comprehensive error handling, and security best practices.

## Technology Stack

### Core Technologies
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **TypeScript** - Type-safe JavaScript development
- **Prisma** - Database ORM and migration tool
- **SQLite** - Development database (PostgreSQL for production)

### Authentication & Security
- **JWT (JSON Web Tokens)** - Stateless authentication
- **bcrypt** - Password hashing
- **helmet** - Security headers
- **cors** - Cross-origin resource sharing
- **rate-limiter-flexible** - Rate limiting

### Real-time Communication
- **Socket.IO** - WebSocket implementation
- **Redis** - Session storage and caching

### Logging & Monitoring
- **Winston** - Structured logging
- **Morgan** - HTTP request logging
- **Prometheus** - Metrics collection

### Validation & Documentation
- **Zod** - Runtime type validation
- **Swagger/OpenAPI** - API documentation

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.ts   # Database configuration
│   │   ├── redis.ts      # Redis configuration
│   │   ├── jwt.ts        # JWT configuration
│   │   └── logger.ts     # Logging configuration
│   ├── controllers/      # Request handlers
│   │   ├── auth.ts       # Authentication endpoints
│   │   ├── chat.ts       # Chat endpoints
│   │   ├── files.ts      # File management
│   │   ├── users.ts      # User management
│   │   └── admin.ts      # Admin endpoints
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts       # Authentication middleware
│   │   ├── validation.ts # Request validation
│   │   ├── rateLimit.ts  # Rate limiting
│   │   ├── error.ts      # Error handling
│   │   └── logging.ts    # Request logging
│   ├── routes/           # Route definitions
│   │   ├── auth.ts       # Authentication routes
│   │   ├── chat.ts       # Chat routes
│   │   ├── files.ts      # File routes
│   │   ├── users.ts      # User routes
│   │   ├── admin.ts      # Admin routes
│   │   └── health.ts     # Health check routes
│   ├── schemas/          # Zod validation schemas
│   │   ├── auth.ts       # Authentication schemas
│   │   ├── chat.ts       # Chat schemas
│   │   ├── user.ts       # User schemas
│   │   └── common.ts     # Common schemas
│   ├── socket/           # WebSocket handlers
│   │   ├── handlers/     # Socket event handlers
│   │   ├── middleware/   # Socket middleware
│   │   └── index.ts      # Socket server setup
│   ├── utils/            # Utility functions
│   │   ├── crypto.ts     # Cryptographic utilities
│   │   ├── email.ts      # Email utilities
│   │   ├── file.ts       # File utilities
│   │   └── validation.ts # Validation utilities
│   ├── types/            # TypeScript type definitions
│   ├── health-check.ts   # Health check endpoint
│   └── index.ts          # Application entry point
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── migrations/       # Database migrations
│   └── seed.ts           # Database seeding
├── logs/                 # Application logs
├── uploads/              # File uploads (development)
├── package.json
└── tsconfig.json
```

## Database Architecture

### Prisma Schema Overview

The database schema is designed to support a comprehensive chat application with user management, conversations, messages, file attachments, and administrative features.

#### Core Models

##### User Model
```prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  password          String
  firstName         String
  lastName          String
  avatar            String?
  bio               String?
  isActive          Boolean  @default(true)
  isEmailVerified   Boolean  @default(false)
  emailVerifiedAt   DateTime?
  timezone          String?
  language          String?
  tier              String   @default("basic")
  lastLoginAt       DateTime?
  lastActiveAt      DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  roleId            String
  role              Role     @relation(fields: [roleId], references: [id])
  preferences       UserPreferences?
  statistics        UserStatistics?
  conversations     Conversation[]
  messages          Message[]
  files             File[]
  sessions          Session[]
  passwordResets    PasswordReset[]
  emailVerifications EmailVerification[]
  apiKeys           ApiKey[]
  auditLogs         AuditLog[]
  notifications     Notification[]
  webhooks          Webhook[]

  @@map("users")
}
```

##### Role-Based Access Control
```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  permissions String   // Comma-separated permission strings
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users       User[]

  @@map("roles")
}
```

##### Chat Models
```prisma
model Conversation {
  id          String   @id @default(cuid())
  title       String
  description String?
  isPublic    Boolean  @default(false)
  isArchived  Boolean  @default(false)
  tags        String?  // Comma-separated tag strings
  metadata    String?  // Additional metadata as JSON string
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages    Message[]

  @@map("conversations")
}

model Message {
  id             String   @id @default(cuid())
  content        String
  type           String   @default("text")
  role           String   // user, assistant, system
  isEdited       Boolean  @default(false)
  editedAt       DateTime?
  metadata       String?  // Model settings, file info, etc.
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  parentId       String?
  parent         Message? @relation("MessageThread", fields: [parentId], references: [id])
  replies        Message[] @relation("MessageThread")
  files          MessageFile[]

  @@map("messages")
}
```

##### File Management
```prisma
model File {
  id            String   @id @default(cuid())
  filename      String
  originalName  String
  mimeType      String
  size          Int
  path          String
  url           String?
  purpose       String   @default("general")
  isPublic      Boolean  @default(false)
  metadata      String?
  downloadCount Int      @default(0)
  description   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messageFiles  MessageFile[]

  @@map("files")
}
```

### Database Relationships

1. **User-Centric Design**: Users are central to all operations
2. **Hierarchical Messages**: Support for threaded conversations
3. **File Attachments**: Many-to-many relationship between messages and files
4. **Audit Trail**: Comprehensive logging of all user actions
5. **Session Management**: Multiple active sessions per user

## Authentication & Authorization

### JWT Authentication Flow

```typescript
// JWT Token Structure
interface JWTPayload {
  userId: string
  email: string
  role: string
  permissions: string[]
  sessionId: string
  iat: number
  exp: number
}

// Token Generation
const generateTokens = (user: User, session: Session) => {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions.split(','),
    sessionId: session.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
  }
  
  const accessToken = jwt.sign(payload, JWT_SECRET)
  const refreshToken = jwt.sign(
    { userId: user.id, sessionId: session.id },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  )
  
  return { accessToken, refreshToken }
}
```

### Authentication Middleware

```typescript
const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.split(' ')[1]
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    
    // Verify session is still active
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId, isActive: true },
      include: { user: { include: { role: true } } }
    })
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' })
    }
    
    req.user = session.user
    req.session = session
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

### Role-Based Authorization

```typescript
const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user
    const permissions = user.role.permissions.split(',')
    
    if (!permissions.includes(permission) && !permissions.includes('*')) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    
    next()
  }
}

// Usage
router.delete('/admin/users/:id', 
  authenticateToken,
  requirePermission('users.delete'),
  deleteUser
)
```

### Password Security

```typescript
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// Password strength validation
const validatePassword = (password: string): boolean => {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  return password.length >= minLength && 
         hasUpperCase && 
         hasLowerCase && 
         hasNumbers && 
         hasSpecialChar
}
```

## API Architecture

### RESTful API Design

The API follows REST principles with consistent naming conventions:

```
GET    /api/auth/me                    # Get current user
POST   /api/auth/login                 # User login
POST   /api/auth/register              # User registration
POST   /api/auth/logout                # User logout
POST   /api/auth/refresh               # Refresh tokens
POST   /api/auth/forgot-password       # Password reset request
POST   /api/auth/reset-password        # Password reset

GET    /api/chat/conversations         # List conversations
POST   /api/chat/conversations         # Create conversation
GET    /api/chat/conversations/:id     # Get conversation
PUT    /api/chat/conversations/:id     # Update conversation
DELETE /api/chat/conversations/:id     # Delete conversation
POST   /api/chat/message               # Send message

GET    /api/files/:id                  # Get file info
GET    /api/files/:id/download         # Download file
POST   /api/files/upload               # Upload file
DELETE /api/files/:id                 # Delete file

GET    /api/users/profile              # Get user profile
PUT    /api/users/profile              # Update profile
POST   /api/users/avatar               # Upload avatar
POST   /api/users/change-password      # Change password

GET    /api/admin/dashboard            # Admin dashboard
GET    /api/admin/users                # List users
GET    /api/admin/users/:id            # Get user details
PUT    /api/admin/users/:id            # Update user
DELETE /api/admin/users/:id            # Delete user
```

### Request/Response Patterns

#### Standard Response Format
```typescript
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Success Response
const successResponse = <T>(data: T, message?: string): ApiResponse<T> => ({
  success: true,
  data,
  message
})

// Error Response
const errorResponse = (error: string, statusCode: number = 400): ApiResponse => ({
  success: false,
  error
})
```

#### Pagination
```typescript
interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
}

const paginate = async <T>(
  model: any,
  params: PaginationParams,
  where?: any
) => {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = params
  const skip = (page - 1) * limit
  
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder }
    }),
    model.count({ where })
  ])
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}
```

### Input Validation with Zod

```typescript
// Authentication Schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
})

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number and special character'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required')
})

// Chat Schemas
const sendMessageSchema = z.object({
  conversationId: z.string().cuid('Invalid conversation ID'),
  content: z.string().min(1, 'Message content is required'),
  type: z.enum(['text', 'file', 'image', 'audio']).default('text'),
  files: z.array(z.string().cuid()).optional()
})

// Validation Middleware
const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      }
      next(error)
    }
  }
}
```

## WebSocket Architecture

### Socket.IO Implementation

```typescript
// Socket Server Setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  },
  transports: ['websocket', 'polling']
})

// Authentication Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true }
    })
    
    if (!user) {
      return next(new Error('Authentication failed'))
    }
    
    socket.userId = user.id
    socket.user = user
    next()
  } catch (error) {
    next(new Error('Authentication failed'))
  }
})
```

### Real-time Event Handlers

```typescript
// Connection Handler
io.on('connection', (socket) => {
  console.log(`User ${socket.user.email} connected`)
  
  // Join user to their personal room
  socket.join(`user:${socket.userId}`)
  
  // Join user to their conversation rooms
  socket.on('join-conversation', async (conversationId: string) => {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: socket.userId
      }
    })
    
    if (conversation) {
      socket.join(`conversation:${conversationId}`)
      socket.emit('joined-conversation', conversationId)
    }
  })
  
  // Handle new messages
  socket.on('send-message', async (data: SendMessageData) => {
    try {
      const message = await createMessage({
        ...data,
        userId: socket.userId
      })
      
      // Broadcast to conversation participants
      io.to(`conversation:${data.conversationId}`)
        .emit('new-message', message)
      
      // Process with AI if needed
      if (data.requiresAIResponse) {
        processAIResponse(message)
      }
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' })
    }
  })
  
  // Typing indicators
  socket.on('typing-start', (conversationId: string) => {
    socket.to(`conversation:${conversationId}`)
      .emit('user-typing', {
        userId: socket.userId,
        userName: `${socket.user.firstName} ${socket.user.lastName}`
      })
  })
  
  socket.on('typing-stop', (conversationId: string) => {
    socket.to(`conversation:${conversationId}`)
      .emit('user-stopped-typing', { userId: socket.userId })
  })
  
  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`User ${socket.user.email} disconnected`)
  })
})
```

### AI Integration

```typescript
const processAIResponse = async (userMessage: Message) => {
  try {
    // Emit typing indicator
    io.to(`conversation:${userMessage.conversationId}`)
      .emit('ai-typing', true)
    
    // Get conversation context
    const context = await getConversationContext(userMessage.conversationId)
    
    // Call AI service
    const aiResponse = await callAIService({
      message: userMessage.content,
      context,
      userId: userMessage.userId
    })
    
    // Create AI message
    const aiMessage = await prisma.message.create({
      data: {
        content: aiResponse.content,
        type: 'text',
        role: 'assistant',
        conversationId: userMessage.conversationId,
        userId: userMessage.userId, // Associate with user for tracking
        metadata: JSON.stringify({
          model: aiResponse.model,
          tokens: aiResponse.tokens,
          confidence: aiResponse.confidence
        })
      }
    })
    
    // Stop typing indicator
    io.to(`conversation:${userMessage.conversationId}`)
      .emit('ai-typing', false)
    
    // Broadcast AI response
    io.to(`conversation:${userMessage.conversationId}`)
      .emit('new-message', aiMessage)
      
  } catch (error) {
    console.error('AI processing error:', error)
    
    // Send error message
    const errorMessage = await prisma.message.create({
      data: {
        content: 'I apologize, but I encountered an error processing your request.',
        type: 'error',
        role: 'assistant',
        conversationId: userMessage.conversationId,
        userId: userMessage.userId
      }
    })
    
    io.to(`conversation:${userMessage.conversationId}`)
      .emit('new-message', errorMessage)
  }
}
```

## File Management

### File Upload System

```typescript
import multer from 'multer'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'uploads')
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`
    cb(null, uniqueName)
  }
})

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg', 'audio/wav', 'audio/ogg'
  ]
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('File type not allowed'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// File Upload Handler
const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const file = await prisma.file.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        url: `/api/files/${req.file.filename}`,
        userId: req.user.id,
        purpose: req.body.purpose || 'general'
      }
    })
    
    res.json(successResponse(file, 'File uploaded successfully'))
  } catch (error) {
    console.error('File upload error:', error)
    res.status(500).json({ error: 'File upload failed' })
  }
}
```

### File Security

```typescript
// File Access Control
const downloadFile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    
    const file = await prisma.file.findUnique({
      where: { id },
      include: { user: true }
    })
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    // Check access permissions
    if (!file.isPublic && file.userId !== req.user.id) {
      // Check if user has admin permissions
      const hasAdminAccess = req.user.role.permissions.includes('files.access_all')
      if (!hasAdminAccess) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }
    
    // Increment download count
    await prisma.file.update({
      where: { id },
      data: { downloadCount: { increment: 1 } }
    })
    
    // Set appropriate headers
    res.setHeader('Content-Type', file.mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`)
    
    // Stream file
    const fileStream = fs.createReadStream(file.path)
    fileStream.pipe(res)
    
  } catch (error) {
    console.error('File download error:', error)
    res.status(500).json({ error: 'File download failed' })
  }
}
```

## Error Handling

### Global Error Handler

```typescript
interface AppError extends Error {
  statusCode: number
  isOperational: boolean
}

class AppError extends Error {
  statusCode: number
  isOperational: boolean
  
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    
    Error.captureStackTrace(this, this.constructor)
  }
}

// Global Error Middleware
const globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  let error = { ...err }
  error.message = err.message
  
  // Log error
  logger.error({
    error: err,
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      user: req.user?.id
    }
  })
  
  // Prisma errors
  if (err.code === 'P2002') {
    error = new AppError('Duplicate field value', 400)
  }
  
  if (err.code === 'P2025') {
    error = new AppError('Record not found', 404)
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401)
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401)
  }
  
  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((val: any) => val.message).join(', ')
    error = new AppError(message, 400)
  }
  
  // Send error response
  const statusCode = error.statusCode || 500
  const message = error.isOperational ? error.message : 'Something went wrong'
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
```

## Logging & Monitoring

### Winston Logger Configuration

```typescript
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'va-chat-backend' },
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File logging with rotation
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    
    // Error logging
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD'
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD'
    })
  ]
})
```

### Request Logging

```typescript
import morgan from 'morgan'

// Custom Morgan format
morgan.token('user', (req: any) => req.user?.id || 'anonymous')
morgan.token('body', (req: any) => {
  // Don't log sensitive data
  const sensitiveFields = ['password', 'token', 'secret']
  const body = { ...req.body }
  
  sensitiveFields.forEach(field => {
    if (body[field]) {
      body[field] = '[REDACTED]'
    }
  })
  
  return JSON.stringify(body)
})

const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms - User: :user - Body: :body',
  {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }
)
```

## Security Implementation

### Security Headers

```typescript
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'wss:', 'ws:']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))
```

### Rate Limiting

```typescript
import { RateLimiterRedis } from 'rate-limiter-flexible'

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 60 // Block for 60 seconds if limit exceeded
})

const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.ip
    await rateLimiter.consume(key)
    next()
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1
    res.set('Retry-After', String(secs))
    res.status(429).json({ error: 'Too many requests' })
  }
}

// Stricter rate limiting for auth endpoints
const authRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'auth',
  points: 5, // 5 attempts
  duration: 900, // Per 15 minutes
  blockDuration: 900 // Block for 15 minutes
})
```

### Input Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify'
import validator from 'validator'

const sanitizeInput = (input: string): string => {
  // Remove HTML tags and scripts
  let sanitized = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] })
  
  // Escape special characters
  sanitized = validator.escape(sanitized)
  
  return sanitized.trim()
}

const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key])
      }
    }
  }
  
  next()
}
```

## Performance Optimization

### Database Query Optimization

```typescript
// Efficient conversation loading with pagination
const getConversations = async (userId: string, page: number = 1, limit: number = 20) => {
  return prisma.conversation.findMany({
    where: { userId },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          createdAt: true,
          role: true
        }
      },
      _count: {
        select: { messages: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit
  })
}

// Optimized message loading with cursor-based pagination
const getMessages = async (conversationId: string, cursor?: string, limit: number = 50) => {
  return prisma.message.findMany({
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
              url: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1
    })
  })
}
```

### Caching Strategy

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// Cache frequently accessed data
const getCachedUser = async (userId: string) => {
  const cacheKey = `user:${userId}`
  
  // Try to get from cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }
  
  // If not in cache, get from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true, preferences: true }
  })
  
  if (user) {
    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(user))
  }
  
  return user
}

// Cache invalidation
const invalidateUserCache = async (userId: string) => {
  await redis.del(`user:${userId}`)
}
```

## Health Monitoring

### Health Check Endpoint

```typescript
const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    checks: {
      database: 'unknown',
      redis: 'unknown',
      memory: 'unknown',
      disk: 'unknown'
    }
  }
  
  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`
    health.checks.database = 'healthy'
  } catch (error) {
    health.checks.database = 'unhealthy'
    health.status = 'degraded'
  }
  
  try {
    // Redis check
    await redis.ping()
    health.checks.redis = 'healthy'
  } catch (error) {
    health.checks.redis = 'unhealthy'
    health.status = 'degraded'
  }
  
  // Memory check
  const memUsage = process.memoryUsage()
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100
  health.checks.memory = memUsagePercent < 90 ? 'healthy' : 'warning'
  
  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
}
```

## Deployment Considerations

### Environment Configuration

```typescript
// config/environment.ts
interface Config {
  port: number
  nodeEnv: string
  databaseUrl: string
  redisUrl: string
  jwtSecret: string
  jwtRefreshSecret: string
  corsOrigin: string
  uploadPath: string
  maxFileSize: number
  logLevel: string
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  uploadPath: process.env.UPLOAD_PATH || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  logLevel: process.env.LOG_LEVEL || 'info'
}

export default config
```

### Graceful Shutdown

```typescript
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`)
  
  server.close(() => {
    logger.info('HTTP server closed')
    
    // Close database connections
    prisma.$disconnect().then(() => {
      logger.info('Database connection closed')
      
      // Close Redis connection
      redis.disconnect()
      logger.info('Redis connection closed')
      
      process.exit(0)
    })
  })
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 30000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
```

This backend architecture provides a robust, scalable, and secure foundation for the VA Chat application, with comprehensive error handling, logging, monitoring, and security features.