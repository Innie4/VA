# Deployment Guide

This guide covers various deployment scenarios for the VA Chat application, from local development to production cloud deployment.

## 📋 Prerequisites

### Required
- Node.js 18+ and npm
- OpenAI API key
- Git

### Production Requirements
- PostgreSQL 15+
- Redis 7+ (recommended)
- SSL certificate
- Domain name

### Optional
- Docker and Docker Compose
- Nginx (for reverse proxy)
- Cloud provider account (AWS, GCP, Azure)

## 🚀 Deployment Options

### 1. Local Development

#### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd VA

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Set up database
cd ../backend
npm run db:migrate
npm run db:seed

# Start development servers
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd ../frontend
npm run dev
```

#### Environment Configuration
Edit `.env` and `backend/.env` with your settings:
```bash
# Required
OPENAI_API_KEY=your-openai-api-key

# Optional (defaults work for development)
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-dev-jwt-secret"
```

### 2. Docker Development

#### Using Docker Compose
```bash
# Clone and setup
git clone <repository-url>
cd VA
cp .env.example .env

# Edit .env with your OpenAI API key
vim .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

#### Services Included
- **app**: Main application (frontend + backend)
- **postgres**: PostgreSQL database
- **redis**: Redis cache
- **nginx**: Reverse proxy (production profile)

### 3. Production Deployment

#### Manual Production Setup

**Step 1: Server Preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server

# Install Nginx
sudo apt install nginx

# Install PM2 for process management
npm install -g pm2
```

**Step 2: Database Setup**
```bash
# Create database user
sudo -u postgres createuser --interactive
# Enter username: va_chat
# Superuser: n
# Create databases: y
# Create roles: n

# Create database
sudo -u postgres createdb va_chat

# Set password
sudo -u postgres psql
ALTER USER va_chat PASSWORD 'your-secure-password';
\q
```

**Step 3: Application Setup**
```bash
# Clone repository
git clone <repository-url> /var/www/va-chat
cd /var/www/va-chat

# Copy and configure environment
cp .env.production .env
vim .env
# Update all configuration values

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Build applications
cd ../frontend
npm run build

cd ../backend
npm run build

# Run database migrations
npm run db:migrate:prod
npm run db:seed:prod
```

**Step 4: Process Management**
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'va-chat-backend',
    script: './backend/dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

**Step 5: Nginx Configuration**
```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/va-chat << EOF
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.com.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.com.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    root /var/www/va-chat/frontend/dist;
    index index.html;

    # Frontend
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/va-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Docker Production Deployment

**Step 1: Server Setup**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Step 2: Application Deployment**
```bash
# Clone repository
git clone <repository-url> /opt/va-chat
cd /opt/va-chat

# Configure environment
cp .env.production .env
vim .env
# Update all production values

# Create SSL directory
mkdir -p ssl
# Copy your SSL certificates to ssl/

# Deploy with production profile
docker-compose --profile production up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### 4. Cloud Deployment

#### AWS Deployment

**Using AWS ECS with Fargate**

1. **Build and Push Docker Image**
```bash
# Build image
docker build -t va-chat .

# Tag for ECR
docker tag va-chat:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/va-chat:latest

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/va-chat:latest
```

2. **Create ECS Task Definition**
```json
{
  "family": "va-chat",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "va-chat",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/va-chat:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "DATABASE_URL", "value": "postgresql://user:pass@rds-endpoint:5432/va_chat"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/va-chat",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

3. **Set up RDS and ElastiCache**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier va-chat-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password YourSecurePassword \
  --allocated-storage 20

# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id va-chat-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

#### Google Cloud Platform

**Using Cloud Run**

1. **Build and Deploy**
```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT-ID/va-chat

# Deploy to Cloud Run
gcloud run deploy va-chat \
  --image gcr.io/PROJECT-ID/va-chat \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,DATABASE_URL=postgresql://...
```

2. **Set up Cloud SQL and Memorystore**
```bash
# Create Cloud SQL PostgreSQL instance
gcloud sql instances create va-chat-db \
  --database-version POSTGRES_15 \
  --tier db-f1-micro \
  --region us-central1

# Create Memorystore Redis instance
gcloud redis instances create va-chat-redis \
  --size 1 \
  --region us-central1
```

#### Azure Deployment

**Using Container Instances**

1. **Create Resource Group**
```bash
az group create --name va-chat-rg --location eastus
```

2. **Deploy Container**
```bash
az container create \
  --resource-group va-chat-rg \
  --name va-chat \
  --image your-registry/va-chat:latest \
  --cpu 1 \
  --memory 2 \
  --ports 3001 \
  --environment-variables NODE_ENV=production DATABASE_URL=postgresql://...
```

## 🔧 Configuration

### Environment Variables

**Critical Production Settings**
```bash
# Security (MUST change)
JWT_SECRET="your-super-secure-jwt-secret-min-32-chars"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret-min-32-chars"
SESSION_SECRET="your-super-secure-session-secret-min-32-chars"

# Database
DATABASE_URL="postgresql://username:password@host:5432/database"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"

# CORS
CORS_ORIGIN="https://yourdomain.com"
```

### SSL/TLS Setup

**Let's Encrypt (Free SSL)**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

**Custom SSL Certificate**
```bash
# Copy certificates
sudo cp yourdomain.com.crt /etc/ssl/certs/
sudo cp yourdomain.com.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/yourdomain.com.key
```

## 📊 Monitoring and Maintenance

### Health Checks
```bash
# Application health
curl https://yourdomain.com/api/health

# Database connectivity
curl https://yourdomain.com/api/ready

# Service status
curl https://yourdomain.com/api/live
```

### Logging
```bash
# Application logs
tail -f /var/www/va-chat/logs/app.log

# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Docker logs
docker-compose logs -f
```

### Backup
```bash
# Database backup
pg_dump -h localhost -U va_chat va_chat > backup_$(date +%Y%m%d_%H%M%S).sql

# Application backup
tar -czf va-chat-backup-$(date +%Y%m%d).tar.gz /var/www/va-chat
```

### Updates
```bash
# Pull latest code
cd /var/www/va-chat
git pull origin main

# Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# Build applications
cd ../frontend && npm run build
cd ../backend && npm run build

# Run migrations
cd ../backend && npm run db:migrate:prod

# Restart application
pm2 restart all
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U va_chat -d va_chat

# Check firewall
sudo ufw status
```

**Application Won't Start**
```bash
# Check PM2 status
pm2 status
pm2 logs

# Check environment variables
cat .env

# Check port availability
sudo netstat -tlnp | grep :3001
```

**SSL Certificate Issues**
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/certs/yourdomain.com.crt -text -noout

# Test SSL configuration
ssl-cert-check -c /etc/ssl/certs/yourdomain.com.crt
```

**High Memory Usage**
```bash
# Check memory usage
free -h
top

# Restart application
pm2 restart all

# Check for memory leaks
pm2 monit
```

### Performance Optimization

**Database Optimization**
```sql
-- Create indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM messages WHERE conversation_id = 'uuid';
```

**Application Optimization**
```bash
# Enable gzip compression in Nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# Configure caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 📞 Support

For deployment issues:
1. Check the troubleshooting section
2. Review application logs
3. Verify environment configuration
4. Check service status and connectivity

---

**Remember to always test deployments in a staging environment first!**

## 🔄 CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Run backend tests
        run: |
          cd backend
          npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      
      - name: Run frontend tests
        run: |
          cd frontend
          npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          directory: ./coverage
  
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          npm ci
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Build applications
        run: |
          cd frontend && npm run build
          cd ../backend && npm run build
      
      - name: Build Docker image
        run: |
          docker build -t va-chat:${{ github.sha }} .
          docker tag va-chat:${{ github.sha }} va-chat:latest
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Push Docker image
        run: |
          docker push va-chat:${{ github.sha }}
          docker push va-chat:latest
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/va-chat
            docker-compose pull
            docker-compose up -d
            docker system prune -f
```

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

services:
  - docker:dind
  - postgres:15
  - redis:7

variables:
  POSTGRES_DB: test_db
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  REDIS_URL: redis://redis:6379

test:
  stage: test
  image: node:18
  before_script:
    - npm ci
    - cd backend && npm ci
    - cd ../frontend && npm ci
  script:
    - cd backend && npm run test:coverage
    - cd ../frontend && npm run test:coverage
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:latest
  only:
    - main
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE:latest

deploy:
  stage: deploy
  image: alpine:latest
  only:
    - main
  before_script:
    - apk add --no-cache openssh-client
    - eval $(ssh-agent -s)
    - echo "$SSH_PRIVATE_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh
    - chmod 700 ~/.ssh
    - ssh-keyscan $DEPLOY_HOST >> ~/.ssh/known_hosts
    - chmod 644 ~/.ssh/known_hosts
  script:
    - ssh $DEPLOY_USER@$DEPLOY_HOST "cd /opt/va-chat && docker-compose pull && docker-compose up -d"
```

## 🌐 Advanced Cloud Deployments

### Kubernetes Deployment

**Namespace and ConfigMap**
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: va-chat

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: va-chat-config
  namespace: va-chat
data:
  NODE_ENV: "production"
  PORT: "3001"
  CORS_ORIGIN: "https://yourdomain.com"
```

**Secrets**
```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: va-chat-secrets
  namespace: va-chat
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  JWT_SECRET: <base64-encoded-jwt-secret>
  OPENAI_API_KEY: <base64-encoded-openai-key>
```

**Deployment**
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: va-chat
  namespace: va-chat
spec:
  replicas: 3
  selector:
    matchLabels:
      app: va-chat
  template:
    metadata:
      labels:
        app: va-chat
    spec:
      containers:
      - name: va-chat
        image: va-chat:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: va-chat-config
        - secretRef:
            name: va-chat-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Service and Ingress**
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: va-chat-service
  namespace: va-chat
spec:
  selector:
    app: va-chat
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: va-chat-ingress
  namespace: va-chat
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - yourdomain.com
    secretName: va-chat-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: va-chat-service
            port:
              number: 80
```

**Deploy to Kubernetes**
```bash
# Apply all configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n va-chat
kubectl get services -n va-chat
kubectl get ingress -n va-chat

# View logs
kubectl logs -f deployment/va-chat -n va-chat
```

### Terraform Infrastructure

**AWS Infrastructure**
```hcl
# terraform/aws/main.tf
provider "aws" {
  region = var.aws_region
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "va-chat-vpc"
  }
}

# Subnets
resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "va-chat-public-${count.index + 1}"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "va-chat-private-${count.index + 1}"
  }
}

# RDS
resource "aws_db_instance" "postgres" {
  identifier     = "va-chat-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  
  db_name  = "va_chat"
  username = "postgres"
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = true
  
  tags = {
    Name = "va-chat-db"
  }
}

# ElastiCache
resource "aws_elasticache_subnet_group" "main" {
  name       = "va-chat-cache-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "va-chat-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "va-chat"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "va-chat-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "va-chat-alb"
  }
}
```

**Deploy with Terraform**
```bash
# Initialize Terraform
cd terraform/aws
terraform init

# Plan deployment
terraform plan -var="db_password=your-secure-password"

# Apply infrastructure
terraform apply -var="db_password=your-secure-password"

# Get outputs
terraform output
```

### Vercel Deployment (Frontend Only)

**vercel.json**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-backend-api.com/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "env": {
    "VITE_API_URL": "https://your-backend-api.com"
  }
}
```

**Deploy to Vercel**
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Netlify Deployment (Frontend Only)

**netlify.toml**
```toml
[build]
  base = "frontend"
  publish = "dist"
  command = "npm run build"

[build.environment]
  VITE_API_URL = "https://your-backend-api.com"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-api.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## 🔐 Security Hardening

### Server Security

**Firewall Configuration**
```bash
# Configure UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Check status
sudo ufw status verbose
```

**Fail2Ban Setup**
```bash
# Install Fail2Ban
sudo apt install fail2ban

# Configure
sudo tee /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
EOF

# Start service
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**SSL Security Headers**
```nginx
# Add to Nginx server block
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options DENY always;
add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.openai.com; frame-ancestors 'none';" always;
```

### Application Security

**Rate Limiting**
```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const createRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs,
    max,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Usage
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes
export const apiLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const chatLimiter = createRateLimiter(60 * 1000, 10); // 10 requests per minute
```

**Input Validation**
```typescript
// backend/src/middleware/validation.ts
import { body, param, query } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.param,
          message: error.msg,
          value: error.value
        }))
      }
    });
  }
  next();
};

// Validation rules
export const messageValidation = [
  body('content')
    .isLength({ min: 1, max: 4000 })
    .withMessage('Message content must be between 1 and 4000 characters')
    .trim()
    .escape(),
  body('conversationId')
    .isUUID()
    .withMessage('Invalid conversation ID'),
  validateRequest
];
```

## 📈 Performance Optimization

### Database Optimization

**Connection Pooling**
```typescript
// backend/src/config/database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Connection pool configuration
const connectionLimit = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '10');
const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT || '20');

export { prisma };
```

**Query Optimization**
```sql
-- Create performance indexes
CREATE INDEX CONCURRENTLY idx_conversations_user_created ON conversations(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_files_user_created ON files(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_sessions_user_expires ON sessions(user_id, expires_at);

-- Analyze table statistics
ANALYZE conversations;
ANALYZE messages;
ANALYZE files;
ANALYZE users;
```

### Caching Strategy

**Redis Caching**
```typescript
// backend/src/services/cache.ts
import Redis from 'ioredis';

class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }
}

export const cache = new CacheService();
```

### CDN Configuration

**CloudFlare Setup**
```javascript
// cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Cache static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);
    
    if (!response) {
      response = await fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'public, max-age=31536000');
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });
      event.waitUntil(cache.put(cacheKey, response.clone()));
    }
    
    return response;
  }
  
  // Forward API requests
  return fetch(request);
}
```

## 🔍 Monitoring and Observability

### Application Monitoring

**Prometheus Metrics**
```typescript
// backend/src/middleware/metrics.ts
import promClient from 'prom-client';

// Create metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

// Middleware
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
};

// Metrics endpoint
export const metricsHandler = async (req: any, res: any) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
};
```

**Health Check Endpoints**
```typescript
// backend/src/routes/health.ts
import { Router } from 'express';
import { prisma } from '../config/database';
import { cache } from '../services/cache';

const router = Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

// Readiness check
router.get('/ready', async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis
    await cache.set('health-check', 'ok', 10);
    await cache.get('health-check');
    
    res.json({
      status: 'ready',
      checks: {
        database: 'ok',
        redis: 'ok'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error.message
    });
  }
});

// Liveness check
router.get('/live', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  res.json({
    status: 'alive',
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    }
  });
});

export default router;
```

### Log Management

**Structured Logging**
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'va-chat',
    version: process.env.npm_package_version
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

export { logger };
```

---

**For additional deployment support and advanced configurations, refer to the specific cloud provider documentation and best practices guides.**