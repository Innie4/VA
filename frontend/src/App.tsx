import React, { Suspense, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from './store/themeStore';
import { useAuthStore, setupTokenRefresh, initializeAuth } from './store/authStore';
import { createAppTheme } from './theme/theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader } from './components/LoadingSpinner';

// Lazy load pages for better performance
const ChatPage = React.lazy(() => import('./pages/ChatPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

// Global styles for the app
const globalStyles = (
  <GlobalStyles
    styles={(theme) => ({
      '*': {
        boxSizing: 'border-box',
      },
      html: {
        height: '100%',
        fontSize: '16px',
        scrollBehavior: 'smooth',
      },
      body: {
        height: '100%',
        margin: 0,
        padding: 0,
        fontFamily: theme.typography.fontFamily,
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        lineHeight: 1.5,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      '#root': {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
      // Custom scrollbar styles
      '::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
      },
      '::-webkit-scrollbar-track': {
        background: theme.palette.background.paper,
      },
      '::-webkit-scrollbar-thumb': {
        background: theme.palette.divider,
        borderRadius: '4px',
        '&:hover': {
          background: theme.palette.text.secondary,
        },
      },
      // Focus styles for accessibility
      '*:focus-visible': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: '2px',
      },
      // Reduced motion support
      '@media (prefers-reduced-motion: reduce)': {
        '*': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
    })}
  />
);

// Protected route wrapper (currently unused)
// interface ProtectedRouteProps {
//   children: React.ReactNode;
// }
// 
// const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
//   const { isAuthenticated, isLoading } = useAuthStore();
//   
//   if (isLoading) {
//     return <PageLoader />;
//   }
//   
//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }
//   
//   return <>{children}</>;
// };

// Public route component (redirects to chat if authenticated)
interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return <PageLoader />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Main App component
const App: React.FC = () => {
  const { i18n } = useTranslation();
  const { isDarkMode } = useThemeStore();
  const { isLoading } = useAuthStore();
  
  // Initialize auth and setup token refresh on app start
  useEffect(() => {
    initializeAuth();
    const cleanup = setupTokenRefresh();
    return cleanup;
  }, []);
  
  // Create theme based on current settings
  const theme = createAppTheme(isDarkMode);
  
  // Set document language and direction
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.dir();
  }, [i18n.language]);
  
  // Show loading spinner during initial auth check
  if (isLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <PageLoader />
      </ThemeProvider>
    );
  }
  
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {globalStyles}
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              
              {/* Chat page - accessible to everyone */}
              <Route
                path="/"
                element={<ChatPage />}
              />
              
              {/* Settings page - accessible to everyone */}
              <Route
                path="/settings"
                element={<SettingsPage />}
              />
              
              {/* Catch all route - redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;