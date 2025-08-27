import {
  Box,
  Chip,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  WifiRounded,
  WifiOffRounded,
  SyncRounded,
  ErrorRounded,
  CheckCircleRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@store/themeStore';

export enum ConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

interface ConnectionStatusProps {
  isConnected: boolean;
  status: ConnectionState;
  lastConnected?: Date;
  retryCount?: number;
  maxRetries?: number;
  onRetry?: () => void;
}

export function ConnectionStatus({
  isConnected,
  status,
  lastConnected,
  retryCount = 0,
  maxRetries = 5,
  onRetry,
}: ConnectionStatusProps) {
  const { t } = useTranslation();
  const { reducedMotion } = useThemeStore();

  const getStatusConfig = () => {
    switch (status) {
      case ConnectionState.CONNECTED:
        return {
          color: 'success' as const,
          icon: <CheckCircleRounded fontSize="small" />,
          label: t('connection.connected'),
          description: t('connection.connectedDescription'),
        };
      
      case ConnectionState.CONNECTING:
        return {
          color: 'info' as const,
          icon: (
            <CircularProgress
              size={16}
              sx={{
                color: 'inherit',
                ...(reducedMotion && {
                  animation: 'none',
                }),
              }}
            />
          ),
          label: t('connection.connecting'),
          description: t('connection.connectingDescription'),
        };
      
      case ConnectionState.RECONNECTING:
        return {
          color: 'warning' as const,
          icon: (
            <SyncRounded
              fontSize="small"
              sx={{
                ...(reducedMotion ? {} : {
                  animation: 'spin 2s linear infinite',
                }),
              }}
            />
          ),
          label: t('connection.reconnecting'),
          description: t('connection.reconnectingDescription', {
            attempt: retryCount + 1,
            max: maxRetries,
          }),
        };
      
      case ConnectionState.ERROR:
        return {
          color: 'error' as const,
          icon: <ErrorRounded fontSize="small" />,
          label: t('connection.error'),
          description: t('connection.errorDescription'),
        };
      
      case ConnectionState.DISCONNECTED:
      default:
        return {
          color: 'default' as const,
          icon: <WifiOffRounded fontSize="small" />,
          label: t('connection.disconnected'),
          description: lastConnected
            ? t('connection.disconnectedWithTime', {
                time: lastConnected.toLocaleTimeString(),
              })
            : t('connection.disconnectedDescription'),
        };
    }
  };

  const statusConfig = getStatusConfig();

  const tooltipContent = (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {statusConfig.label}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        {statusConfig.description}
      </Typography>
      {status === ConnectionState.ERROR && onRetry && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        >
          {t('connection.retry')}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={tooltipContent}
      arrow
      placement="bottom"
      enterDelay={500}
      leaveDelay={200}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'help',
        }}
      >
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          variant={isConnected ? 'filled' : 'outlined'}
          sx={{
            fontSize: '0.75rem',
            height: 24,
            '& .MuiChip-icon': {
              fontSize: 16,
            },
            '& .MuiChip-label': {
              px: 1,
            },
            ...(status === ConnectionState.RECONNECTING && !reducedMotion && {
              animation: 'pulse 2s infinite',
            }),
            ...(status === ConnectionState.ERROR && {
              cursor: onRetry ? 'pointer' : 'help',
            }),
          }}
          onClick={status === ConnectionState.ERROR && onRetry ? onRetry : undefined}
        />
        
        {/* Connection quality indicator */}
        {isConnected && (
          <Box
            sx={{
              ml: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            {[1, 2, 3].map((bar) => (
              <Box
                key={bar}
                sx={{
                  width: 2,
                  height: 4 + bar * 2,
                  backgroundColor: 'success.main',
                  borderRadius: 0.25,
                  opacity: 0.8,
                  ...(bar === 3 && !reducedMotion && {
                    animation: 'fadeInOut 2s infinite',
                  }),
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

// Additional component for detailed connection info
export function ConnectionDetails({
  isConnected,
  status,
  lastConnected,
  retryCount,
  maxRetries,
  latency,
  onRetry,
}: ConnectionStatusProps & { latency?: number }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <WifiRounded sx={{ mr: 1, color: isConnected ? 'success.main' : 'error.main' }} />
        <Typography variant="h6">
          {t('connection.status')}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {t('connection.state')}:
          </Typography>
          <ConnectionStatus
            isConnected={isConnected}
            status={status}
            retryCount={retryCount}
            maxRetries={maxRetries}
            onRetry={onRetry}
          />
        </Box>
        
        {lastConnected && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('connection.lastConnected')}:
            </Typography>
            <Typography variant="body2">
              {lastConnected.toLocaleString()}
            </Typography>
          </Box>
        )}
        
        {latency !== undefined && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('connection.latency')}:
            </Typography>
            <Typography
              variant="body2"
              color={
                latency < 100
                  ? 'success.main'
                  : latency < 300
                  ? 'warning.main'
                  : 'error.main'
              }
            >
              {latency}ms
            </Typography>
          </Box>
        )}
        
        {status === ConnectionState.RECONNECTING && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              {t('connection.retryAttempt')}:
            </Typography>
            <Typography variant="body2">
              {(retryCount ?? 0) + 1} / {maxRetries}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}