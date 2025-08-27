import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '@store/chatStore';
import { ConnectionInfo, MessageStreamEvent, TypingEvent, ErrorEvent } from '../types/chat';
import { useAuthStore } from '@store/authStore';

interface UseSocketConnectionOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
}

interface UseSocketConnectionReturn {
  socket: Socket | null;
  connectionInfo: ConnectionInfo;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  emit: (event: string, data?: any) => void;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionStatus: string;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const DEFAULT_OPTIONS: UseSocketConnectionOptions = {
  autoConnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  timeout: 20000,
};

export const useSocketConnection = (
  options: UseSocketConnectionOptions = {}
): UseSocketConnectionReturn => {
  const { autoConnect, reconnectAttempts, reconnectDelay, timeout } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    status: 'disconnected',
    retryAttempts: 0,
    maxRetries: reconnectAttempts || 5,
  });

  // Store actions
  const { setIsConnected, setIsTyping } = useChatStore();
  const { token, isAuthenticated } = useAuthStore();

  // Update connection status
  const updateConnectionStatus = useCallback(
    (status: ConnectionInfo['status'], error?: string) => {
      setConnectionInfo(prev => ({
        ...prev,
        status,
        error,
        lastConnected: status === 'connected' ? new Date() : prev.lastConnected,
      }));
      setIsConnected(status === 'connected');
    },
    [setIsConnected]
  );

  // Calculate latency
  const measureLatency = useCallback(() => {
    if (!socketRef.current?.connected) return;

    const startTime = Date.now();
    socketRef.current.emit('ping', startTime);
    
    const handlePong = (timestamp: number) => {
      const latency = Date.now() - timestamp;
      setConnectionInfo(prev => ({ ...prev, latency }));
      socketRef.current?.off('pong', handlePong);
    };
    
    socketRef.current.on('pong', handlePong);
  }, []);

  // Start ping interval
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      measureLatency();
    }, 30000); // Ping every 30 seconds
  }, [measureLatency]);

  // Stop ping interval
  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Connect to socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    updateConnectionStatus('connecting');

    try {
      const socket = io(SOCKET_URL, {
        auth: {
          token: token || undefined,
        },
        timeout,
        reconnection: false, // We'll handle reconnection manually
        transports: ['websocket', 'polling'],
      });

      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        updateConnectionStatus('connected');
        setConnectionInfo(prev => ({ ...prev, retryAttempts: 0 }));
        startPingInterval();
        measureLatency();
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        updateConnectionStatus('disconnected');
        stopPingInterval();
        
        // Auto-reconnect for certain disconnect reasons
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect automatically
          return;
        }
        
        // Attempt reconnection
        if (connectionInfo.retryAttempts < (reconnectAttempts || 5)) {
          reconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        updateConnectionStatus('error', error.message);
        
        // Attempt reconnection
        if (connectionInfo.retryAttempts < (reconnectAttempts || 5)) {
          reconnect();
        }
      });

      // Message streaming
      socket.on('message_stream', (data: MessageStreamEvent['data']) => {
        const { messageId, chunk, isComplete } = data;
        
        // Update or create streaming message
        // This would typically update a streaming message in the store
        console.log('Message stream:', { messageId, chunk, isComplete });
      });

      // Typing indicators
      socket.on('typing', (data: TypingEvent['data']) => {
        setIsTyping(data.isTyping);
      });

      // Error handling
      socket.on('error', (data: ErrorEvent['data']) => {
        console.error('Socket error:', data);
        // Handle specific errors
      });

      // Authentication events
      socket.on('auth_error', (error) => {
        console.error('Authentication error:', error);
        updateConnectionStatus('error', 'Authentication failed');
        // Redirect to login or refresh token
      });

      // Rate limiting
      socket.on('rate_limit', (data) => {
        console.warn('Rate limit exceeded:', data);
        // Show rate limit message to user
      });

    } catch (error) {
      console.error('Failed to create socket connection:', error);
      updateConnectionStatus('error', 'Failed to create connection');
    }
  }, [token, timeout, updateConnectionStatus, startPingInterval, stopPingInterval, measureLatency, connectionInfo.retryAttempts, reconnectAttempts]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopPingInterval();
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    updateConnectionStatus('disconnected');
  }, [stopPingInterval, updateConnectionStatus]);

  // Reconnect to socket
  const reconnect = useCallback(() => {
    if (connectionInfo.retryAttempts >= (reconnectAttempts || 5)) {
      updateConnectionStatus('error', 'Max reconnection attempts reached');
      return;
    }

    updateConnectionStatus('reconnecting');
    setConnectionInfo(prev => ({
      ...prev,
      retryAttempts: prev.retryAttempts + 1,
    }));

    // Disconnect current socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Exponential backoff
    const delay = (reconnectDelay || 1000) * Math.pow(2, connectionInfo.retryAttempts);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connectionInfo.retryAttempts, reconnectAttempts, reconnectDelay, updateConnectionStatus, connect]);

  // Emit event
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit event:', event);
    }
  }, []);

  // Auto-connect on mount (allow both authenticated and anonymous connections)
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Reconnect when authentication changes (but keep connection for anonymous users)
  useEffect(() => {
    if (socketRef.current && !socketRef.current.connected) {
      connect();
    }
    // Note: We no longer disconnect when user becomes unauthenticated
    // This allows anonymous/guest users to maintain their connection
  }, [isAuthenticated, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopPingInterval();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [stopPingInterval]);

  return {
    socket: socketRef.current,
    connectionInfo,
    connect,
    disconnect,
    reconnect,
    emit,
    isConnected: connectionInfo.status === 'connected',
    isConnecting: connectionInfo.status === 'connecting',
    isReconnecting: connectionInfo.status === 'reconnecting',
    connectionStatus: connectionInfo.status,
  };
};

// Hook for sending messages via socket
export const useSocketMessage = () => {
  const { emit, isConnected } = useSocketConnection();

  const sendMessage = useCallback(
    (content: string, conversationId: string, files?: File[]) => {
      if (!isConnected) {
        throw new Error('Socket not connected');
      }

      const messageData = {
        content,
        conversationId,
        files: files?.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
        timestamp: new Date().toISOString(),
      };

      emit('send_message', messageData);
    },
    [emit, isConnected]
  );

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (!isConnected) return;
      
      emit('typing', {
        conversationId,
        isTyping,
        timestamp: new Date().toISOString(),
      });
    },
    [emit, isConnected]
  );

  return {
    sendMessage,
    sendTyping,
    isConnected,
  };
};