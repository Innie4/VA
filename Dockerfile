# Multi-stage build for production optimization
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY backend/ ./

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 3: Production runtime
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built backend
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./backend/
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/prisma ./backend/prisma

# Copy built frontend
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist

# Copy environment files
COPY --chown=nodejs:nodejs .env.example .env

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/dist/health-check.js

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/index.js"]