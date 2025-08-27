# VA Chat - Comprehensive Project Documentation

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Features](#features)
6. [Installation & Setup](#installation--setup)
7. [Configuration](#configuration)
8. [API Documentation](#api-documentation)
9. [Frontend Components](#frontend-components)
10. [Backend Services](#backend-services)
11. [Database Schema](#database-schema)
12. [Security](#security)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)
16. [Contributing](#contributing)
17. [Known Issues](#known-issues)

## 🎯 Project Overview

VA Chat is an enterprise-grade virtual assistant application built with modern web technologies. It provides real-time chat functionality with AI-powered responses, voice recognition, file uploads, and comprehensive user management.

### Key Capabilities
- **AI-Powered Conversations**: Integration with OpenAI GPT models
- **Real-time Communication**: WebSocket-based chat with Socket.IO
- **Voice Recognition**: Browser-based speech-to-text functionality
- **File Management**: Secure file upload and sharing
- **Multi-language Support**: Internationalization with i18next
- **Responsive Design**: Mobile-first UI with Material-UI
- **Enterprise Security**: JWT authentication, rate limiting, and data sanitization

## 🏗️ Architecture

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│  (PostgreSQL)   │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Express.js    │    │ • Prisma ORM    │
│ • TypeScript    │    │ • Socket.IO     │    │ • Redis Cache   │
│ • Material-UI   │    │ • OpenAI API    │    │                 │
│ • Zustand       │    │ • JWT Auth      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Communication Flow
1. **HTTP Requests**: REST API for authentication, user management, and file operations
2. **WebSocket Connections**: Real-time chat messages and typing indicators
3. **AI Processing**: OpenAI API integration for intelligent responses
4. **Data Persistence**: PostgreSQL for structured data, Redis for sessions

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Material-UI (MUI)** - Comprehensive React component library
- **Zustand** - Lightweight state management
- **React Router** - Client-side routing
- **i18next** - Internationalization framework
- **Socket.IO Client** - Real-time communication
- **Vite** - Fast build tool and development server
- **Vitest** - Unit testing framework

### Backend
- **Node.js** - JavaScript runtime environment
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **Socket.IO** - Real-time bidirectional communication
- **Prisma** - Modern database toolkit and ORM
- **OpenAI API** - AI-powered chat responses
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Password hashing
- **Joi** - Data validation
- **Winston** - Logging framework
- **Jest** - Testing framework

### Database & Infrastructure
- **PostgreSQL** - Primary relational database
- **Redis** - Session storage and caching
- **Docker** - Containerization
- **Nginx** - Reverse proxy and load balancing

## 📁 Project Structure

```
VA/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── chat/        # Chat-specific components
│   │   │   ├── common/      # Shared components
│   │   │   └── layout/      # Layout components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── pages/           # Page components
│   │   ├── store/           # Zustand state management
│   │   ├── theme/           # Material-UI theme configuration
│   │   ├── types/           # TypeScript type definitions
│   │   └── i18n/            # Internationalization
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Node.js backend application
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API route definitions
│   │   ├── socket/          # Socket.IO event handlers
│   │   ├── utils/           # Utility functions
│   │   ├── config/          # Configuration files
│   │   └── schemas/         # Validation schemas
│   ├── prisma/              # Database schema and migrations
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml        # Docker services configuration
├── Dockerfile               # Multi-stage Docker build
├── nginx.conf               # Nginx configuration
└── package.json             # Root package configuration
```

## ✨ Features

### Core Features
1. **Real-time Chat**
   - Instant messaging with WebSocket connections
   - Typing indicators and online status
   - Message history and conversation management
   - File attachments and media sharing

2. **AI Assistant**
   - OpenAI GPT integration for intelligent responses
   - Configurable system prompts and personality
   - Context-aware conversations
   - Streaming responses for better UX

3. **Voice Recognition**
   - Browser-based speech-to-text
   - Voice commands and dictation
   - Multi-language voice support
   - Audio feedback and controls

4. **User Management**
   - Secure authentication with JWT
   - User profiles and preferences
   - Role-based access control
   - Session management

5. **File Management**
   - Secure file upload and storage
   - File type validation and size limits
   - Image preview and thumbnails
   - Download and sharing capabilities

### Advanced Features
1. **Internationalization**
   - Multi-language support (English, Spanish, French)
   - Dynamic language switching
   - Localized date and time formats
   - RTL language support

2. **Accessibility**
   - WCAG 2.1 compliance
   - Keyboard navigation
   - Screen reader support
   - High contrast themes

3. **Performance**
   - Code splitting and lazy loading
   - Image optimization
   - Caching strategies
   - Bundle size optimization

## 🚀 Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+
- Redis 7+
- OpenAI API key

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd VA
```

2. **Install dependencies**
```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

3. **Environment setup**
```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Configure your environment variables
# Edit backend/.env with your database and API keys
```

4. **Database setup**
```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

5. **Start development servers**
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Docker Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## ⚙️ Configuration

### Environment Variables

#### Backend Configuration
```env
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/va_chat

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2048
OPENAI_TEMPERATURE=0.7

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### Frontend Configuration

The frontend configuration is handled through Vite environment variables and can be customized in `vite.config.ts`.

## 📡 API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

#### POST /api/auth/login
Authenticate user and receive tokens.

#### POST /api/auth/refresh
Refresh access token using refresh token.

#### POST /api/auth/logout
Invalidate user session and tokens.

### Chat Endpoints

#### GET /api/chat/conversations
Retrieve user's conversation history.

#### POST /api/chat/conversations
Create a new conversation.

#### GET /api/chat/conversations/:id/messages
Get messages for a specific conversation.

#### POST /api/chat/message
Send a new message (also available via WebSocket).

### File Endpoints

#### POST /api/files/upload
Upload files with multipart/form-data.

#### GET /api/files/:id
Download or view uploaded files.

### WebSocket Events

#### Client to Server
- `join_conversation` - Join a conversation room
- `send_message` - Send a chat message
- `typing_start` - Indicate user is typing
- `typing_stop` - Stop typing indicator

#### Server to Client
- `message_received` - New message in conversation
- `user_typing` - Another user is typing
- `user_stopped_typing` - User stopped typing
- `connection_status` - Connection state updates

## 🎨 Frontend Components

### Core Components

#### ChatContainer
Main chat interface component that manages conversation state and message rendering.

**Props:**
```typescript
interface ChatContainerProps {
  conversationId?: string;
  onConversationChange?: (id: string) => void;
}
```

#### ChatInput
Message input component with file upload and voice recognition.

**Features:**
- Rich text input with emoji support
- File drag-and-drop
- Voice recording and transcription
- Send button with loading states

#### ConversationSidebar
Sidebar component for conversation history and management.

**Features:**
- Conversation list with search
- New conversation creation
- Conversation deletion and archiving
- Real-time updates

### Utility Components

#### LoadingSpinner
Reusable loading component with multiple variants.

#### ErrorBoundary
Error boundary for graceful error handling.

#### ConnectionStatus
Real-time connection status indicator.

## 🔧 Backend Services

### Core Services

#### AuthController
Handles user authentication, registration, and session management.

**Key Methods:**
- `register()` - User registration with validation
- `login()` - User authentication
- `refreshToken()` - Token refresh logic
- `logout()` - Session invalidation

#### ChatController
Manages chat functionality and AI integration.

**Key Methods:**
- `sendMessage()` - Process and store messages
- `getConversations()` - Retrieve conversation history
- `streamResponse()` - Handle streaming AI responses

#### FileController
Handles file upload, storage, and retrieval.

**Features:**
- Secure file validation
- Storage management
- Access control
- Metadata extraction

### Middleware

#### Authentication Middleware
Validates JWT tokens and manages user sessions.

#### Rate Limiting
Prevents abuse with configurable rate limits.

#### Error Handling
Centralized error processing and logging.

#### Validation
Request validation using Joi schemas.

## 🗄️ Database Schema

### User Model
```sql
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("id")
);
```

### Conversation Model
```sql
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "userId" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("id")
);
```

### Message Model
```sql
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);
```

## 🔒 Security

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Secure password hashing with bcrypt
- Session management with Redis

### Data Protection
- Input validation and sanitization
- SQL injection prevention with Prisma
- XSS protection with DOMPurify
- CSRF protection with SameSite cookies

### Infrastructure Security
- HTTPS enforcement
- Security headers with Helmet.js
- Rate limiting and DDoS protection
- File upload validation and scanning

### Best Practices
- Environment variable management
- Secrets rotation
- Audit logging
- Regular security updates

## 🧪 Testing

### Frontend Testing
- **Unit Tests**: Vitest for component and utility testing
- **Integration Tests**: React Testing Library
- **E2E Tests**: Planned Cypress implementation

### Backend Testing
- **Unit Tests**: Jest for service and utility testing
- **Integration Tests**: Supertest for API testing
- **Database Tests**: In-memory SQLite for testing

### Testing Commands
```bash
# Frontend tests
cd frontend
npm run test
npm run test:coverage
npm run test:ui

# Backend tests
cd backend
npm run test
npm run test:watch
npm run test:coverage
```

## 🚀 Deployment

### Production Deployment

#### Docker Deployment
```bash
# Build and start production containers
docker-compose -f docker-compose.yml up -d

# Scale services
docker-compose up -d --scale app=3
```

#### Manual Deployment
```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build

# Run database migrations
cd backend && npm run db:migrate:prod

# Start production server
cd backend && npm start
```

### Environment-Specific Configurations

#### Development
- Hot reloading enabled
- Debug logging
- Development database

#### Staging
- Production-like environment
- Limited logging
- Staging database

#### Production
- Optimized builds
- Error-only logging
- Production database
- SSL/TLS enabled

## 🔧 Troubleshooting

### Common Issues

#### Connection Lost Error
**Symptoms**: "Connection lost" message in chat interface

**Possible Causes:**
1. Backend server not running
2. WebSocket connection failed
3. Network connectivity issues
4. CORS configuration problems

**Solutions:**
1. Check backend server status: `npm run dev` in backend directory
2. Verify WebSocket endpoint configuration
3. Check browser console for connection errors
4. Validate CORS_ORIGIN environment variable

#### Database Connection Issues
**Symptoms**: Database connection errors in logs

**Solutions:**
1. Verify DATABASE_URL in environment variables
2. Ensure PostgreSQL is running
3. Check database credentials and permissions
4. Run `npx prisma db push` to sync schema

#### Authentication Problems
**Symptoms**: Login failures or token errors

**Solutions:**
1. Verify JWT_SECRET configuration
2. Check token expiration settings
3. Clear browser localStorage and cookies
4. Validate user credentials in database

### Debugging Tips

1. **Enable Debug Logging**
   ```env
   LOG_LEVEL=debug
   ```

2. **Check Server Logs**
   ```bash
   tail -f backend/logs/app.log
   ```

3. **Monitor Network Traffic**
   - Use browser DevTools Network tab
   - Check WebSocket connections
   - Verify API response codes

4. **Database Debugging**
   ```bash
   npx prisma studio
   ```

## 🤝 Contributing

### Development Workflow

1. **Fork and Clone**
   ```bash
   git clone <your-fork-url>
   cd VA
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow coding standards
   - Add tests for new features
   - Update documentation

4. **Test Changes**
   ```bash
   npm run test
   npm run lint
   ```

5. **Submit Pull Request**
   - Provide clear description
   - Include test coverage
   - Update relevant documentation

### Coding Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Automatic code formatting
- **Conventional Commits**: Standardized commit messages

## ⚠️ Known Issues

### Current Limitations

1. **Testing Infrastructure**
   - Missing Jest configuration for backend
   - No actual test files implemented
   - No CI/CD pipeline configured

2. **Security Concerns**
   - Hardcoded demo credentials in development
   - Default JWT secrets in Docker configuration
   - Missing security headers in some configurations

3. **Performance Issues**
   - No code splitting implemented
   - Large bundle sizes
   - Missing caching strategies

4. **Documentation Gaps**
   - Incomplete API documentation
   - Missing deployment guides for specific environments
   - No troubleshooting documentation for complex scenarios

### Planned Improvements

1. **Enhanced Testing**
   - Complete test suite implementation
   - CI/CD pipeline setup
   - End-to-end testing with Cypress

2. **Performance Optimization**
   - Code splitting and lazy loading
   - Bundle size optimization
   - Caching implementation

3. **Security Enhancements**
   - Security audit and fixes
   - Automated vulnerability scanning
   - Enhanced authentication options

4. **Feature Additions**
   - Mobile app development
   - Advanced AI features
   - Enterprise integrations

---

## 📞 Support

For technical support or questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation
- Consult the developer guide

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

---

*Last updated: January 2025*
*Version: 1.0.0*