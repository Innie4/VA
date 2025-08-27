# Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Project Structure](#project-structure)
4. [Coding Standards](#coding-standards)
5. [Git Workflow](#git-workflow)
6. [Testing Guidelines](#testing-guidelines)
7. [Code Review Process](#code-review-process)
8. [Performance Guidelines](#performance-guidelines)
9. [Security Guidelines](#security-guidelines)
10. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
11. [Contributing Guidelines](#contributing-guidelines)
12. [Release Process](#release-process)

## Getting Started

### Prerequisites

Before contributing to the VA Chat project, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher) or **yarn** (v1.22.0 or higher)
- **Git** (v2.30.0 or higher)
- **VS Code** (recommended) with the following extensions:
  - TypeScript and JavaScript Language Features
  - Prettier - Code formatter
  - ESLint
  - Prisma
  - GitLens
  - Thunder Client (for API testing)

### Initial Setup

1. **Fork and Clone the Repository**
   ```bash
   git clone https://github.com/your-username/va-chat.git
   cd va-chat
   ```

2. **Install Dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Configuration**
   ```bash
   # Backend environment
   cd backend
   cp .env.example .env
   # Edit .env with your configuration
   
   # Frontend environment
   cd ../frontend
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   npx prisma db seed
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

## Development Environment

### VS Code Configuration

Create a `.vscode/settings.json` file in the project root:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/coverage": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "on",
  "emmet.includeLanguages": {
    "typescript": "html",
    "typescriptreact": "html"
  }
}
```

### Recommended VS Code Extensions

Create a `.vscode/extensions.json` file:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-vscode.vscode-typescript-next",
    "eamodio.gitlens",
    "rangav.vscode-thunder-client",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-eslint"
  ]
}
```

## Project Structure

### Monorepo Organization

```
va-chat/
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # Route definitions
│   │   ├── schemas/        # Validation schemas
│   │   ├── socket/         # WebSocket handlers
│   │   ├── utils/          # Utility functions
│   │   └── types/          # TypeScript types
│   ├── prisma/             # Database schema and migrations
│   ├── tests/              # Backend tests
│   └── package.json
├── frontend/               # React/TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── store/          # State management (Zustand)
│   │   ├── theme/          # Material-UI theme
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   ├── tests/              # Frontend tests
│   └── package.json
├── docs/                   # Documentation
├── .github/                # GitHub workflows and templates
└── README.md
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `ChatContainer.tsx`, `MessageBubble.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useSocketConnection.ts`)
- **Utilities**: camelCase (e.g., `formatDate.ts`, `apiClient.ts`)
- **Types**: PascalCase (e.g., `User.ts`, `ChatTypes.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)
- **Stores**: camelCase with "Store" suffix (e.g., `authStore.ts`)

## Coding Standards

### TypeScript Guidelines

#### Type Definitions

```typescript
// ✅ Good: Use interfaces for object shapes
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
}

// ✅ Good: Use type aliases for unions and primitives
type MessageType = 'text' | 'file' | 'image' | 'audio'
type UserId = string

// ✅ Good: Use enums for constants
enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read'
}

// ❌ Bad: Using any type
const userData: any = fetchUser()

// ✅ Good: Proper typing
const userData: User = await fetchUser()
```

#### Function Signatures

```typescript
// ✅ Good: Clear parameter and return types
const formatMessage = (
  content: string,
  type: MessageType = 'text',
  metadata?: Record<string, unknown>
): FormattedMessage => {
  return {
    content: content.trim(),
    type,
    metadata: metadata || {},
    timestamp: new Date().toISOString()
  }
}

// ✅ Good: Async function typing
const fetchUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const response = await apiClient.get(`/users/${userId}`)
    return response.data
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }
}
```

#### Generic Types

```typescript
// ✅ Good: Generic API response type
interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

// ✅ Good: Generic hook return type
interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const useApi = <T>(url: string): UseApiResult<T> => {
  // Implementation
}
```

### React Component Guidelines

#### Component Structure

```typescript
// ✅ Good: Functional component with proper typing
import React, { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { User } from '../types/User'

interface UserProfileProps {
  user: User
  onEdit: (user: User) => void
  onDelete: (userId: string) => void
  isEditable?: boolean
}

const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onEdit,
  onDelete,
  isEditable = false
}) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleEdit = useCallback(() => {
    setIsLoading(true)
    onEdit(user)
    setIsLoading(false)
  }, [user, onEdit])

  const handleDelete = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      onDelete(user.id)
    }
  }, [user.id, onDelete])

  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="h6">
        {user.firstName} {user.lastName}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {user.email}
      </Typography>
      
      {isEditable && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            onClick={handleEdit}
            disabled={isLoading}
          >
            Edit
          </Button>
          <Button 
            variant="outlined" 
            color="error" 
            onClick={handleDelete}
            disabled={isLoading}
          >
            Delete
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default UserProfile
```

#### Custom Hooks

```typescript
// ✅ Good: Custom hook with proper typing and error handling
import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../utils/apiClient'

interface UseUserDataResult {
  user: User | null
  loading: boolean
  error: string | null
  updateUser: (updates: Partial<User>) => Promise<void>
  refreshUser: () => Promise<void>
}

const useUserData = (userId: string): UseUserDataResult => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get(`/users/${userId}`)
      setUser(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user')
    } finally {
      setLoading(false)
    }
  }, [userId])

  const updateUser = useCallback(async (updates: Partial<User>) => {
    try {
      setError(null)
      const response = await apiClient.put(`/users/${userId}`, updates)
      setUser(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
      throw err
    }
  }, [userId])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return {
    user,
    loading,
    error,
    updateUser,
    refreshUser: fetchUser
  }
}

export default useUserData
```

### Backend Guidelines

#### Controller Structure

```typescript
// ✅ Good: Controller with proper error handling and validation
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { AppError } from '../utils/AppError'
import { successResponse, errorResponse } from '../utils/responses'

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate input
    const validatedData = createUserSchema.parse(req.body)
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })
    
    if (existingUser) {
      throw new AppError('User with this email already exists', 409)
    }
    
    // Hash password
    const hashedPassword = await hashPassword(validatedData.password)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        ...validatedData,
        password: hashedPassword
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true
      }
    })
    
    res.status(201).json(successResponse(user, 'User created successfully'))
  } catch (error) {
    next(error)
  }
}
```

#### Service Layer

```typescript
// ✅ Good: Service layer with business logic separation
import { prisma } from '../config/database'
import { User, CreateUserData, UpdateUserData } from '../types/user'
import { AppError } from '../utils/AppError'
import { hashPassword } from '../utils/crypto'

export class UserService {
  static async createUser(data: CreateUserData): Promise<User> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })
    
    if (existingUser) {
      throw new AppError('User with this email already exists', 409)
    }
    
    const hashedPassword = await hashPassword(data.password)
    
    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword
      },
      include: {
        role: true,
        preferences: true
      }
    })
  }
  
  static async getUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        preferences: true
      }
    })
  }
  
  static async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.getUserById(id)
    
    if (!user) {
      throw new AppError('User not found', 404)
    }
    
    return prisma.user.update({
      where: { id },
      data,
      include: {
        role: true,
        preferences: true
      }
    })
  }
  
  static async deleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id)
    
    if (!user) {
      throw new AppError('User not found', 404)
    }
    
    await prisma.user.delete({ where: { id } })
  }
}
```

### Code Formatting

#### Prettier Configuration

Create a `.prettierrc` file in the project root:

```json
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

#### ESLint Configuration

Create a `.eslintrc.js` file:

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'eqeqeq': 'error',
    'curly': 'error'
  }
}
```

## Git Workflow

### Branch Naming Convention

- **Feature branches**: `feature/description-of-feature`
- **Bug fixes**: `fix/description-of-bug`
- **Hotfixes**: `hotfix/description-of-hotfix`
- **Releases**: `release/version-number`
- **Documentation**: `docs/description-of-docs`

### Commit Message Format

Use the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

#### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

#### Examples

```bash
# Good commit messages
git commit -m "feat(auth): add JWT token refresh functionality"
git commit -m "fix(chat): resolve message ordering issue in conversation"
git commit -m "docs(api): update authentication endpoint documentation"
git commit -m "refactor(components): extract reusable MessageBubble component"

# Bad commit messages
git commit -m "fix stuff"
git commit -m "update code"
git commit -m "changes"
```

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/add-user-preferences
   ```

2. **Make Changes and Commit**
   ```bash
   git add .
   git commit -m "feat(user): add user preferences management"
   ```

3. **Push Branch**
   ```bash
   git push origin feature/add-user-preferences
   ```

4. **Create Pull Request**
   - Use the PR template
   - Add descriptive title and description
   - Link related issues
   - Add appropriate labels
   - Request reviewers

5. **Address Review Comments**
   - Make requested changes
   - Push additional commits
   - Respond to comments

6. **Merge**
   - Squash and merge for feature branches
   - Use merge commit for release branches

### Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Description

Brief description of the changes made.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Related Issues

Fixes #(issue number)

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] New tests added for new functionality

## Screenshots (if applicable)

## Checklist

- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

## Testing Guidelines

### Frontend Testing

#### Unit Tests with Vitest

```typescript
// components/__tests__/UserProfile.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import UserProfile from '../UserProfile'
import { User } from '../../types/User'

const mockUser: User = {
  id: '1',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  avatar: null
}

const mockProps = {
  user: mockUser,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  isEditable: true
}

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders user information correctly', () => {
    render(<UserProfile {...mockProps} />)
    
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('calls onEdit when edit button is clicked', async () => {
    render(<UserProfile {...mockProps} />)
    
    const editButton = screen.getByText('Edit')
    fireEvent.click(editButton)
    
    await waitFor(() => {
      expect(mockProps.onEdit).toHaveBeenCalledWith(mockUser)
    })
  })

  it('shows confirmation dialog before deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<UserProfile {...mockProps} />)
    
    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)
    
    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete this user?'
    )
    expect(mockProps.onDelete).toHaveBeenCalledWith('1')
  })

  it('does not show edit buttons when not editable', () => {
    render(<UserProfile {...mockProps} isEditable={false} />)
    
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })
})
```

#### Hook Testing

```typescript
// hooks/__tests__/useUserData.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import useUserData from '../useUserData'
import { apiClient } from '../../utils/apiClient'

vi.mock('../../utils/apiClient')

const mockApiClient = vi.mocked(apiClient)

describe('useUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches user data on mount', async () => {
    const mockUser = { id: '1', name: 'John Doe' }
    mockApiClient.get.mockResolvedValue({ data: mockUser })

    const { result } = renderHook(() => useUserData('1'))

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBe(null)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.error).toBe(null)
  })

  it('handles fetch errors', async () => {
    mockApiClient.get.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useUserData('1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBe(null)
    expect(result.current.error).toBe('Network error')
  })
})
```

### Backend Testing

#### Unit Tests with Jest

```typescript
// controllers/__tests__/userController.test.ts
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/database'
import { generateToken } from '../../utils/jwt'

describe('User Controller', () => {
  let authToken: string
  let testUser: any

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedpassword'
      }
    })

    authToken = generateToken({ userId: testUser.id })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  describe('GET /api/users/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.email).toBe('test@example.com')
      expect(response.body.data.password).toBeUndefined()
    })

    it('should return 401 for unauthenticated request', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401)
    })
  })

  describe('PUT /api/users/profile', () => {
    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      }

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.firstName).toBe('Updated')
      expect(response.body.data.lastName).toBe('Name')
    })

    it('should validate required fields', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ firstName: '' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('validation')
    })
  })
})
```

#### Integration Tests

```typescript
// tests/integration/auth.test.ts
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/database'

describe('Authentication Integration', () => {
  beforeEach(async () => {
    // Clean database before each test
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('User Registration and Login Flow', () => {
    it('should register user, login, and access protected route', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User'
      }

      // Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201)

      expect(registerResponse.body.success).toBe(true)
      expect(registerResponse.body.data.email).toBe(userData.email)

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200)

      expect(loginResponse.body.success).toBe(true)
      expect(loginResponse.body.data.accessToken).toBeDefined()

      const { accessToken } = loginResponse.body.data

      // Access protected route
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)

      expect(profileResponse.body.data.email).toBe(userData.email)
    })
  })
})
```

### Test Configuration

#### Vitest Configuration (Frontend)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

#### Jest Configuration (Backend)

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 10000
}
```

## Code Review Process

### Review Checklist

#### Functionality
- [ ] Code works as intended
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] Performance considerations are addressed

#### Code Quality
- [ ] Code is readable and well-structured
- [ ] Functions are small and focused
- [ ] Variable and function names are descriptive
- [ ] No code duplication
- [ ] Proper TypeScript typing

#### Testing
- [ ] Unit tests are present and comprehensive
- [ ] Integration tests cover main workflows
- [ ] Tests are readable and maintainable
- [ ] Test coverage is adequate

#### Security
- [ ] Input validation is present
- [ ] No sensitive data in logs
- [ ] Authentication/authorization is correct
- [ ] SQL injection prevention

#### Documentation
- [ ] Code is self-documenting
- [ ] Complex logic is commented
- [ ] API documentation is updated
- [ ] README is updated if needed

### Review Guidelines

#### For Reviewers

1. **Be Constructive**
   - Provide specific, actionable feedback
   - Explain the "why" behind suggestions
   - Offer alternative solutions

2. **Focus on Important Issues**
   - Prioritize functionality and security issues
   - Don't nitpick minor style issues if they follow project standards
   - Use automated tools for formatting

3. **Ask Questions**
   - If something is unclear, ask for clarification
   - Suggest improvements rather than just pointing out problems

4. **Acknowledge Good Work**
   - Highlight well-written code
   - Appreciate good solutions

#### For Authors

1. **Respond Promptly**
   - Address feedback in a timely manner
   - Ask for clarification if needed

2. **Be Open to Feedback**
   - Consider suggestions objectively
   - Explain your reasoning if you disagree

3. **Keep PRs Small**
   - Limit PRs to single features or bug fixes
   - Break large changes into smaller, reviewable chunks

## Performance Guidelines

### Frontend Performance

#### React Optimization

```typescript
// ✅ Good: Memoize expensive calculations
const ExpensiveComponent: React.FC<{ data: DataType[] }> = ({ data }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveProcessing(item))
  }, [data])

  return <div>{/* Render processed data */}</div>
}

// ✅ Good: Memoize callbacks
const ParentComponent: React.FC = () => {
  const [count, setCount] = useState(0)
  
  const handleClick = useCallback(() => {
    setCount(prev => prev + 1)
  }, [])

  return <ChildComponent onClick={handleClick} />
}

// ✅ Good: Use React.memo for pure components
const PureComponent = React.memo<{ name: string }>(({ name }) => {
  return <div>Hello, {name}!</div>
})
```

#### Bundle Optimization

```typescript
// ✅ Good: Lazy load components
const LazyComponent = lazy(() => import('./HeavyComponent'))

const App: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LazyComponent />
    </Suspense>
  )
}

// ✅ Good: Dynamic imports for utilities
const handleExport = async () => {
  const { exportToPDF } = await import('./utils/pdfExport')
  exportToPDF(data)
}
```

### Backend Performance

#### Database Optimization

```typescript
// ✅ Good: Use select to limit fields
const getUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  })
}

// ✅ Good: Use pagination
const getUsersPaginated = async (page: number, limit: number) => {
  const skip = (page - 1) * limit
  
  return prisma.user.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' }
  })
}

// ✅ Good: Use includes efficiently
const getConversationWithMessages = async (id: string) => {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        take: 50, // Limit messages
        orderBy: { createdAt: 'desc' },
        include: {
          files: {
            select: {
              id: true,
              filename: true,
              mimeType: true
            }
          }
        }
      }
    }
  })
}
```

#### Caching Strategy

```typescript
// ✅ Good: Cache frequently accessed data
const getCachedUserProfile = async (userId: string) => {
  const cacheKey = `user:profile:${userId}`
  
  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }
  
  // Fetch from database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { preferences: true }
  })
  
  if (user) {
    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(user))
  }
  
  return user
}
```

## Security Guidelines

### Input Validation

```typescript
// ✅ Good: Validate all inputs
const createMessageSchema = z.object({
  content: z.string()
    .min(1, 'Content is required')
    .max(5000, 'Content too long')
    .refine(content => !containsMaliciousContent(content), {
      message: 'Content contains prohibited elements'
    }),
  conversationId: z.string().cuid('Invalid conversation ID'),
  type: z.enum(['text', 'file', 'image']).default('text')
})

// ✅ Good: Sanitize HTML content
const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  })
}
```

### Authentication Security

```typescript
// ✅ Good: Secure password hashing
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

// ✅ Good: Secure session management
const createSession = async (userId: string, req: Request) => {
  const session = await prisma.session.create({
    data: {
      userId,
      sessionToken: generateSecureToken(),
      refreshToken: generateSecureToken(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  })
  
  return session
}
```

### Data Protection

```typescript
// ✅ Good: Encrypt sensitive data
const encryptSensitiveData = (data: string): string => {
  const cipher = crypto.createCipher('aes-256-gcm', process.env.ENCRYPTION_KEY!)
  let encrypted = cipher.update(data, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return encrypted
}

// ✅ Good: Audit sensitive operations
const auditLog = async (action: string, userId: string, details: any) => {
  await prisma.auditLog.create({
    data: {
      action,
      userId,
      metadata: JSON.stringify(details),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    }
  })
}
```

## Debugging and Troubleshooting

### Frontend Debugging

#### React DevTools

1. Install React Developer Tools browser extension
2. Use the Components tab to inspect component state and props
3. Use the Profiler tab to identify performance bottlenecks

#### Console Debugging

```typescript
// ✅ Good: Structured logging
const debugLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🐛 ${message}`)
    if (data) {
      console.log('Data:', data)
    }
    console.trace()
    console.groupEnd()
  }
}

// Usage
debugLog('User authentication failed', { userId, error })
```

#### Error Boundaries

```typescript
// ✅ Good: Comprehensive error boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    
    // Send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      reportError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <details>
            {this.state.error?.message}
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Backend Debugging

#### Logging Strategy

```typescript
// ✅ Good: Structured logging with context
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
      })
    })
  )
})

// Usage with context
const processMessage = async (messageData: any, userId: string) => {
  const context = { userId, messageId: messageData.id }
  
  logger.info('Processing message', context)
  
  try {
    // Process message
    logger.info('Message processed successfully', context)
  } catch (error) {
    logger.error('Failed to process message', { ...context, error })
    throw error
  }
}
```

#### Database Query Debugging

```typescript
// ✅ Good: Enable query logging in development
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error']
})

// ✅ Good: Add query timing
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()
  
  logger.debug('Query executed', {
    model: params.model,
    action: params.action,
    duration: `${after - before}ms`
  })
  
  return result
})
```

### Common Issues and Solutions

#### Frontend Issues

1. **State Updates Not Reflecting**
   ```typescript
   // ❌ Bad: Mutating state directly
   const updateUser = () => {
     user.name = 'New Name' // Don't do this
     setUser(user)
   }
   
   // ✅ Good: Create new object
   const updateUser = () => {
     setUser(prev => ({ ...prev, name: 'New Name' }))
   }
   ```

2. **Memory Leaks**
   ```typescript
   // ✅ Good: Cleanup subscriptions
   useEffect(() => {
     const subscription = api.subscribe(data => {
       setData(data)
     })
     
     return () => {
       subscription.unsubscribe()
     }
   }, [])
   ```

3. **Infinite Re-renders**
   ```typescript
   // ❌ Bad: Missing dependencies
   useEffect(() => {
     fetchData(userId)
   }, []) // Missing userId dependency
   
   // ✅ Good: Include all dependencies
   useEffect(() => {
     fetchData(userId)
   }, [userId])
   ```

#### Backend Issues

1. **Database Connection Issues**
   ```typescript
   // ✅ Good: Handle connection errors
   const connectDatabase = async () => {
     try {
       await prisma.$connect()
       logger.info('Database connected successfully')
     } catch (error) {
       logger.error('Database connection failed', { error })
       process.exit(1)
     }
   }
   ```

2. **Memory Leaks**
   ```typescript
   // ✅ Good: Cleanup resources
   const processLargeDataset = async () => {
     const stream = fs.createReadStream('large-file.csv')
     
     try {
       // Process stream
     } finally {
       stream.destroy()
     }
   }
   ```

## Contributing Guidelines

### Getting Started

1. **Fork the Repository**
   - Click the "Fork" button on GitHub
   - Clone your fork locally
   - Add upstream remote

2. **Set Up Development Environment**
   - Follow the setup instructions in this guide
   - Ensure all tests pass
   - Verify the application runs correctly

3. **Find an Issue**
   - Look for issues labeled "good first issue" or "help wanted"
   - Comment on the issue to indicate you're working on it
   - Ask questions if anything is unclear

### Making Contributions

#### Types of Contributions

1. **Bug Fixes**
   - Include reproduction steps
   - Add tests to prevent regression
   - Update documentation if needed

2. **New Features**
   - Discuss the feature in an issue first
   - Follow the existing architecture patterns
   - Include comprehensive tests
   - Update documentation

3. **Documentation**
   - Fix typos and improve clarity
   - Add examples and use cases
   - Update outdated information

4. **Performance Improvements**
   - Include benchmarks showing improvement
   - Ensure no functionality is broken
   - Document any breaking changes

#### Contribution Workflow

1. **Create Issue** (for new features)
   - Describe the feature or problem
   - Discuss implementation approach
   - Get feedback from maintainers

2. **Create Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow coding standards
   - Write tests
   - Update documentation

4. **Test Changes**
   ```bash
   # Frontend tests
   cd frontend
   npm run test
   npm run test:coverage
   
   # Backend tests
   cd backend
   npm run test
   npm run test:integration
   ```

5. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add user preference management"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Address Feedback**
   - Respond to review comments
   - Make requested changes
   - Update tests if needed

### Code of Conduct

#### Our Standards

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Inclusive**: Welcome people of all backgrounds and experience levels
- **Be Collaborative**: Work together to solve problems
- **Be Patient**: Help others learn and grow
- **Be Professional**: Maintain a professional tone in all interactions

#### Unacceptable Behavior

- Harassment or discrimination of any kind
- Trolling, insulting, or derogatory comments
- Personal or political attacks
- Publishing private information without permission
- Any conduct that would be inappropriate in a professional setting

#### Reporting Issues

If you experience or witness unacceptable behavior, please report it to the project maintainers at [email]. All reports will be handled confidentially.

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

### Release Workflow

1. **Prepare Release**
   ```bash
   # Create release branch
   git checkout -b release/v1.2.0
   
   # Update version numbers
   npm version minor
   
   # Update CHANGELOG.md
   # Update documentation
   ```

2. **Test Release**
   ```bash
   # Run all tests
   npm run test:all
   
   # Build production bundles
   npm run build
   
   # Test deployment
   npm run deploy:staging
   ```

3. **Create Release PR**
   - Create PR from release branch to main
   - Include changelog in PR description
   - Get approval from maintainers

4. **Deploy Release**
   ```bash
   # Merge to main
   git checkout main
   git merge release/v1.2.0
   
   # Create tag
   git tag v1.2.0
   git push origin v1.2.0
   
   # Deploy to production
   npm run deploy:production
   ```

5. **Post-Release**
   - Create GitHub release with changelog
   - Announce release in community channels
   - Monitor for issues

### Hotfix Process

For critical bugs in production:

1. **Create Hotfix Branch**
   ```bash
   git checkout -b hotfix/critical-bug-fix main
   ```

2. **Fix and Test**
   ```bash
   # Make minimal fix
   # Add regression test
   # Test thoroughly
   ```

3. **Deploy Hotfix**
   ```bash
   # Merge to main
   # Create patch version tag
   # Deploy immediately
   ```

4. **Backport to Develop**
   ```bash
   # Ensure fix is in develop branch
   git checkout develop
   git merge hotfix/critical-bug-fix
   ```

This developer guide provides comprehensive guidelines for contributing to the VA Chat project. Following these standards ensures code quality, maintainability, and a positive development experience for all contributors.