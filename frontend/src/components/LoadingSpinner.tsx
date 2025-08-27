// React import removed as it's not needed in modern React with TypeScript
import {
  Box,
  CircularProgress,
  Typography,
  Fade,
  Skeleton,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@store/themeStore';

interface LoadingSpinnerProps {
  size?: number | string;
  message?: string;
  variant?: 'circular' | 'linear' | 'skeleton';
  fullScreen?: boolean;
  overlay?: boolean;
  color?: 'primary' | 'secondary' | 'inherit';
  thickness?: number;
  disableShrink?: boolean;
}

export function LoadingSpinner({
  size = 40,
  message,
  variant = 'circular',
  fullScreen = false,
  overlay = false,
  color = 'primary',
  thickness = 3.6,
  disableShrink = false,
}: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const { reducedMotion } = useThemeStore();

  const loadingMessage = message || t('common.loading');

  const renderSpinner = () => {
    switch (variant) {
      case 'skeleton':
        return (
          <Box sx={{ width: '100%' }}>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="80%" height={30} />
            <Skeleton variant="text" width="40%" height={30} />
            <Skeleton variant="rectangular" width="100%" height={200} sx={{ mt: 2 }} />
          </Box>
        );
      
      case 'linear':
        return (
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Box
              sx={{
                width: '100%',
                height: 4,
                backgroundColor: 'action.hover',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  width: '30%',
                  height: '100%',
                  backgroundColor: `${color}.main`,
                  borderRadius: 2,
                  animation: reducedMotion ? 'none' : 'loading-bar 2s ease-in-out infinite',
                  '@keyframes loading-bar': {
                    '0%': {
                      transform: 'translateX(-100%)',
                    },
                    '50%': {
                      transform: 'translateX(300%)',
                    },
                    '100%': {
                      transform: 'translateX(-100%)',
                    },
                  },
                }}
              />
            </Box>
            {loadingMessage && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {loadingMessage}
              </Typography>
            )}
          </Box>
        );
      
      default:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <CircularProgress
              size={size}
              color={color}
              thickness={thickness}
              disableShrink={disableShrink}
              sx={{
                animation: reducedMotion ? 'none' : undefined,
              }}
            />
            {loadingMessage && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
                role="status"
                aria-live="polite"
              >
                {loadingMessage}
              </Typography>
            )}
          </Box>
        );
    }
  };

  const content = (
    <Fade in timeout={300}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          ...(fullScreen && {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            backgroundColor: overlay ? 'rgba(0, 0, 0, 0.5)' : 'background.default',
          }),
          ...(overlay && !fullScreen && {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
          }),
          p: fullScreen ? 4 : 2,
        }}
        role="progressbar"
        aria-label={loadingMessage}
      >
        {renderSpinner()}
      </Box>
    </Fade>
  );

  return content;
}

// Specialized loading components
export function PageLoader({ message }: { message?: string }) {
  return (
    <LoadingSpinner
      fullScreen
      message={message}
      size={60}
      variant="circular"
    />
  );
}

export function InlineLoader({ message, size = 24 }: { message?: string; size?: number }) {
  return (
    <LoadingSpinner
      message={message}
      size={size}
      variant="circular"
    />
  );
}

export function SkeletonLoader() {
  return (
    <LoadingSpinner
      variant="skeleton"
    />
  );
}

export function LinearLoader({ message }: { message?: string }) {
  return (
    <LoadingSpinner
      message={message}
      variant="linear"
    />
  );
}