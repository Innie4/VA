import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Tooltip,
  InputAdornment,
  Chip,
  Typography,
  Fade,
  CircularProgress,
} from '@mui/material';
import {
  SendRounded,
  MicRounded,
  MicOffRounded,
  AttachFileRounded,
  CloseRounded,
  KeyboardVoiceRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@store/themeStore';

interface ChatInputProps {
  onSendMessage: (content: string, files?: File[]) => void;
  disabled?: boolean;
  isListening?: boolean;
  onStartVoice?: () => void;
  onStopVoice?: () => void;
  voiceSupported?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'image/*',
  'text/*',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];

export function ChatInput({
  onSendMessage,
  disabled = false,
  isListening = false,
  onStartVoice,
  onStopVoice,
  voiceSupported = false,
  placeholder,
  maxLength = 4000,
}: ChatInputProps) {
  const { t } = useTranslation();
  const { reducedMotion } = useThemeStore();
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const textFieldRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const canSend = (message.trim().length > 0 || attachedFiles.length > 0) && !disabled;

  // Handle message send
  const handleSend = useCallback(() => {
    if (!canSend) return;
    
    onSendMessage(message, attachedFiles.length > 0 ? attachedFiles : undefined);
    setMessage('');
    setAttachedFiles([]);
    textFieldRef.current?.focus();
  }, [message, attachedFiles, canSend, onSendMessage]);

  // Handle key press
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      handleSend();
    }
  }, [handleSend, isComposing]);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    Array.from(files).forEach((file) => {
      // Check file count
      if (attachedFiles.length + validFiles.length >= MAX_FILES) {
        errors.push(t('chat.errors.tooManyFiles', { max: MAX_FILES }));
        return;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(t('chat.errors.fileTooLarge', { name: file.name, max: '10MB' }));
        return;
      }
      
      // Check if file is already attached
      if (attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
        errors.push(t('chat.errors.fileAlreadyAttached', { name: file.name }));
        return;
      }
      
      validFiles.push(file);
    });
    
    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
    
    if (errors.length > 0) {
      // Could show toast notifications here
      console.warn('File upload errors:', errors);
    }
  }, [attachedFiles, t]);

  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  }, [handleFileSelect]);

  // Handle file removal
  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle drag and drop
  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current++;
    if (event.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    
    if (event.dataTransfer.files) {
      handleFileSelect(event.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Handle voice recording
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      onStopVoice?.();
    } else {
      onStartVoice?.();
    }
  }, [isListening, onStartVoice, onStopVoice]);

  // Focus input on mount
  useEffect(() => {
    textFieldRef.current?.focus();
  }, []);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        position: 'relative',
        ...(isDragging && {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'primary.main',
            opacity: 0.1,
            borderRadius: 1,
            border: '2px dashed',
            borderColor: 'primary.main',
            zIndex: 1,
          },
        }),
      }}
    >
      {/* Drag overlay */}
      {isDragging && (
        <Fade in={isDragging}>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 1,
              zIndex: 2,
            }}
          >
            <Paper
              elevation={3}
              sx={{
                p: 3,
                textAlign: 'center',
                backgroundColor: 'background.paper',
              }}
            >
              <AttachFileRounded sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                {t('chat.dropFiles')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('chat.dropFilesDescription')}
              </Typography>
            </Paper>
          </Box>
        </Fade>
      )}

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {t('chat.attachedFiles')} ({attachedFiles.length}/{MAX_FILES})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {attachedFiles.map((file, index) => (
              <Chip
                key={index}
                label={`${file.name} (${formatFileSize(file.size)})`}
                onDelete={() => handleRemoveFile(index)}
                deleteIcon={<CloseRounded />}
                variant="outlined"
                size="small"
                sx={{ maxWidth: 200 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Input field */}
      <TextField
        ref={textFieldRef}
        fullWidth
        multiline
        maxRows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        placeholder={placeholder || t('chat.typeMessage')}
        disabled={disabled}
        variant="outlined"
        size="small"
        inputProps={{
          maxLength,
          'aria-label': t('chat.messageInput'),
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {/* File attachment button */}
              <Tooltip title={t('chat.attachFile')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled || attachedFiles.length >= MAX_FILES}
                    aria-label={t('chat.attachFile')}
                  >
                    <AttachFileRounded />
                  </IconButton>
                </span>
              </Tooltip>
              
              {/* Voice recording button */}
              {voiceSupported && (
                <Tooltip title={isListening ? t('chat.stopRecording') : t('chat.startRecording')}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={handleVoiceToggle}
                      disabled={disabled}
                      aria-label={isListening ? t('chat.stopRecording') : t('chat.startRecording')}
                      sx={{
                        color: isListening ? 'error.main' : 'inherit',
                        ...(isListening && !reducedMotion && {
                          animation: 'pulse 1.5s infinite',
                        }),
                      }}
                    >
                      {isListening ? (
                        <MicOffRounded />
                      ) : (
                        <MicRounded />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {/* Character count */}
              {message.length > maxLength * 0.8 && (
                <Typography
                  variant="caption"
                  color={message.length >= maxLength ? 'error' : 'text.secondary'}
                  sx={{ mr: 1, minWidth: 'fit-content' }}
                >
                  {message.length}/{maxLength}
                </Typography>
              )}
              
              {/* Send button */}
              <Tooltip title={t('chat.sendMessage')}>
                <span>
                  <IconButton
                    onClick={handleSend}
                    disabled={!canSend}
                    color="primary"
                    aria-label={t('chat.sendMessage')}
                    sx={{
                      transition: 'all 0.2s',
                      ...(canSend && {
                        backgroundColor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {
                          backgroundColor: 'primary.dark',
                        },
                      }),
                    }}
                  >
                    {disabled ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SendRounded />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </InputAdornment>
          ),
          sx: {
            pr: 1,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDragging ? 'primary.main' : undefined,
            },
          },
        }}
        sx={{
          '& .MuiInputBase-root': {
            backgroundColor: 'background.paper',
          },
        }}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        aria-label={t('chat.selectFiles')}
      />

      {/* Voice recording indicator */}
      {isListening && (
        <Box
          sx={{
            position: 'absolute',
            top: -40,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'error.main',
            color: 'error.contrastText',
            borderRadius: 1,
            py: 1,
            px: 2,
            animation: !reducedMotion ? 'slideUp 0.3s ease-out' : 'none',
          }}
        >
          <KeyboardVoiceRounded sx={{ mr: 1, fontSize: 20 }} />
          <Typography variant="body2">
            {t('chat.listening')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}