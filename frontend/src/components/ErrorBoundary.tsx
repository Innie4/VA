import { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Container,
  Alert,
  AlertTitle,
} from '@mui/material';
import { RefreshRounded, BugReportRounded } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service in production
    if (import.meta.env.PROD) {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  onReset: () => void;
  onReload: () => void;
}

function ErrorFallback({ error, onReset, onReload }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          borderRadius: 2,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <BugReportRounded
            sx={{
              fontSize: 64,
              color: 'error.main',
              mb: 2,
            }}
          />
          <Typography variant="h4" component="h1" gutterBottom>
            {t('errors.generic')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            We apologize for the inconvenience. Something unexpected happened.
          </Typography>
        </Box>

        {import.meta.env.DEV && error && (
          <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
            <AlertTitle>Error Details (Development Mode)</AlertTitle>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
              {error.message}
            </Typography>
            {error.stack && (
              <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
                {error.stack}
              </Typography>
            )}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            onClick={onReset}
            startIcon={<RefreshRounded />}
            size="large"
          >
            {t('common.retry')}
          </Button>
          <Button
            variant="outlined"
            onClick={onReload}
            size="large"
          >
            Reload Page
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
          If this problem persists, please contact support.
        </Typography>
      </Paper>
    </Container>
  );
}

export { ErrorBoundary };
