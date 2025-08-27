# API Documentation

This document provides comprehensive documentation for the VA Chat API endpoints.

## Base URL

- **Development**: `http://localhost:3001`
- **Production**: `https://yourdomain.com`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes
- **Chat endpoints**: 50 requests per 15 minutes

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

## Endpoints

### Health Check

#### GET /api/health

Check application health status.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 3600,
    "version": "1.0.0",
    "environment": "production"
  }
}
```

#### GET /api/ready

Check if application is ready to serve requests.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "database": "connected",
    "redis": "connected",
    "openai": "available"
  }
}
```

#### GET /api/live

Liveness probe for container orchestration.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "alive"
  }
}
```

### Authentication

#### POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
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
      "filename": "document.pdf",
      "originalName": "My Document.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "url": "/api/files/uuid/download",
      "conversationId": "uuid",
      "userId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /api/files/:id/download

Download a file by ID.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
Binary file data with appropriate Content-Type header.

#### DELETE /api/files/:id

Delete a file.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Users

#### GET /api/users/profile

Get current user's profile.

**Headers:**
```
Authorization: Bearer <access-token>
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
      "lastName": "Doe",
      "avatar": "/api/files/avatar-uuid/download",
      "bio": "Software developer",
      "tier": "pro",
      "preferences": {
        "theme": "dark",
        "language": "en",
        "notifications": true
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /api/users/profile

Update current user's profile.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "bio": "Senior Software Developer",
  "preferences": {
    "theme": "light",
    "language": "en",
    "notifications": false
  }
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
      "lastName": "Smith",
      "bio": "Senior Software Developer",
      "preferences": {
        "theme": "light",
        "language": "en",
        "notifications": false
      },
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### POST /api/users/avatar

Upload user avatar.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

**Request Body:**
```
avatar: <image-file>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "/api/files/avatar-uuid/download"
  }
}
```

#### POST /api/users/change-password

Change user password.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "currentPassword": "currentPassword123!",
  "newPassword": "newSecurePassword456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

### Admin

> **Note:** All admin endpoints require admin or moderator role and appropriate permissions.

#### GET /api/admin/dashboard

Get admin dashboard statistics.

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "users": {
        "total": 1250,
        "active": 1100,
        "byTier": {
          "basic": 800,
          "pro": 350,
          "premium": 100
        }
      },
      "conversations": {
        "total": 5420,
        "totalMessages": 45230
      },
      "messages": {
        "byRole": {
          "user": 22615,
          "assistant": 22615
        },
        "total": 45230
      },
      "files": {
        "total": 890,
        "totalSize": 2147483648
      },
      "system": {
        "activeSessions": 156,
        "recentActivity": 89
      }
    },
    "cached": false
  }
}
```

#### GET /api/admin/users

Get paginated list of users.

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by email, firstName, or lastName
- `tier` (optional): Filter by user tier (basic, pro, premium)
- `isActive` (optional): Filter by active status (true/false)
- `sortBy` (optional): Sort field (createdAt, lastLoginAt, email)
- `sortOrder` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "tier": "pro",
        "isActive": true,
        "isEmailVerified": true,
        "lastLoginAt": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "role": {
          "name": "user",
          "permissions": ["chat:read", "chat:write"]
        },
        "_count": {
          "conversations": 15,
          "messages": 230
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1250,
      "pages": 63
    }
  }
}
```

#### GET /api/admin/users/:id

Get detailed user information.

**Headers:**
```
Authorization: Bearer <admin-access-token>
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
      "lastName": "Doe",
      "avatar": "/api/files/avatar-uuid/download",
      "bio": "Software developer",
      "tier": "pro",
      "isActive": true,
      "isEmailVerified": true,
      "lastLoginAt": "2024-01-01T00:00:00.000Z",
      "lastActiveAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "role": {
        "id": "uuid",
        "name": "user",
        "permissions": ["chat:read", "chat:write"]
      },
      "preferences": {
        "theme": "dark",
        "language": "en",
        "notifications": true
      },
      "_count": {
        "conversations": 15,
        "messages": 230,
        "files": 12,
        "sessions": 3
      }
    }
  }
}
```

#### PUT /api/admin/users/:id

Update user information (admin only).

**Headers:**
```
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "tier": "premium",
  "isActive": true,
  "isEmailVerified": true,
  "roleId": "uuid"
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
      "lastName": "Smith",
      "tier": "premium",
      "isActive": true,
      "isEmailVerified": true,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### DELETE /api/admin/users/:id/sessions

Revoke all user sessions (force logout).

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "All user sessions revoked successfully",
  "data": {
    "revokedSessions": 3
  }
}
```

#### GET /api/admin/system/settings

Get system settings.

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settings": {
      "maintenance": {
        "enabled": false,
        "message": "System maintenance in progress"
      },
      "registration": {
        "enabled": true,
        "requireEmailVerification": true
      },
      "chat": {
        "maxMessagesPerConversation": 1000,
        "maxFileSize": 10485760,
        "allowedFileTypes": ["pdf", "txt", "docx"]
      },
      "rateLimit": {
        "general": 100,
        "auth": 5,
        "chat": 50
      }
    }
  }
}
```

#### PUT /api/admin/system/settings

Update system settings.

**Headers:**
```
Authorization: Bearer <admin-access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "maintenance": {
    "enabled": true,
    "message": "Scheduled maintenance - back in 30 minutes"
  },
  "registration": {
    "enabled": false
  },
  "chat": {
    "maxMessagesPerConversation": 500
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settings": {
      "maintenance": {
        "enabled": true,
        "message": "Scheduled maintenance - back in 30 minutes"
      },
      "registration": {
        "enabled": false,
        "requireEmailVerification": true
      },
      "chat": {
        "maxMessagesPerConversation": 500,
        "maxFileSize": 10485760,
        "allowedFileTypes": ["pdf", "txt", "docx"]
      }
    }
  }
}
```

#### GET /api/admin/audit-logs

Get system audit logs.

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `action` (optional): Filter by action type
- `userId` (optional): Filter by user ID
- `startDate` (optional): Filter from date (ISO string)
- `endDate` (optional): Filter to date (ISO string)
- `level` (optional): Filter by log level (info, warn, error)

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "action": "user.login",
        "level": "info",
        "message": "User logged in successfully",
        "userId": "uuid",
        "userEmail": "user@example.com",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "metadata": {
          "loginMethod": "email",
          "sessionId": "uuid"
        },
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15420,
      "pages": 309
    }
  }
}
```

#### GET /api/admin/analytics

Get system analytics and metrics.

**Headers:**
```
Authorization: Bearer <admin-access-token>
```

**Query Parameters:**
- `period` (optional): Time period (day, week, month, year) (default: week)
- `startDate` (optional): Custom start date (ISO string)
- `endDate` (optional): Custom end date (ISO string)
- `metrics` (optional): Comma-separated list of metrics to include

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "period": "week",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-07T23:59:59.999Z",
      "metrics": {
        "users": {
          "newRegistrations": 45,
          "activeUsers": 890,
          "retentionRate": 0.85
        },
        "conversations": {
          "total": 1250,
          "averageLength": 8.5,
          "completionRate": 0.92
        },
        "messages": {
          "total": 10625,
          "averageResponseTime": 1.2,
          "errorRate": 0.02
        },
        "system": {
          "uptime": 0.999,
          "averageResponseTime": 245,
          "errorRate": 0.001
        }
      },
      "trends": {
        "dailyActiveUsers": [
          {"date": "2024-01-01", "count": 120},
          {"date": "2024-01-02", "count": 135},
          {"date": "2024-01-03", "count": 142}
        ],
        "messageVolume": [
          {"date": "2024-01-01", "count": 1450},
          {"date": "2024-01-02", "count": 1620},
          {"date": "2024-01-03", "count": 1580}
        ]
      }
    }
  }
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Authentication required or failed |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., email already exists) |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Validation Errors

Validation errors include detailed field-level information:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required",
        "code": "required"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters",
        "code": "min_length"
      }
    ]
  }
}
```

## WebSocket Events

### Connection

Connect to WebSocket at `/socket.io` with authentication:

```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Client to Server

**join_conversation**
```javascript
socket.emit('join_conversation', {
  conversationId: 'uuid'
});
```

**leave_conversation**
```javascript
socket.emit('leave_conversation', {
  conversationId: 'uuid'
});
```

**typing_start**
```javascript
socket.emit('typing_start', {
  conversationId: 'uuid'
});
```

**typing_stop**
```javascript
socket.emit('typing_stop', {
  conversationId: 'uuid'
});
```

#### Server to Client

**message_received**
```javascript
socket.on('message_received', (data) => {
  console.log('New message:', data);
  // data: { messageId, conversationId, content, role, createdAt }
});
```

**user_typing**
```javascript
socket.on('user_typing', (data) => {
  console.log('User typing:', data);
  // data: { userId, conversationId, isTyping }
});
```

**conversation_updated**
```javascript
socket.on('conversation_updated', (data) => {
  console.log('Conversation updated:', data);
  // data: { conversationId, title, updatedAt }
});
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

class VAClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async login(email: string, password: string) {
    const response = await axios.post(`${this.baseURL}/api/auth/login`, {
      email,
      password
    });
    
    this.accessToken = response.data.data.tokens.accessToken;
    return response.data;
  }

  async sendMessage(conversationId: string, content: string) {
    const response = await axios.post(
      `${this.baseURL}/api/chat/message`,
      { conversationId, content, role: 'user' },
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      }
    );
    
    return response.data;
  }

  async getConversations(page = 1, limit = 20) {
    const response = await axios.get(
      `${this.baseURL}/api/chat/conversations`,
      {
        params: { page, limit },
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      }
    );
    
    return response.data;
  }
}

// Usage
const client = new VAClient('http://localhost:3000');
await client.login('user@example.com', 'password');
const conversations = await client.getConversations();
```

### Python

```python
import requests
from typing import Optional, Dict, Any

class VAClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.access_token: Optional[str] = None
        self.session = requests.Session()
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/api/auth/login",
            json={"email": email, "password": password}
        )
        response.raise_for_status()
        
        data = response.json()
        self.access_token = data["data"]["tokens"]["accessToken"]
        self.session.headers.update({
            "Authorization": f"Bearer {self.access_token}"
        })
        
        return data
    
    def send_message(self, conversation_id: str, content: str) -> Dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/api/chat/message",
            json={
                "conversationId": conversation_id,
                "content": content,
                "role": "user"
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_conversations(self, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        response = self.session.get(
            f"{self.base_url}/api/chat/conversations",
            params={"page": page, "limit": limit}
        )
        response.raise_for_status()
        return response.json()

# Usage
client = VAClient("http://localhost:3000")
client.login("user@example.com", "password")
conversations = client.get_conversations()
```

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
npm run test:integration
```

### Test Coverage

Generate test coverage reports:

```bash
# Backend coverage
cd backend
npm run test:coverage

# Frontend coverage
cd frontend
npm run test:coverage
```

### API Testing with curl

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123!",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123!"
  }'

# Send message (replace TOKEN with actual token)
curl -X POST http://localhost:3000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "conversationId": "uuid",
    "content": "Hello, AI!",
    "role": "user"
  }'
```

---

**API Version:** 1.0.0  
**Last Updated:** January 2024  
**Base URL:** `http://localhost:3000/api`

For more information, visit the [project repository](https://github.com/your-org/va-chat) or check the [interactive API documentation](http://localhost:3000/api-docs).
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": 900
    }
  }
}
```

#### POST /api/auth/login

Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
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
      "lastName": "Doe",
      "role": "user",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token",
      "expiresIn": 900
    }
  }
}
```

#### POST /api/auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "expiresIn": 900
  }
}
```

#### POST /api/auth/logout

Logout user and invalidate tokens.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET /api/auth/me

Get current user profile.

**Headers:**
```
Authorization: Bearer <access-token>
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
      "lastName": "Doe",
      "role": "user",
      "preferences": {
        "theme": "dark",
        "language": "en"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Chat

#### GET /api/chat/conversations

Get user's conversations with pagination.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search term for conversation titles

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "title": "Conversation about AI",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "messageCount": 5,
        "lastMessage": {
          "content": "Thank you for the explanation!",
          "role": "user",
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

#### POST /api/chat/conversations

Create a new conversation.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "title": "New Conversation"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "uuid",
      "title": "New Conversation",
      "userId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /api/chat/conversations/:id

Get conversation details with messages.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Query Parameters:**
- `page` (optional): Page number for messages (default: 1)
- `limit` (optional): Messages per page (default: 50, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "uuid",
      "title": "Conversation about AI",
      "userId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "messages": [
      {
        "id": "uuid",
        "content": "Hello, how can I help you?",
        "role": "assistant",
        "conversationId": "uuid",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "metadata": {
          "model": "gpt-4",
          "tokens": 150
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 10,
      "pages": 1
    }
  }
}
```

#### PUT /api/chat/conversations/:id

Update conversation details.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "title": "Updated Conversation Title"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversation": {
      "id": "uuid",
      "title": "Updated Conversation Title",
      "userId": "uuid",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### DELETE /api/chat/conversations/:id

Delete a conversation and all its messages.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

#### POST /api/chat/message

Send a message and get AI response.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "conversationId": "uuid",
  "content": "What is artificial intelligence?",
  "role": "user"
}
```

**Response (Streaming):**
The response is streamed using Server-Sent Events (SSE). Each chunk contains:

```json
{
  "type": "message_start",
  "data": {
    "messageId": "uuid",
    "conversationId": "uuid"
  }
}

{
  "type": "content_delta",
  "data": {
    "delta": "Artificial intelligence"
  }
}

{
  "type": "message_end",
  "data": {
    "messageId": "uuid",
    "totalTokens": 150,
    "finishReason": "stop"
  }
}
```

### Files

#### POST /api/files/upload

Upload a file for use in conversations.

**Headers:**
```
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

**Request Body:**
```
file: <binary-file-data>
conversationId: uuid (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file": {
      "id": "uuid",
      "filename": "document.pdf",
      "originalName": "my-document.pdf",
      "mimeType": "application/pdf",
      "size": 1024000,
      "url": "/api/files/uuid",
      "conversationId": "uuid",
      "uploadedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /api/files/:id

Download or view an uploaded file.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
Returns the file content with appropriate headers:
```
Content-Type: <file-mime-type>
Content-Disposition: attachment; filename="<original-filename>"
```

#### DELETE /api/files/:id

Delete an uploaded file.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Users

#### GET /api/users/profile

Get current user's detailed profile.

**Headers:**
```
Authorization: Bearer <access-token>
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
      "lastName": "Doe",
      "role": "user",
      "preferences": {
        "theme": "dark",
        "language": "en",
        "notifications": true
      },
      "stats": {
        "totalConversations": 25,
        "totalMessages": 150,
        "joinedAt": "2024-01-01T00:00:00.000Z"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /api/users/profile

Update user profile information.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "preferences": {
    "theme": "light",
    "language": "en",
    "notifications": false
  }
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
      "lastName": "Smith",
      "preferences": {
        "theme": "light",
        "language": "en",
        "notifications": false
      },
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /api/users/password

Change user password.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "currentPassword": "oldPassword123!",
  "newPassword": "newSecurePassword456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

## WebSocket Events

The application uses Socket.io for real-time communication.

### Connection

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Events

#### Client to Server

**join_conversation**
```javascript
socket.emit('join_conversation', {
  conversationId: 'uuid'
});
```

**leave_conversation**
```javascript
socket.emit('leave_conversation', {
  conversationId: 'uuid'
});
```

**send_message**
```javascript
socket.emit('send_message', {
  conversationId: 'uuid',
  content: 'Hello, AI!',
  role: 'user'
});
```

**typing_start**
```javascript
socket.emit('typing_start', {
  conversationId: 'uuid'
});
```

**typing_stop**
```javascript
socket.emit('typing_stop', {
  conversationId: 'uuid'
});
```

#### Server to Client

**message_received**
```javascript
socket.on('message_received', (data) => {
  console.log('New message:', data.message);
});
```

**ai_response_start**
```javascript
socket.on('ai_response_start', (data) => {
  console.log('AI started responding:', data.messageId);
});
```

**ai_response_chunk**
```javascript
socket.on('ai_response_chunk', (data) => {
  console.log('AI response chunk:', data.content);
});
```

**ai_response_end**
```javascript
socket.on('ai_response_end', (data) => {
  console.log('AI finished responding:', data.messageId);
});
```

**user_typing**
```javascript
socket.on('user_typing', (data) => {
  console.log('User is typing:', data.userId);
});
```

**error**
```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Invalid or missing authentication |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `OPENAI_ERROR` | OpenAI API error |
| `DATABASE_ERROR` | Database operation failed |
| `FILE_UPLOAD_ERROR` | File upload failed |
| `INTERNAL_ERROR` | Internal server error |

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error
- `503` - Service Unavailable

## Examples

### Complete Chat Flow

```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123!'
  })
});

const { data: { tokens } } = await loginResponse.json();
const accessToken = tokens.accessToken;

// 2. Create conversation
const conversationResponse = await fetch('/api/chat/conversations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My AI Chat'
  })
});

const { data: { conversation } } = await conversationResponse.json();

// 3. Send message
const messageResponse = await fetch('/api/chat/message', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversationId: conversation.id,
    content: 'Hello, AI!',
    role: 'user'
  })
});

// Handle streaming response
const reader = messageResponse.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = new TextDecoder().decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log('Received:', data);
    }
  }
}
```

### WebSocket Integration

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: accessToken
  }
});

// Join conversation
socket.emit('join_conversation', {
  conversationId: conversation.id
});

// Listen for AI responses
socket.on('ai_response_chunk', (data) => {
  updateMessageContent(data.messageId, data.content);
});

// Send message via WebSocket
socket.emit('send_message', {
  conversationId: conversation.id,
  content: 'Hello via WebSocket!',
  role: 'user'
});
```

---

**For more examples and interactive testing, visit the API documentation at `/api-docs` when running the server.**