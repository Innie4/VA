# VA Chat - Real-Time Chat Features Setup Guide

This comprehensive guide will walk you through enabling all real-time chat features in your VA Chat application, including PostgreSQL, Redis, Socket.IO, and production deployment.

## 📋 Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- Git installed
- Basic knowledge of TypeScript/JavaScript

## 🗄️ Database Setup & Migrations

### PostgreSQL Installation

#### Option 1: Local Installation (Windows)

1. **Download PostgreSQL:**
   ```bash
   # Download from https://www.postgresql.org/download/windows/
   # Or use Chocolatey
   choco install postgresql
   ```

2. **Start PostgreSQL service:**
   ```bash
   # Start service
   net start postgresql-x64-15
   
   # Connect to PostgreSQL
   psql -U postgres
   ```

3. **Create database:**
   ```sql
   CREATE DATABASE va_chat;
   CREATE USER va_user WITH ENCRYPTED PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE va_chat TO va_user;
   \q
   ```

#### Option 2: Docker (Recommended)

1. **Start PostgreSQL with Docker:**
   ```bash
   docker run --name va-postgres \
     -e POSTGRES_DB=va_chat \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres123 \
     -p 5432:5432 \
     -v postgres_data:/var/lib/postgresql/data \
     -d postgres:15-alpine
   ```

2. **Verify connection:**
   ```bash
   docker exec -it va-postgres psql -U postgres -d va_chat
   ```

### Environment Configuration

1. **Update backend/.env:**
   ```env
   # Database Configuration
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/va_chat"
   DB_MAX_CONNECTIONS=10
   DB_CONNECTION_TIMEOUT=60000
   DB_QUERY_TIMEOUT=30000
   
   # JWT Configuration
   JWT_ACCESS_SECRET="your-super-secret-jwt-key-change-in-production"
   JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
   JWT_ACCESS_EXPIRY="15m"
   JWT_REFRESH_EXPIRY="7d"
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # CORS Configuration
   CORS_ORIGIN="http://localhost:3000,http://localhost:5173"
   ```

### Prisma Database Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Update Prisma schema for PostgreSQL:**
   ```bash
   # Edit prisma/schema.prisma
   ```

4. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

5. **Run database migrations:**
   ```bash
   # Push schema to database (development)
   npx prisma db push
   
   # Or create and run migrations (production)
   npx prisma migrate dev --name init
   ```

6. **Seed the database:**
   ```bash
   npx prisma db seed
   ```

7. **Verify schema creation:**
   ```bash
   npx prisma studio
   # Opens Prisma Studio at http://localhost:5555
   ```

## 🔴 Redis Configuration

### Redis Installation

#### Option 1: Local Installation (Windows)

1. **Install Redis using WSL2:**
   ```bash
   # Install WSL2 first, then:
   wsl --install
   wsl
   sudo apt update
   sudo apt install redis-server
   ```

2. **Start Redis:**
   ```bash
   sudo service redis-server start
   redis-cli ping  # Should return PONG
   ```

#### Option 2: Docker (Recommended)

1. **Start Redis with Docker:**
   ```bash
   docker run --name va-redis \
     -p 6379:6379 \
     -v redis_data:/data \
     -d redis:7-alpine redis-server --appendonly yes
   ```

2. **Test Redis connection:**
   ```bash
   docker exec -it va-redis redis-cli ping
   ```

### Backend Redis Configuration

1. **Update backend/.env:**
   ```env
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0
   REDIS_MAX_RETRIES=3
   REDIS_RETRY_DELAY=100
   REDIS_OFFLINE_QUEUE=false
   REDIS_MAX_MEMORY_POLICY=allkeys-lru
   ```

2. **Enable Redis in backend/src/index.ts:**
   ```typescript
   // Uncomment these lines in index.ts
   
   // Line 22-23: Uncomment database connection
   await prisma.$connect();
   console.log('Database connected successfully');
   
   // Line 25-27: Uncomment Redis initialization
   await initializeRedis();
   console.log('Redis connected successfully');
   ```

## 🔌 Socket.IO Backend Configuration

### Enable Socket.IO in Backend

1. **Update backend/src/index.ts:**
   ```typescript
   // Line 49-50: Uncomment Socket.IO initialization
   const io = initializeSocket(server);
   console.log('Socket.IO initialized successfully');
   
   // Line 185-187: Uncomment Socket.IO in graceful shutdown
   io.close();
   logger.info('Socket.IO server closed');
   
   // Line 306: Update export to include io
   export { app, server, io };
   ```

### Socket.IO Event Handlers

The project already includes comprehensive Socket.IO handlers:

- **Chat Handlers** (`src/socket/chatHandlers.ts`): Message sending, receiving
- **Typing Handlers** (`src/socket/typingHandlers.ts`): Typing indicators
- **Presence Handlers** (`src/socket/presenceHandlers.ts`): User online/offline status

### Example Socket.IO Events

```typescript
// Client to Server Events
socket.emit('send_message', {
  content: 'Hello world!',
  conversationId: 'conv_123',
  files: []
});

socket.emit('typing_start', {
  conversationId: 'conv_123'
});

socket.emit('typing_stop', {
  conversationId: 'conv_123'
});

// Server to Client Events
socket.on('message_received', (data) => {
  console.log('New message:', data);
});

socket.on('typing', (data) => {
  console.log('User typing:', data.isTyping);
});

socket.on('user_online', (data) => {
  console.log('User online:', data.userId);
});
```

## 🌐 Frontend Socket.IO Integration

### Environment Configuration

1. **Update frontend/.env:**
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_SOCKET_URL=http://localhost:3001
   VITE_APP_NAME="VA Chat"
   ```

### Socket.IO Client Usage

The frontend already includes a comprehensive Socket.IO hook:

```typescript
// In your React components
import { useSocketConnection, useSocketMessage } from '@hooks/useSocketConnection';

const ChatComponent = () => {
  const { isConnected, connectionStatus } = useSocketConnection();
  const { sendMessage, sendTyping } = useSocketMessage();
  
  const handleSendMessage = (content: string, conversationId: string) => {
    sendMessage(content, conversationId);
  };
  
  const handleTyping = (conversationId: string, isTyping: boolean) => {
    sendTyping(conversationId, isTyping);
  };
  
  return (
    <div>
      <div>Status: {connectionStatus}</div>
      {/* Your chat UI */}
    </div>
  );
};
```

## 🧪 Testing & Debugging

### Verify WebSocket Events

1. **Backend logging:**
   ```bash
   cd backend
   npm run dev
   # Check logs for Socket.IO connections
   ```

2. **Frontend connection:**
   ```bash
   cd frontend
   npm run dev
   # Open browser dev tools, check Network tab for WebSocket connections
   ```

3. **Test with browser dev tools:**
   ```javascript
   // In browser console
   // Check if socket is connected
   window.socket?.connected
   
   // Send test message
   window.socket?.emit('send_message', {
     content: 'Test message',
     conversationId: 'test_conv'
   });
   ```

### Verify Redis Caching

1. **Check Redis keys:**
   ```bash
   docker exec -it va-redis redis-cli
   KEYS *
   GET session:user_123
   ```

2. **Monitor Redis operations:**
   ```bash
   docker exec -it va-redis redis-cli MONITOR
   ```

### Verify PostgreSQL Data

1. **Check database tables:**
   ```bash
   npx prisma studio
   # Or use psql
   docker exec -it va-postgres psql -U postgres -d va_chat
   \dt  # List tables
   SELECT * FROM users LIMIT 5;
   SELECT * FROM conversations LIMIT 5;
   SELECT * FROM messages LIMIT 5;
   ```

### Debug Common Issues

1. **CORS Issues:**
   ```typescript
   // Update backend/src/index.ts CORS configuration
   app.use(cors({
     origin: ['http://localhost:3000', 'http://localhost:5173'],
     credentials: true,
     methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
   }));
   ```

2. **Connection Lost Issues:**
   ```typescript
   // Check Socket.IO client configuration
   const socket = io(SOCKET_URL, {
     auth: { token },
     timeout: 20000,
     reconnection: true,
     reconnectionAttempts: 5,
     reconnectionDelay: 1000,
     transports: ['websocket', 'polling'],
   });
   ```

3. **Authentication Issues:**
   ```bash
   # Check JWT token in browser localStorage
   localStorage.getItem('auth-token')
   
   # Verify token on backend
   curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/auth/verify
   ```

## 🚀 Production Deployment

### Docker Compose Setup

1. **Update docker-compose.yml:**
   ```yaml
   version: '3.8'
   
   services:
     redis:
       image: redis:7-alpine
       restart: unless-stopped
       ports:
         - "6379:6379"
       volumes:
         - redis_data:/data
       command: redis-server --appendonly yes
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 30s
         timeout: 3s
         retries: 3
   
     postgres:
       image: postgres:15-alpine
       restart: unless-stopped
       environment:
         POSTGRES_DB: va_chat
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres123}
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U postgres"]
         interval: 30s
         timeout: 5s
         retries: 3
   
     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile
       restart: unless-stopped
       ports:
         - "3001:3001"
       environment:
         NODE_ENV: production
         DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/va_chat
         REDIS_HOST: redis
         REDIS_PORT: 6379
         JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
         JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
         CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:3000}
       depends_on:
         redis:
           condition: service_healthy
         postgres:
           condition: service_healthy
       volumes:
         - app_logs:/app/logs
   
     frontend:
       build:
         context: ./frontend
         dockerfile: Dockerfile
       restart: unless-stopped
       ports:
         - "3000:3000"
       environment:
         VITE_API_URL: http://localhost:3001
         VITE_SOCKET_URL: http://localhost:3001
       depends_on:
         - backend
   
     nginx:
       image: nginx:alpine
       restart: unless-stopped
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf:ro
         - ./ssl:/etc/nginx/ssl:ro
       depends_on:
         - frontend
         - backend
   
   volumes:
     redis_data:
     postgres_data:
     app_logs:
   ```

2. **Create production .env:**
   ```env
   # .env.production
   POSTGRES_PASSWORD=your_secure_postgres_password
   JWT_ACCESS_SECRET=your_super_secure_jwt_access_secret_256_bits
   JWT_REFRESH_SECRET=your_super_secure_jwt_refresh_secret_256_bits
   CORS_ORIGIN=https://yourdomain.com
   OPENAI_API_KEY=your_openai_api_key
   ```

### Scaling Socket.IO with Redis Adapter

1. **Install Redis adapter:**
   ```bash
   cd backend
   npm install @socket.io/redis-adapter redis
   ```

2. **Update Socket.IO configuration:**
   ```typescript
   // backend/src/socket/index.ts
   import { createAdapter } from '@socket.io/redis-adapter';
   import { createClient } from 'redis';
   
   export function initializeSocket(server: HTTPServer): SocketIOServer {
     const io = new SocketIOServer(server, {
       cors: {
         origin: config.cors.origin,
         methods: ['GET', 'POST'],
         credentials: true,
       },
       transports: ['websocket', 'polling'],
     });
   
     // Redis adapter for scaling
     const pubClient = createClient({ 
       host: config.redis.host, 
       port: config.redis.port 
     });
     const subClient = pubClient.duplicate();
   
     Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
       io.adapter(createAdapter(pubClient, subClient));
       console.log('Socket.IO Redis adapter initialized');
     });
   
     // ... rest of configuration
   }
   ```

### Security Best Practices

1. **Environment Variables:**
   ```bash
   # Generate secure secrets
   openssl rand -base64 32  # For JWT secrets
   openssl rand -base64 16  # For session secrets
   ```

2. **Rate Limiting:**
   ```typescript
   // Already implemented in middleware/rateLimiter.ts
   // Adjust limits in .env
   RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
   RATE_LIMIT_MAX_REQUESTS=100  # 100 requests per window
   ```

3. **HTTPS Configuration:**
   ```nginx
   # nginx.conf
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /etc/nginx/ssl/cert.pem;
       ssl_certificate_key /etc/nginx/ssl/key.pem;
       
       location / {
           proxy_pass http://frontend:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api {
           proxy_pass http://backend:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /socket.io/ {
           proxy_pass http://backend:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🚀 Quick Start Commands

### Development Setup

```bash
# 1. Start services with Docker
docker-compose up -d redis postgres

# 2. Setup backend
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev

# 3. Setup frontend (new terminal)
cd frontend
npm install
npm run dev

# 4. Open browser
# Frontend: http://localhost:5173
# Backend API: http://localhost:3001
# Prisma Studio: npx prisma studio
```

### Production Deployment

```bash
# 1. Clone and configure
git clone <your-repo>
cd va-chat
cp .env.example .env.production
# Edit .env.production with your values

# 2. Deploy with Docker Compose
docker-compose --env-file .env.production up -d

# 3. Run migrations
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma db seed

# 4. Check status
docker-compose ps
docker-compose logs -f
```

## 🔍 Monitoring & Logs

1. **Application logs:**
   ```bash
   # Development
   tail -f backend/logs/app-$(date +%Y-%m-%d).log
   
   # Production
   docker-compose logs -f backend
   ```

2. **Database monitoring:**
   ```sql
   -- Check active connections
   SELECT count(*) FROM pg_stat_activity;
   
   -- Check table sizes
   SELECT schemaname,tablename,attname,n_distinct,correlation FROM pg_stats;
   ```

3. **Redis monitoring:**
   ```bash
   docker exec -it va-redis redis-cli INFO
   docker exec -it va-redis redis-cli CLIENT LIST
   ```

## 🎯 Next Steps

1. **Customize Socket.IO events** for your specific use cases
2. **Implement file upload** for chat attachments
3. **Add push notifications** for mobile users
4. **Set up monitoring** with tools like Prometheus/Grafana
5. **Implement horizontal scaling** with multiple backend instances
6. **Add end-to-end encryption** for sensitive conversations

## 🆘 Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   netstat -ano | findstr :3001
   netstat -ano | findstr :5173
   netstat -ano | findstr :5432
   netstat -ano | findstr :6379
   ```

2. **Permission issues:**
   ```bash
   # Windows
   icacls uploads /grant Everyone:F
   
   # Docker volumes
   docker volume ls
   docker volume inspect va_postgres_data
   ```

3. **Memory issues:**
   ```bash
   # Check Docker memory usage
   docker stats
   
   # Increase Docker memory limit
   # Docker Desktop > Settings > Resources > Memory
   ```

This guide provides everything you need to enable real-time chat features in your VA Chat application. Follow the steps in order, and you'll have a fully functional real-time chat system with PostgreSQL, Redis, and Socket.IO working seamlessly together.