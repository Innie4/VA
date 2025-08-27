import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Paper,
  LinearProgress,
  Chip,
  Fade,
  Zoom,
} from '@mui/material';
import {
  MicRounded,
  MicOffRounded,
  StopRounded,
  SendRounded,
  CloseRounded,
  VolumeUpRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@store/themeStore';

interface VoiceRecorderProps {
  isListening: boolean;
  transcript: string;
  confidence?: number;
  onStop: () => void;
  onClose: () => void;
  onSend?: (transcript: string) => void;
  onPlayback?: () => void;
  isProcessing?: boolean;
  error?: string;
}

export function VoiceRecorder({
  isListening,
  transcript,
  confidence = 0,
  onStop,
  onClose,
  onSend,
  onPlayback,
  isProcessing = false,
  error,
}: VoiceRecorderProps) {
  const { t } = useTranslation();
  const { reducedMotion } = useThemeStore();
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);

  // Simulate audio level animation
  useEffect(() => {
    if (!isListening || reducedMotion) return;

    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isListening, reducedMotion]);

  // Track recording duration
  useEffect(() => {
    if (!isListening) {
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isListening]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = () => {
    if (transcript.trim()) {
      onSend?.(transcript);
      onClose();
    }
  };

  const renderAudioVisualizer = () => {
    if (reducedMotion) {
      return (
        <Box
          sx={{
            width: 120,
            height: 4,
            backgroundColor: 'primary.main',
            borderRadius: 2,
            opacity: isListening ? 1 : 0.3,
          }}
        />
      );
    }

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          height: 60,
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <Box
            key={i}
            sx={{
              width: 3,
              backgroundColor: 'primary.main',
              borderRadius: 1.5,
              transition: 'height 0.1s ease',
              height: isListening
                ? `${Math.max(8, (audioLevel + Math.random() * 20) * 0.6)}px`
                : '8px',
              opacity: isListening ? 1 : 0.3,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </Box>
    );
  };

  const renderRecordingState = () => (
    <Box sx={{ textAlign: 'center' }}>
      {/* Recording indicator */}
      <Box
        sx={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            backgroundColor: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            ...(isListening && !reducedMotion && {
              animation: 'pulse 2s infinite',
            }),
          }}
        >
          <MicRounded sx={{ fontSize: 48, color: 'white' }} />
          
          {/* Ripple effect */}
          {isListening && !reducedMotion && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: 'error.main',
                  animation: 'ripple 2s infinite',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid',
                  borderColor: 'error.main',
                  animation: 'ripple 2s infinite 1s',
                }}
              />
            </>
          )}
        </Box>
      </Box>

      {/* Status text */}
      <Typography variant="h6" gutterBottom>
        {isListening ? t('voice.listening') : t('voice.stopped')}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {isListening ? t('voice.speakNow') : t('voice.processingAudio')}
      </Typography>

      {/* Duration */}
      <Chip
        label={formatDuration(duration)}
        size="small"
        sx={{ mb: 2 }}
      />

      {/* Audio visualizer */}
      {renderAudioVisualizer()}

      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
        <IconButton
          onClick={onStop}
          size="large"
          color="error"
          sx={{
            backgroundColor: 'error.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'error.dark',
            },
          }}
        >
          <StopRounded />
        </IconButton>
      </Box>
    </Box>
  );

  const renderTranscriptState = () => (
    <Box sx={{ textAlign: 'center' }}>
      {/* Success indicator */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <Zoom in={!isListening} timeout={300}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'success.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MicOffRounded sx={{ fontSize: 32, color: 'white' }} />
          </Box>
        </Zoom>
      </Box>

      <Typography variant="h6" gutterBottom>
        {t('voice.transcriptionComplete')}
      </Typography>

      {/* Confidence indicator */}
      {confidence > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            {t('voice.confidence')}: {Math.round(confidence * 100)}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={confidence * 100}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                backgroundColor:
                  confidence > 0.8
                    ? 'success.main'
                    : confidence > 0.5
                    ? 'warning.main'
                    : 'error.main',
              },
            }}
          />
        </Box>
      )}

      {/* Transcript */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'grey.50',
          border: 1,
          borderColor: 'divider',
          minHeight: 80,
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        {transcript ? (
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {transcript}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            {t('voice.noTranscript')}
          </Typography>
        )}
      </Paper>

      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        {onPlayback && (
          <IconButton
            onClick={onPlayback}
            color="primary"
            disabled={isProcessing}
          >
            <VolumeUpRounded />
          </IconButton>
        )}
        
        <IconButton
          onClick={handleSend}
          disabled={!transcript.trim() || isProcessing}
          color="primary"
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&:disabled': {
              backgroundColor: 'grey.300',
              color: 'grey.500',
            },
          }}
        >
          <SendRounded />
        </IconButton>
      </Box>
    </Box>
  );

  const renderErrorState = () => (
    <Box sx={{ textAlign: 'center' }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: 'error.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MicOffRounded sx={{ fontSize: 32, color: 'white' }} />
        </Box>
      </Box>

      <Typography variant="h6" color="error" gutterBottom>
        {t('voice.error')}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {error || t('voice.errorDescription')}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <IconButton onClick={onClose} color="primary">
          <CloseRounded />
        </IconButton>
      </Box>
    </Box>
  );

  const renderContent = () => {
    if (error) {
      return renderErrorState();
    }
    
    if (isListening) {
      return renderRecordingState();
    }
    
    return renderTranscriptState();
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 400,
        }
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 1,
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
            },
          }}
        >
          <CloseRounded fontSize="small" />
        </IconButton>
      </Box>
      
      <DialogContent
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
          px: 3,
        }}
      >
        <Fade in={true} timeout={300}>
          <Box sx={{ width: '100%' }}>
            {renderContent()}
          </Box>
        </Fade>
      </DialogContent>
    </Dialog>
  );
}