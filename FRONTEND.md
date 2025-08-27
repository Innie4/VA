# Frontend Architecture Documentation

## Overview

The VA Chat application frontend is built with React 18, TypeScript, and Vite, providing a modern, responsive, and accessible chat interface. The application follows a component-based architecture with centralized state management using Zustand.

## Technology Stack

### Core Technologies
- **React 18** - UI library with hooks and concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and development server
- **Material-UI (MUI)** - Component library and design system

### State Management
- **Zustand** - Lightweight state management library
- **React Query/TanStack Query** - Server state management and caching

### Routing & Navigation
- **React Router DOM** - Client-side routing
- **Lazy Loading** - Code splitting for optimal performance

### Internationalization
- **react-i18next** - Multi-language support
- **i18next** - Translation framework

### Development Tools
- **ESLint** - Code linting and quality
- **Vitest** - Unit testing framework
- **TypeScript** - Static type checking

## Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── chat/          # Chat-specific components
│   │   ├── common/        # Shared components
│   │   └── layout/        # Layout components
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization
│   ├── pages/             # Page components
│   ├── store/             # Zustand stores
│   ├── theme/             # Material-UI theme
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── test/              # Test utilities
├── package.json
├── vite.config.ts
├── tsconfig.json
└── vitest.config.ts
```

## State Management Architecture

### Zustand Stores

The application uses Zustand for client-side state management with three main stores:

#### 1. Auth Store (`authStore.ts`)
Manages user authentication and session state:

```typescript
interface AuthState {
  // State
  user: User | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  resetPassword: (data: ResetPasswordData) => Promise<void>
  changePassword: (data: ChangePasswordData) => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  clearError: () => void
}
```

**Key Features:**
- JWT token management
- Automatic token refresh
- Persistent authentication state
- Error handling and loading states

#### 2. Chat Store (`chatStore.ts`)
Manages chat conversations and messages:

```typescript
interface ChatState {
  // State
  messages: Message[]
  conversations: Conversation[]
  currentConversationId: string | null
  isTyping: boolean
  isConnected: boolean
  isLoading: boolean
  error: string | null
  
  // Message Actions
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  deleteMessage: (id: string) => void
  clearMessages: () => void
  
  // Conversation Actions
  setConversations: (conversations: Conversation[]) => void
  createConversation: (title: string) => Promise<Conversation>
  selectConversation: (id: string) => void
  updateConversation: (id: string, updates: Partial<Conversation>) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  pinConversation: (id: string) => void
  archiveConversation: (id: string) => void
  starConversation: (id: string) => void
  
  // Communication Actions
  sendMessage: (params: SendMessageParams) => Promise<void>
  setTyping: (isTyping: boolean) => void
  setConnected: (isConnected: boolean) => void
}
```

**Key Features:**
- Real-time message synchronization
- Conversation management
- WebSocket connection status
- Optimistic updates

#### 3. Theme Store (`themeStore.ts`)
Manages UI theme and accessibility preferences:

```typescript
interface ThemeState {
  // State
  isDarkMode: boolean
  fontSize: number
  highContrast: boolean
  reducedMotion: boolean
  
  // Actions
  toggleDarkMode: () => void
  setFontSize: (size: number) => void
  increaseFontSize: () => void
  decreaseFontSize: () => void
  setHighContrast: (enabled: boolean) => void
  setReducedMotion: (enabled: boolean) => void
  resetToDefaults: () => void
}
```

**Key Features:**
- Dark/light mode toggle
- Accessibility settings
- Font size adjustment
- Persistent preferences

## Component Architecture

### Component Categories

#### 1. Layout Components
- **App.tsx** - Root application component with routing
- **Layout components** - Header, sidebar, main content areas

#### 2. Page Components
- **ChatPage** - Main chat interface
- **LoginPage** - Authentication forms
- **SettingsPage** - User preferences and configuration

#### 3. Chat Components
- **ChatContainer** - Main chat interface wrapper
- **ChatInput** - Message input with file upload
- **ConversationSidebar** - Conversation list and management
- **ConnectionStatus** - WebSocket connection indicator
- **FileUpload** - File attachment handling
- **VoiceRecorder** - Voice message recording

#### 4. Common Components
- **ErrorBoundary** - Error handling and fallback UI
- **LoadingSpinner** - Loading states with multiple variants
- **Modal** - Reusable modal dialogs
- **Button** - Consistent button styling
- **Input** - Form input components

### Component Patterns

#### Error Boundary Pattern
```typescript
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}
```

#### Loading Spinner Variants
```typescript
interface LoadingSpinnerProps {
  variant?: 'circular' | 'linear' | 'skeleton'
  size?: 'small' | 'medium' | 'large'
  fullScreen?: boolean
  overlay?: boolean
  message?: string
}
```

## Custom Hooks

### 1. useSocketConnection
Manages WebSocket connections for real-time communication:

```typescript
interface UseSocketConnectionReturn {
  socket: Socket | null
  isConnected: boolean
  connectionInfo: ConnectionInfo
  connect: () => void
  disconnect: () => void
  emit: (event: string, data: any) => void
  on: (event: string, callback: Function) => void
  off: (event: string, callback: Function) => void
}
```

**Features:**
- Automatic connection management
- Reconnection with exponential backoff
- Connection status tracking
- Event handling abstraction

### 2. useVoiceRecognition
Handles speech-to-text functionality:

```typescript
interface UseVoiceRecognitionReturn {
  isListening: boolean
  transcript: string
  confidence: number
  error: string | null
  audioLevel: number
  startListening: () => void
  stopListening: () => void
  startRecording: () => void
  stopRecording: () => void
  clearTranscript: () => void
}
```

**Features:**
- Browser speech recognition API
- Audio level monitoring
- Transcript confidence scoring
- Error handling

### 3. useKeyboardShortcuts
Manages global keyboard shortcuts:

```typescript
interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  description: string
}
```

**Supported Shortcuts:**
- `Ctrl+N` - New conversation
- `Ctrl+D` - Delete conversation
- `Ctrl+Shift+T` - Toggle dark mode
- `Ctrl++` - Increase font size
- `Ctrl+-` - Decrease font size

## Theme System

### Material-UI Theme Configuration

The application uses a custom Material-UI theme with light and dark mode support:

```typescript
const lightPalette = {
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0'
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#9a0036'
  },
  background: {
    default: '#fafafa',
    paper: '#ffffff'
  },
  text: {
    primary: '#212121',
    secondary: '#757575'
  }
}

const darkPalette = {
  primary: {
    main: '#90caf9',
    light: '#e3f2fd',
    dark: '#42a5f5'
  },
  secondary: {
    main: '#f48fb1',
    light: '#fce4ec',
    dark: '#ad1457'
  },
  background: {
    default: '#121212',
    paper: '#1e1e1e'
  },
  text: {
    primary: '#ffffff',
    secondary: '#b0b0b0'
  }
}
```

### Responsive Design

The theme includes responsive breakpoints and typography:

```typescript
const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 300 },
    h2: { fontSize: '2rem', fontWeight: 400 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', lineHeight: 1.43 }
  }
})
```

## Type Definitions

### Chat Types

```typescript
enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  AUDIO = 'audio',
  ERROR = 'error',
  SYSTEM = 'system'
}

enum MessageSender {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

interface Message {
  id: string
  content: string
  sender: MessageSender
  type: MessageType
  timestamp: Date
  conversationId: string
  files?: FileAttachment[]
  metadata?: Record<string, any>
  reactions?: MessageReaction[]
  isEdited?: boolean
  editedAt?: Date
}

interface Conversation {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  isArchived?: boolean
  isPinned?: boolean
  isStarred?: boolean
  tags?: string[]
}

interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  thumbnail?: string
}
```

## Performance Optimization

### Code Splitting

The application uses React.lazy for route-based code splitting:

```typescript
const ChatPage = lazy(() => import('./pages/ChatPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
```

### Memoization

Components use React.memo and useMemo for performance:

```typescript
const MessageList = memo(({ messages }: { messages: Message[] }) => {
  const sortedMessages = useMemo(
    () => messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [messages]
  )
  
  return (
    <div>
      {sortedMessages.map(message => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  )
})
```

### Virtual Scrolling

Large message lists use virtual scrolling for performance:

```typescript
const VirtualizedMessageList = ({ messages }: { messages: Message[] }) => {
  const rowRenderer = ({ index, key, style }: any) => (
    <div key={key} style={style}>
      <MessageItem message={messages[index]} />
    </div>
  )
  
  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          width={width}
          rowCount={messages.length}
          rowHeight={80}
          rowRenderer={rowRenderer}
        />
      )}
    </AutoSizer>
  )
}
```

## Accessibility Features

### ARIA Support
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- Focus management

### Accessibility Settings
- High contrast mode
- Reduced motion preferences
- Font size adjustment
- Keyboard-only navigation

### Implementation Example

```typescript
const AccessibleButton = ({ children, onClick, ariaLabel }: Props) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onClick()
      }
    }}
  >
    {children}
  </button>
)
```

## Internationalization

### i18next Configuration

```typescript
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json'
    }
  })
```

### Usage in Components

```typescript
const ChatInput = () => {
  const { t } = useTranslation('chat')
  
  return (
    <TextField
      placeholder={t('input.placeholder')}
      aria-label={t('input.ariaLabel')}
    />
  )
}
```

## Testing Strategy

### Unit Testing with Vitest

```typescript
describe('ChatStore', () => {
  it('should add message to store', () => {
    const store = useChatStore.getState()
    const message: Message = {
      id: '1',
      content: 'Hello',
      sender: MessageSender.USER,
      type: MessageType.TEXT,
      timestamp: new Date(),
      conversationId: 'conv1'
    }
    
    store.addMessage(message)
    
    expect(store.messages).toContain(message)
  })
})
```

### Component Testing

```typescript
describe('MessageItem', () => {
  it('should render message content', () => {
    const message = createMockMessage()
    render(<MessageItem message={message} />)
    
    expect(screen.getByText(message.content)).toBeInTheDocument()
  })
})
```

## Build and Development

### Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Testing
```bash
npm run test
npm run test:coverage
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Best Practices

### Component Design
1. **Single Responsibility** - Each component has one clear purpose
2. **Composition over Inheritance** - Use composition patterns
3. **Props Interface** - Always define TypeScript interfaces for props
4. **Error Boundaries** - Wrap components in error boundaries
5. **Accessibility** - Include ARIA attributes and keyboard support

### State Management
1. **Minimal State** - Keep state as minimal as possible
2. **Derived State** - Use computed values instead of storing derived data
3. **Immutable Updates** - Always create new objects for state updates
4. **Error Handling** - Include error states in all stores

### Performance
1. **Code Splitting** - Split code at route boundaries
2. **Lazy Loading** - Load components and resources on demand
3. **Memoization** - Use React.memo and useMemo appropriately
4. **Virtual Scrolling** - For large lists and data sets

### Security
1. **Input Sanitization** - Sanitize all user inputs
2. **XSS Prevention** - Use proper escaping for dynamic content
3. **CSRF Protection** - Include CSRF tokens in forms
4. **Content Security Policy** - Implement CSP headers

This frontend architecture provides a scalable, maintainable, and performant foundation for the VA Chat application, with strong emphasis on user experience, accessibility, and developer productivity.