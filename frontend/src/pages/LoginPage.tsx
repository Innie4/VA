import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  Divider,
  IconButton,
  InputAdornment,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Google as GoogleIcon,
  GitHub as GitHubIcon,
  Microsoft as MicrosoftIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { useThemeStore } from '@store/themeStore';
import { LoadingSpinner } from '@components/LoadingSpinner';

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type AuthMode = 'login' | 'register' | 'forgot-password';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  
  // Store hooks
  const { login, register, resetPassword, isLoading, error, clearError, isAuthenticated } = useAuthStore();
  const { isDarkMode } = useThemeStore();
  
  // State
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/chat';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);
  
  // Clear error when mode changes
  useEffect(() => {
    clearError();
  }, [mode, clearError]);
  
  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await login(loginForm);
    } catch (error) {
      // Error is handled by the store
    }
  };
  
  // Handle register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerForm.password !== registerForm.confirmPassword) {
      return;
    }
    
    try {
      await register(registerForm);
    } catch (error) {
      // Error is handled by the store
    }
  };
  
  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await resetPassword({ email: forgotEmail });
      setResetSent(true);
    } catch (error) {
      // Error is handled by the store
    }
  };
  
  // Handle social login (placeholder)
  const handleSocialLogin = (provider: 'google' | 'github' | 'microsoft') => {
    console.log(`Social login with ${provider}`);
    // Implement social login logic
  };
  
  // Render login form
  const renderLoginForm = () => (
    <Box component="form" onSubmit={handleLogin} sx={{ mt: 1 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label={t('auth.email')}
        name="email"
        autoComplete="email"
        autoFocus
        value={loginForm.email}
        onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
        disabled={isLoading}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label={t('auth.password')}
        type={showPassword ? 'text' : 'password'}
        id="password"
        autoComplete="current-password"
        value={loginForm.password}
        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
        disabled={isLoading}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={t('auth.togglePasswordVisibility')}
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                disabled={isLoading}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <FormControlLabel
        control={
          <Checkbox
            value="remember"
            color="primary"
            checked={loginForm.rememberMe}
            onChange={(e) => setLoginForm(prev => ({ ...prev, rememberMe: e.target.checked }))}
            disabled={isLoading}
          />
        }
        label={t('auth.rememberMe')}
      />
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2 }}
        disabled={isLoading || !loginForm.email || !loginForm.password}
        startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
      >
        {isLoading ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
      <Box sx={{ textAlign: 'center' }}>
        <Link
          component="button"
          variant="body2"
          onClick={() => setMode('forgot-password')}
          disabled={isLoading}
        >
          {t('auth.forgotPassword')}
        </Link>
      </Box>
    </Box>
  );
  
  // Render register form
  const renderRegisterForm = () => (
    <Box component="form" onSubmit={handleRegister} sx={{ mt: 1 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        id="name"
        label={t('auth.fullName')}
        name="name"
        autoComplete="name"
        autoFocus
        value={registerForm.name}
        onChange={(e) => setRegisterForm(prev => ({ ...prev, name: e.target.value }))}
        disabled={isLoading}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        label={t('auth.email')}
        name="email"
        autoComplete="email"
        value={registerForm.email}
        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
        disabled={isLoading}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label={t('auth.password')}
        type={showPassword ? 'text' : 'password'}
        id="password"
        autoComplete="new-password"
        value={registerForm.password}
        onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
        disabled={isLoading}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={t('auth.togglePasswordVisibility')}
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                disabled={isLoading}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="confirmPassword"
        label={t('auth.confirmPassword')}
        type={showConfirmPassword ? 'text' : 'password'}
        id="confirmPassword"
        autoComplete="new-password"
        value={registerForm.confirmPassword}
        onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
        disabled={isLoading}
        error={registerForm.confirmPassword !== '' && registerForm.password !== registerForm.confirmPassword}
        helperText={
          registerForm.confirmPassword !== '' && registerForm.password !== registerForm.confirmPassword
            ? t('auth.passwordsDoNotMatch')
            : ''
        }
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={t('auth.togglePasswordVisibility')}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                edge="end"
                disabled={isLoading}
              >
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3, mb: 2 }}
        disabled={
          isLoading ||
          !registerForm.name ||
          !registerForm.email ||
          !registerForm.password ||
          !registerForm.confirmPassword ||
          registerForm.password !== registerForm.confirmPassword
        }
        startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
      >
        {isLoading ? t('auth.creatingAccount') : t('auth.createAccount')}
      </Button>
    </Box>
  );
  
  // Render forgot password form
  const renderForgotPasswordForm = () => {
    if (resetSent) {
      return (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            {t('auth.resetEmailSent')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('auth.resetEmailSentDescription')}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setMode('login');
              setResetSent(false);
              setForgotEmail('');
            }}
          >
            {t('auth.backToLogin')}
          </Button>
        </Box>
      );
    }
    
    return (
      <Box component="form" onSubmit={handleForgotPassword} sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t('auth.forgotPasswordDescription')}
        </Typography>
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label={t('auth.email')}
          name="email"
          autoComplete="email"
          autoFocus
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
          disabled={isLoading}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading || !forgotEmail}
          startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
        >
          {isLoading ? t('auth.sendingReset') : t('auth.sendResetEmail')}
        </Button>
      </Box>
    );
  };
  
  // Render social login buttons
  const renderSocialLogin = () => (
    <>
      <Divider sx={{ my: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t('auth.orContinueWith')}
        </Typography>
      </Divider>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
        <IconButton
          onClick={() => handleSocialLogin('google')}
          disabled={isLoading}
          sx={{
            border: 1,
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <GoogleIcon />
        </IconButton>
        <IconButton
          onClick={() => handleSocialLogin('github')}
          disabled={isLoading}
          sx={{
            border: 1,
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <GitHubIcon />
        </IconButton>
        <IconButton
          onClick={() => handleSocialLogin('microsoft')}
          disabled={isLoading}
          sx={{
            border: 1,
            borderColor: 'divider',
            '&:hover': {
              borderColor: 'primary.main',
            },
          }}
        >
          <MicrosoftIcon />
        </IconButton>
      </Box>
    </>
  );
  
  if (isLoading && isAuthenticated) {
    return <LoadingSpinner fullScreen message={t('auth.redirecting')} />;
  }
  
  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Card
          sx={{
            p: isMobile ? 2 : 4,
            boxShadow: theme.shadows[isDarkMode ? 8 : 4],
          }}
        >
          <CardContent>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography component="h1" variant="h4" gutterBottom>
                {mode === 'login' && t('auth.welcomeBack')}
                {mode === 'register' && t('auth.createAccount')}
                {mode === 'forgot-password' && t('auth.resetPassword')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mode === 'login' && t('auth.signInDescription')}
                {mode === 'register' && t('auth.signUpDescription')}
                {mode === 'forgot-password' && t('auth.resetPasswordDescription')}
              </Typography>
            </Box>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {mode === 'login' && renderLoginForm()}
            {mode === 'register' && renderRegisterForm()}
            {mode === 'forgot-password' && renderForgotPasswordForm()}
            
            {mode !== 'forgot-password' && !resetSent && renderSocialLogin()}
            
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              {mode === 'login' && (
                <Typography variant="body2">
                  {t('auth.noAccount')}{' '}
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => setMode('register')}
                    disabled={isLoading}
                  >
                    {t('auth.signUp')}
                  </Link>
                </Typography>
              )}
              {mode === 'register' && (
                <Typography variant="body2">
                  {t('auth.haveAccount')}{' '}
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => setMode('login')}
                    disabled={isLoading}
                  >
                    {t('auth.signIn')}
                  </Link>
                </Typography>
              )}
              {mode === 'forgot-password' && !resetSent && (
                <Typography variant="body2">
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => setMode('login')}
                    disabled={isLoading}
                  >
                    {t('auth.backToLogin')}
                  </Link>
                </Typography>
              )}
            </Box>
            
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {t('auth.demoCredentials')}: demo@example.com / password
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default LoginPage;