import { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import {
  Box,
  List,
  ListItem,
  Typography,
  Avatar,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Fade,
} from '@mui/material';
import {
  PersonRounded,
  SmartToyRounded,
  ContentCopyRounded,
  ThumbUpRounded,
  ThumbDownRounded,
  VolumeUpRounded,
  MoreVertRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@store/themeStore';
import { Message, MessageType } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { enUS, es, fr, de, zhCN, ja } from 'date-fns/locale';

interface ChatContainerProps {
  messages: Message[];
  isTyping: boolean;
  isConnected: boolean;
}

export interface ChatContainerRef {
  scrollToBottom: () => void;
  scrollToMessage: (messageId: string) => void;
}

const localeMap = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  zh: zhCN,
  ja: ja,
};

export const ChatContainer = forwardRef<ChatContainerRef, ChatContainerProps>(
  ({ messages, isTyping, isConnected }, ref) => {
    const { t, i18n } = useTranslation();
    const { reducedMotion } = useThemeStore();
    const listRef = useRef<HTMLUListElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'end',
      });
    };

    const scrollToMessage = (messageId: string) => {
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        element.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        // Highlight the message briefly
        element.style.backgroundColor = 'rgba(25, 118, 210, 0.1)';
        setTimeout(() => {
          element.style.backgroundColor = '';
        }, 2000);
      }
    };

    useImperativeHandle(ref, () => ({
      scrollToBottom,
      scrollToMessage,
    }));

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
      scrollToBottom();
    }, [messages.length]);

    const handleCopyMessage = async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        // Could add a toast notification here
      } catch (error) {
        console.error('Failed to copy message:', error);
      }
    };

    const handleSpeakMessage = (content: string) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(content);
        utterance.lang = i18n.language;
        speechSynthesis.speak(utterance);
      }
    };

    const formatMessageTime = (timestamp: Date) => {
      const locale = localeMap[i18n.language as keyof typeof localeMap] || enUS;
      return formatDistanceToNow(timestamp, {
        addSuffix: true,
        locale,
      });
    };

    const renderMessageContent = (message: Message) => {
      switch (message.type) {
        case MessageType.TEXT:
          return (
            <Typography
              variant="body1"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {message.content}
            </Typography>
          );
        
        case MessageType.FILE:
          return (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('chat.fileAttachment')}
              </Typography>
              {message.files?.map((file: any, index: number) => (
                <Chip
                  key={index}
                  label={file.name}
                  variant="outlined"
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
              {message.content && (
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {message.content}
                </Typography>
              )}
            </Box>
          );
        
        case MessageType.ERROR:
          return (
            <Typography
              variant="body2"
              color="error"
              sx={{
                fontStyle: 'italic',
                p: 1,
                backgroundColor: 'error.light',
                borderRadius: 1,
                opacity: 0.8,
              }}
            >
              {message.content}
            </Typography>
          );
        
        default:
          return (
            <Typography variant="body1">
              {message.content}
            </Typography>
          );
      }
    };

    const renderMessage = (message: Message, index: number) => {
      const isUser = message.sender === 'user';
      const isConsecutive = 
        index > 0 && 
        messages[index - 1].sender === message.sender &&
        new Date(message.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() < 60000; // 1 minute

      return (
        <Fade
          key={message.id}
          in={true}
          timeout={reducedMotion ? 0 : 300}
          style={{ transitionDelay: reducedMotion ? '0ms' : `${index * 50}ms` }}
        >
          <ListItem
            id={`message-${message.id}`}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
              px: 2,
              py: isConsecutive ? 0.5 : 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-end',
                maxWidth: '70%',
                width: 'fit-content',
                flexDirection: isUser ? 'row-reverse' : 'row',
                gap: 1,
              }}
            >
              {!isConsecutive && (
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: isUser ? 'primary.main' : 'secondary.main',
                  }}
                >
                  {isUser ? <PersonRounded /> : <SmartToyRounded />}
                </Avatar>
              )}
              
              <Paper
                elevation={1}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: isUser ? 'primary.main' : 'background.paper',
                  color: isUser ? 'primary.contrastText' : 'text.primary',
                  border: isUser ? 'none' : '1px solid',
                  borderColor: 'divider',
                  position: 'relative',
                  '&:hover .message-actions': {
                    opacity: 1,
                  },
                  ...(isConsecutive && {
                    ml: isUser ? 0 : 5,
                    mr: isUser ? 5 : 0,
                  }),
                }}
              >
                {renderMessageContent(message)}
                
                {/* Message Actions */}
                <Box
                  className="message-actions"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: isUser ? 'auto' : -8,
                    left: isUser ? -8 : 'auto',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    gap: 0.5,
                    backgroundColor: 'background.paper',
                    borderRadius: 1,
                    boxShadow: 1,
                    p: 0.5,
                  }}
                >
                  <Tooltip title={t('chat.copyMessage')}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopyMessage(message.content)}
                    >
                      <ContentCopyRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  
                  {!isUser && (
                    <>
                      <Tooltip title={t('chat.speakMessage')}>
                        <IconButton
                          size="small"
                          onClick={() => handleSpeakMessage(message.content)}
                        >
                          <VolumeUpRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title={t('chat.likeMessage')}>
                        <IconButton size="small">
                          <ThumbUpRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title={t('chat.dislikeMessage')}>
                        <IconButton size="small">
                          <ThumbDownRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  
                  <Tooltip title={t('chat.moreActions')}>
                    <IconButton size="small">
                      <MoreVertRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Paper>
            </Box>
            
            {/* Timestamp */}
            {!isConsecutive && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  ml: isUser ? 0 : 5,
                  mr: isUser ? 5 : 0,
                }}
              >
                {formatMessageTime(new Date(message.timestamp))}
              </Typography>
            )}
          </ListItem>
        </Fade>
      );
    };

    const renderTypingIndicator = () => (
      <Fade in={isTyping} timeout={300}>
        <ListItem
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            px: 2,
            py: 1,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 1,
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'secondary.main',
              }}
            >
              <SmartToyRounded />
            </Avatar>
            
            <Paper
              elevation={1}
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('chat.typing')}
                </Typography>
                <Box
                  className="typing-indicator"
                  sx={{
                    display: 'flex',
                    gap: 0.25,
                    ml: 1,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: 'text.secondary',
                        animation: reducedMotion ? 'none' : 'typing 1.4s infinite',
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </Paper>
          </Box>
        </ListItem>
      </Fade>
    );

    const renderEmptyState = () => (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          px: 3,
        }}
      >
        <SmartToyRounded
          sx={{
            fontSize: 64,
            color: 'text.secondary',
            mb: 2,
          }}
        />
        <Typography variant="h5" gutterBottom color="text.secondary">
          {t('chat.welcomeTitle')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
          {t('chat.welcomeMessage')}
        </Typography>
      </Box>
    );

    const renderConnectionError = () => (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          px: 3,
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          {t('errors.connectionLost')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('errors.connectionLostDescription')}
        </Typography>
      </Box>
    );

    if (!isConnected && messages.length === 0) {
      return renderConnectionError();
    }

    if (messages.length === 0) {
      return renderEmptyState();
    }

    return (
      <Box
        sx={{
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <List
          ref={listRef}
          sx={{
            flexGrow: 1,
            py: 1,
            '& .MuiListItem-root': {
              py: 0.5,
            },
          }}
        >
          {messages.map(renderMessage)}
          {isTyping && renderTypingIndicator()}
        </List>
        <div ref={messagesEndRef} />
      </Box>
    );
  }
);

ChatContainer.displayName = 'ChatContainer';