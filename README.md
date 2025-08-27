# VA Chat - Enterprise Virtual Assistant

A modern, enterprise-grade conversational AI platform built with React, Node.js, and OpenAI integration. This full-stack application provides a sophisticated chat interface with advanced features for both users and administrators.

## 🚀 Features

### Frontend
- **Modern React 18** with TypeScript and Vite
- **Material-UI v5** with dark mode support
- **Real-time messaging** with WebSocket integration
- **Voice recognition** using Web Speech API
- **File upload** support for images and documents
- **Progressive Web App** (PWA) capabilities
- **Responsive design** for mobile and desktop
- **Accessibility features** with ARIA support
- **Internationalization** (i18n) ready

### Backend
- **Node.js + Express** with TypeScript
- **OpenAI GPT-4** integration with streaming responses
- **WebSocket server** using Socket.io
- **JWT authentication** with refresh tokens
- **Prisma ORM** with PostgreSQL/SQLite support
- **Redis integration** for session storage
- **Rate limiting** and security middleware
- **Comprehensive logging** with Winston
- **Health checks** and monitoring
- **OpenAPI documentation**

### Production Features
- **Docker containerization** with multi-stage builds
- **Nginx reverse proxy** with SSL termination
- **Security headers** and CORS configuration
- **Database migrations** and seeding
- **Environment-based configuration**
- **Clustering support** for high availability

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 15+ (for production) or SQLite (for development)
- **Redis** 7+ (optional, for production)
- **Docker** and Docker Compose (for containerized deployment)
- **OpenAI API key**

## 🛠️ Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd VA
npm install
```

### 2. Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Edit the .env files with your configuration
# Required: OPENAI_API_KEY
```

### 3. Database Setup

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Seed the database
npm run db:seed
```

### 4. Start Development Servers

```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api-docs

### Default Accounts

- **Admin**: admin@ai-chat.com / admin123!
- **Demo**: demo@ai-chat.com / demo123!

## 🐳 Docker Deployment

### Development with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment

```bash
# Copy production environment
cp .env.production .env

# Edit .env with your production values
# Important: Change all secrets and passwords!

# Start with production profile
docker-compose --profile production up -d
```

## 📁 Project Structure

```
VA/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── store/           # Zustand state management
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript type definitions
│   │   ├── theme/           # Material-UI theme configuration
│   │   └── i18n/            # Internationalization
│   ├── public/              # Static assets
│   └── package.json
├── backend/                  # Node.js backend application
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── socket/          # WebSocket handlers
│   │   ├── utils/           # Utility functions
│   │   ├── config/          # Configuration files
│   │   └── schemas/         # Validation schemas
│   ├── prisma/              # Database schema and migrations
│   └── package.json
├── docker-compose.yml        # Docker services configuration
├── Dockerfile               # Multi-stage Docker build
├── nginx.conf               # Nginx configuration
└── README.md
```

## 🔧 Configuration

### Environment Variables

Key environment variables to configure:

```bash
# Required
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/va_chat

# Optional
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=https://yourdomain.com
```

### Database Configuration

**PostgreSQL (Recommended for Production)**
```bash
DATABASE_URL="postgresql://username:password@localhost:5432/va_chat?schema=public"
```

**SQLite (Development)**
```bash
DATABASE_URL="file:./dev.db"
```

## 🚀 Deployment

### Manual Deployment

1. **Build the application**
   ```bash
   # Build frontend
   cd frontend
   npm run build
   
   # Build backend
   cd ../backend
   npm run build
   ```

2. **Set up production database**
   ```bash
   npm run db:migrate:prod
   npm run db:seed:prod
   ```

3. **Start the application**
   ```bash
   npm start
   ```

### Docker Deployment

1. **Build and run with Docker Compose**
   ```bash
   docker-compose --profile production up -d
   ```

2. **SSL Configuration**
   - Place SSL certificates in `./ssl/` directory
   - Update `nginx.conf` with your domain
   - Restart Nginx: `docker-compose restart nginx`

### Cloud Deployment

**AWS/GCP/Azure**
- Use the provided Dockerfile for container deployment
- Configure environment variables in your cloud platform
- Set up managed PostgreSQL and Redis services
- Configure load balancer and SSL termination

## 🔒 Security

### Production Security Checklist

- [ ] Change all default secrets and passwords
- [ ] Use strong JWT secrets (min 32 characters)
- [ ] Configure CORS for your domain
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Set up rate limiting
- [ ] Configure security headers
- [ ] Use environment variables for secrets
- [ ] Enable database connection encryption
- [ ] Set up monitoring and logging
- [ ] Regular security updates

### Security Features

- **JWT Authentication** with refresh tokens
- **Rate limiting** on API endpoints
- **CORS protection** with configurable origins
- **Security headers** (HSTS, CSP, X-Frame-Options)
- **Input validation** and sanitization
- **SQL injection protection** via Prisma ORM
- **XSS protection** with Content Security Policy

## 📊 Monitoring

### Health Checks

- **Health endpoint**: `/api/health`
- **Readiness probe**: `/api/ready`
- **Liveness probe**: `/api/live`

### Logging

- **Winston logger** with multiple transports
- **Structured logging** with JSON format
- **Log rotation** and archival
- **Error tracking** and alerting

### Metrics

- **Application metrics** via health endpoints
- **Database connection monitoring**
- **Redis connection status**
- **Memory and CPU usage**

## 🧪 Testing

```bash
# Run frontend tests
cd frontend
npm test

# Run backend tests
cd backend
npm test

# Run e2e tests
npm run test:e2e
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 API Documentation

Interactive API documentation is available at `/api-docs` when running the backend server.

### Key Endpoints

- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/chat/conversations` - Get user conversations
- `POST /api/chat/message` - Send a message
- `GET /api/health` - Health check

## 🔧 Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Check database status
npm run db:status

# Reset database
npm run db:reset
```

**OpenAI API Issues**
- Verify your API key is valid
- Check your OpenAI account usage limits
- Ensure the model (GPT-4) is available

**WebSocket Connection Issues**
- Check CORS configuration
- Verify WebSocket transports are enabled
- Check firewall settings

### Logs

```bash
# View application logs
tail -f backend/logs/app.log

# View error logs
tail -f backend/logs/error.log

# Docker logs
docker-compose logs -f app
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for the GPT-4 API
- Material-UI team for the excellent component library
- Prisma team for the amazing ORM
- All open-source contributors

---

**Built with ❤️ using modern web technologies**