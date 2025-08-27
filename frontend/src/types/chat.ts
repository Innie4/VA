export enum MessageType {
  TEXT = 'text',
  FILE = 'file',
  IMAGE = 'image',
  AUDIO = 'audio',
  ERROR = 'error',
  SYSTEM = 'system',
}

export enum MessageSender {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url: string;
  id?: string;
}

export interface Message {
  id: string;
  content: string;
  sender: MessageSender;
  type: MessageType;
  timestamp: Date;
  conversationId: string;
  files?: FileAttachment[];
  metadata?: {
    confidence?: number;
    processingTime?: number;
    tokens?: number;
    model?: string;
    error?: string;
  };
  reactions?: {
    liked?: boolean;
    disliked?: boolean;
  };
  isEdited?: boolean;
  editedAt?: Date;
  parentMessageId?: string; // For threaded conversations
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
  messageCount: number;
  unreadCount: number;
  isPinned: boolean;
  isStarred: boolean;
  isArchived: boolean;
  tags?: string[];
  model?: string; // AI model used for this conversation
  systemPrompt?: string; // Custom system prompt
  temperature?: number; // AI temperature setting
  maxTokens?: number; // Max tokens for responses
}

export interface ConversationFilter {
  query?: string;
  tags?: string[];
  isPinned?: boolean;
  isStarred?: boolean;
  isArchived?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface ConversationSort {
  field: 'updatedAt' | 'createdAt' | 'title' | 'messageCount';
  direction: 'asc' | 'desc';
}

export interface VoiceRecording {
  id: string;
  blob: Blob;
  duration: number;
  transcript?: string;
  confidence?: number;
  isProcessing: boolean;
  error?: string;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enableVoice: boolean;
  enableNotifications: boolean;
  enableSounds: boolean;
  autoSave: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  fontSize: 'small' | 'medium' | 'large';
  messageGrouping: boolean;
  showTimestamps: boolean;
  enableMarkdown: boolean;
  enableCodeHighlighting: boolean;
}

export interface ConnectionInfo {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastConnected?: Date;
  latency?: number;
  retryAttempts: number;
  maxRetries: number;
  error?: string;
}

export interface TypingIndicator {
  isTyping: boolean;
  userId?: string;
  userName?: string;
  startedAt?: Date;
}

export interface ChatError {
  id: string;
  type: 'network' | 'api' | 'validation' | 'auth' | 'unknown';
  message: string;
  details?: any;
  timestamp: Date;
  conversationId?: string;
  messageId?: string;
  isRetryable: boolean;
}

export interface MessageAction {
  id: string;
  label: string;
  icon: string;
  action: (message: Message) => void;
  isVisible: (message: Message) => boolean;
  isDisabled?: (message: Message) => boolean;
}

export interface ConversationAction {
  id: string;
  label: string;
  icon: string;
  action: (conversation: Conversation) => void;
  isVisible: (conversation: Conversation) => boolean;
  isDisabled?: (conversation: Conversation) => boolean;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

// API Types
export interface SendMessageRequest {
  content: string;
  conversationId?: string;
  files?: File[];
  type?: MessageType;
  parentMessageId?: string;
  metadata?: Record<string, any>;
}

export interface SendMessageResponse {
  message: Message;
  conversation: Conversation;
}

export interface GetConversationsRequest {
  page?: number;
  limit?: number;
  filter?: ConversationFilter;
  sort?: ConversationSort;
}

export interface GetConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface GetMessagesRequest {
  conversationId: string;
  page?: number;
  limit?: number;
  before?: string; // Message ID
  after?: string; // Message ID
}

export interface GetMessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface StreamingResponse {
  id: string;
  type: 'start' | 'chunk' | 'end' | 'error';
  content?: string;
  metadata?: Record<string, any>;
  error?: string;
}

// WebSocket Events
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export interface MessageStreamEvent extends WebSocketEvent {
  type: 'message_stream';
  data: {
    messageId: string;
    conversationId: string;
    chunk: string;
    isComplete: boolean;
  };
}

export interface TypingEvent extends WebSocketEvent {
  type: 'typing';
  data: TypingIndicator;
}

export interface ConnectionEvent extends WebSocketEvent {
  type: 'connection';
  data: ConnectionInfo;
}

export interface ErrorEvent extends WebSocketEvent {
  type: 'error';
  data: ChatError;
}

// Utility Types
export type MessageWithoutId = Omit<Message, 'id' | 'timestamp'>;
export type ConversationWithoutId = Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'>;
export type PartialMessage = Partial<Message> & Pick<Message, 'id'>;
export type PartialConversation = Partial<Conversation> & Pick<Conversation, 'id'>;

// Hook Types
export interface UseChatOptions {
  conversationId?: string;
  autoConnect?: boolean;
  enableVoice?: boolean;
  enableNotifications?: boolean;
}

export interface UseVoiceRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
  maxAlternatives?: number;
}

export interface UseFileUploadOptions {
  maxFiles?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  enablePreview?: boolean;
}