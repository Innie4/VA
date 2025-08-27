# Use Node.js LTS version
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production image with Nginx
FROM nginx:alpine AS runner

# Install Node.js for health checks
RUN apk add --no-cache nodejs npm wget

# Copy built application to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a simple health check script
RUN echo '#!/bin/sh\nwget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1' > /health-check.sh
RUN chmod +x /health-check.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD /health-check.sh

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]