import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Message, Conversation, MessageType, MessageSender } from '../types/chat';
import { v4 as uuidv4 } from 'uuid';

interface SendMessageParams {
  content: string;
  files?: File[];
  conversationId?: string;
  type?: MessageType;
}

interface ChatState {
  // Current state
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  isTyping: boolean;
  isConnected: boolean;
  
  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  
  // Conversations
  setConversations: (conversations: Conversation[]) => void;
  createNewConversation: (title?: string) => string;
  selectConversation: (id: string) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  pinConversation: (id: string) => void;
  archiveConversation: (id: string) => void;
  starConversation: (id: string) => void;
  
  // Message sending
  sendMessage: (params: SendMessageParams) => Promise<void>;
  
  // Connection state
  setIsTyping: (isTyping: boolean) => void;
  setIsConnected: (isConnected: boolean) => void;
  
  // Utility
  getConversationById: (id: string) => Conversation | undefined;
  getMessagesByConversation: (conversationId: string) => Message[];
  searchMessages: (query: string) => Message[];
  searchConversations: (query: string) => Conversation[];
}

const generateConversationTitle = (firstMessage?: string): string => {
  if (!firstMessage) return 'New Conversation';
  
  // Extract first few words for title
  const words = firstMessage.trim().split(' ').slice(0, 5);
  let title = words.join(' ');
  
  if (firstMessage.length > title.length) {
    title += '...';
  }
  
  return title || 'New Conversation';
};

export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        messages: [],
        conversations: [],
        currentConversationId: null,
        isTyping: false,
        isConnected: false,
        
        // Message actions
        setMessages: (messages) => set((state) => {
          state.messages = messages;
        }),
        
        addMessage: (message) => set((state) => {
          const newMessage: Message = {
            ...message,
            id: uuidv4(),
            timestamp: new Date(),
          };
          
          state.messages.push(newMessage);
          
          // Update conversation's last message and timestamp
          if (message.conversationId) {
            const conversation = state.conversations.find(c => c.id === message.conversationId);
            if (conversation) {
              conversation.lastMessage = message.content;
              conversation.updatedAt = new Date();
              conversation.messageCount = (conversation.messageCount || 0) + 1;
              
              // If it's a user message and conversation title is default, update it
              if (message.sender === 'user' && conversation.title === 'New Conversation') {
                conversation.title = generateConversationTitle(message.content);
              }
            }
          }
        }),
        
        updateMessage: (id, updates) => set((state) => {
          const messageIndex = state.messages.findIndex(m => m.id === id);
          if (messageIndex !== -1) {
            Object.assign(state.messages[messageIndex], updates);
          }
        }),
        
        deleteMessage: (id) => set((state) => {
          state.messages = state.messages.filter(m => m.id !== id);
        }),
        
        clearMessages: () => set((state) => {
          state.messages = [];
        }),
        
        // Conversation actions
        setConversations: (conversations) => set((state) => {
          state.conversations = conversations;
        }),
        
        createNewConversation: (title) => {
          const id = uuidv4();
          const newConversation: Conversation = {
            id,
            title: title || 'New Conversation',
            createdAt: new Date(),
            updatedAt: new Date(),
            messageCount: 0,
            unreadCount: 0,
            isPinned: false,
            isStarred: false,
            isArchived: false,
          };
          
          set((state) => {
            state.conversations.unshift(newConversation);
            state.currentConversationId = id;
            // Clear messages when creating new conversation
            state.messages = [];
          });
          
          return id;
        },
        
        selectConversation: (id) => set((state) => {
          state.currentConversationId = id;
          // Load messages for this conversation
          // In a real app, this would fetch from API
          const conversationMessages = state.messages.filter(m => m.conversationId === id);
          state.messages = conversationMessages;
          
          // Mark conversation as read
          const conversation = state.conversations.find(c => c.id === id);
          if (conversation) {
            conversation.unreadCount = 0;
          }
        }),
        
        updateConversation: (id, updates) => set((state) => {
          const conversationIndex = state.conversations.findIndex(c => c.id === id);
          if (conversationIndex !== -1) {
            Object.assign(state.conversations[conversationIndex], updates);
          }
        }),
        
        deleteConversation: (id) => set((state) => {
          state.conversations = state.conversations.filter(c => c.id !== id);
          state.messages = state.messages.filter(m => m.conversationId !== id);
          
          if (state.currentConversationId === id) {
            state.currentConversationId = null;
            state.messages = [];
          }
        }),
        
        renameConversation: (id, title) => set((state) => {
          const conversation = state.conversations.find(c => c.id === id);
          if (conversation) {
            conversation.title = title;
            conversation.updatedAt = new Date();
          }
        }),
        
        pinConversation: (id) => set((state) => {
          const conversation = state.conversations.find(c => c.id === id);
          if (conversation) {
            conversation.isPinned = !conversation.isPinned;
            conversation.updatedAt = new Date();
          }
        }),
        
        archiveConversation: (id) => set((state) => {
          const conversation = state.conversations.find(c => c.id === id);
          if (conversation) {
            conversation.isArchived = !conversation.isArchived;
            conversation.updatedAt = new Date();
            
            // If archiving current conversation, clear it
            if (conversation.isArchived && state.currentConversationId === id) {
              state.currentConversationId = null;
              state.messages = [];
            }
          }
        }),
        
        starConversation: (id) => set((state) => {
          const conversation = state.conversations.find(c => c.id === id);
          if (conversation) {
            conversation.isStarred = !conversation.isStarred;
            conversation.updatedAt = new Date();
          }
        }),
        
        // Message sending
        sendMessage: async (params) => {
          const { content, files, conversationId, type = MessageType.TEXT } = params;
          
          // Get current conversation or create new one
          let targetConversationId = conversationId || get().currentConversationId;
          
          if (!targetConversationId) {
            targetConversationId = get().createNewConversation();
          }
          
          // Add user message
          const userMessage: Omit<Message, 'id' | 'timestamp'> = {
            content,
            sender: MessageSender.USER,
            type: files && files.length > 0 ? MessageType.FILE : type,
            conversationId: targetConversationId,
            files: files?.map(file => ({
              name: file.name,
              size: file.size,
              type: file.type,
              url: URL.createObjectURL(file), // Temporary URL for preview
            })),
          };
          
          get().addMessage(userMessage);
          
          // Set typing indicator
          get().setIsTyping(true);
          
          try {
            // Here you would send the message to your API
            // For now, we'll simulate an AI response
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            // Simulate AI response
            const aiResponse: Omit<Message, 'id' | 'timestamp'> = {
              content: `I received your message: "${content}". This is a simulated response from the AI assistant.`,
              sender: MessageSender.ASSISTANT,
              type: MessageType.TEXT,
              conversationId: targetConversationId,
            };
            
            get().addMessage(aiResponse);
          } catch (error) {
            // Add error message
            const errorMessage: Omit<Message, 'id' | 'timestamp'> = {
              content: 'Sorry, I encountered an error while processing your message. Please try again.',
              sender: MessageSender.ASSISTANT,
              type: MessageType.ERROR,
              conversationId: targetConversationId,
            };
            
            get().addMessage(errorMessage);
          } finally {
            get().setIsTyping(false);
          }
        },
        
        // Connection state
        setIsTyping: (isTyping) => set((state) => {
          state.isTyping = isTyping;
        }),
        
        setIsConnected: (isConnected) => set((state) => {
          state.isConnected = isConnected;
        }),
        
        // Utility functions
        getConversationById: (id) => {
          return get().conversations.find(c => c.id === id);
        },
        
        getMessagesByConversation: (conversationId) => {
          return get().messages.filter(m => m.conversationId === conversationId);
        },
        
        searchMessages: (query) => {
          const lowercaseQuery = query.toLowerCase();
          return get().messages.filter(m => 
            m.content.toLowerCase().includes(lowercaseQuery)
          );
        },
        
        searchConversations: (query) => {
          const lowercaseQuery = query.toLowerCase();
          return get().conversations.filter(c => 
            c.title.toLowerCase().includes(lowercaseQuery) ||
            (c.lastMessage && c.lastMessage.toLowerCase().includes(lowercaseQuery))
          );
        },
      })),
      {
        name: 'chat-store',
        partialize: (state) => ({
          conversations: state.conversations,
          currentConversationId: state.currentConversationId,
          // Don't persist messages as they should be loaded from API
        }),
      }
    ),
    {
      name: 'chat-store',
    }
  )
);

// Selectors for better performance
export const useCurrentConversation = () => {
  return useChatStore((state) => {
    if (!state.currentConversationId) return null;
    return state.conversations.find(c => c.id === state.currentConversationId) || null;
  });
};

export const useConversationMessages = (conversationId?: string) => {
  return useChatStore((state) => {
    const targetId = conversationId || state.currentConversationId;
    if (!targetId) return [];
    return state.messages.filter(m => m.conversationId === targetId);
  });
};

export const usePinnedConversations = () => {
  return useChatStore((state) => 
    state.conversations.filter(c => c.isPinned && !c.isArchived)
  );
};

export const useStarredConversations = () => {
  return useChatStore((state) => 
    state.conversations.filter(c => c.isStarred && !c.isArchived)
  );
};

export const useArchivedConversations = () => {
  return useChatStore((state) => 
    state.conversations.filter(c => c.isArchived)
  );
};