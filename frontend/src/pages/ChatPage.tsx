import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  useMediaQuery,
  useTheme,
  Fab,
  Badge,
} from '@mui/material';
import {
  MenuRounded,
  SettingsRounded,
  DarkModeRounded,
  LightModeRounded,
  HistoryRounded,
  AddRounded,
  LoginRounded,
  AccountCircleRounded,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { ChatContainer, ChatContainerRef } from '@components/chat/ChatContainer';
import { ChatInput } from '@components/chat/ChatInput';
import { ConversationSidebar } from '@components/chat/ConversationSidebar';
import { ConnectionStatus, ConnectionState } from '@components/chat/ConnectionStatus';
import { VoiceRecorder } from '@components/chat/VoiceRecorder';
import { FileUpload } from '@components/chat/FileUpload';
import { useChatStore } from '@store/chatStore';
import { useSocketConnection } from '@hooks/useSocketConnection';
import { useVoiceRecognition } from '@hooks/useVoiceRecognition';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';

const DRAWER_WIDTH = 320;

export default function ChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isDarkMode, toggleDarkMode } = useThemeStore();
  const { isAuthenticated, logout } = useAuthStore();
  const {
    messages,
    isTyping,
    currentConversationId,
    conversations,
    createNewConversation,
    sendMessage,
  } = useChatStore();
  
  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const chatContainerRef = useRef<ChatContainerRef>(null);
  
  const { isConnected, connectionStatus } = useSocketConnection();
  const {
    isListening,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    transcript,
  } = useVoiceRecognition();

  // Handle drawer toggle
  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  // Handle click outside sidebar to close it
  const handleBackdropClick = useCallback(() => {
    if (drawerOpen) {
      setDrawerOpen(false);
    }
  }, [drawerOpen]);

  // Handle click outside for persistent drawer on desktop
  const handleMainContentClick = useCallback(() => {
    if (drawerOpen && !isMobile) {
      setDrawerOpen(false);
    }
  }, [drawerOpen, isMobile]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    createNewConversation();
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [createNewConversation, isMobile]);

  // Handle login navigation
  const handleLogin = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  // Handle settings navigation
  const handleSettings = useCallback(() => {
    if (isAuthenticated) {
      navigate('/settings');
    } else {
      navigate('/login');
    }
  }, [navigate, isAuthenticated]);

  // Handle message send
  const handleSendMessage = useCallback(async (content: string, files?: File[]) => {
    if (!content.trim() && !files?.length) return;
    
    try {
      await sendMessage({
        content: content.trim(),
        files,
        conversationId: currentConversationId || undefined,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [sendMessage, currentConversationId]);

  // Handle voice message
  const handleVoiceMessage = useCallback((transcript: string) => {
    if (transcript.trim()) {
      handleSendMessage(transcript);
    }
  }, [handleSendMessage]);

  // Handle file upload
  const handleFileUpload = useCallback((files: File[]) => {
    handleSendMessage('', files);
    setShowFileUpload(false);
  }, [handleSendMessage]);

  // Keyboard shortcuts
  useKeyboardShortcuts({ enabled: true });

  // Auto-close drawer on mobile when conversation changes
  useEffect(() => {
    if (isMobile && currentConversationId) {
      setDrawerOpen(false);
    }
  }, [currentConversationId, isMobile]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript && !isListening) {
      handleVoiceMessage(transcript);
    }
  }, [transcript, isListening, handleVoiceMessage]);

  const drawerContent = (
    <ConversationSidebar
      conversations={conversations}
      currentConversationId={currentConversationId || undefined}
      onNewConversation={handleNewConversation}
      onSelectConversation={() => {
        // Handle conversation selection
        if (isMobile) setDrawerOpen(false);
      }}
    />
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: 'background.paper',
          color: 'text.primary',
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={handleDrawerToggle}
            aria-label={t('accessibility.openMenu')}
            sx={{ mr: 2 }}
          >
            <MenuRounded />
          </IconButton>
          
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
            {t('chat.title')}
          </Typography>
          
          <ConnectionStatus
            isConnected={isConnected}
            status={connectionStatus as ConnectionState}
          />
          
          <IconButton
            onClick={toggleDarkMode}
            aria-label={t('accessibility.toggleTheme')}
            sx={{ ml: 1 }}
          >
            {isDarkMode ? <LightModeRounded /> : <DarkModeRounded />}
          </IconButton>
          
          <IconButton
            onClick={handleSettings}
            aria-label={t('navigation.settings')}
            sx={{ ml: 1 }}
          >
            <SettingsRounded />
          </IconButton>
          
          {isAuthenticated ? (
            <IconButton
              onClick={handleLogout}
              aria-label={t('auth.logout')}
              sx={{ ml: 1 }}
            >
              <AccountCircleRounded />
            </IconButton>
          ) : (
            <IconButton
              onClick={handleLogin}
              aria-label={t('auth.login')}
              sx={{ ml: 1 }}
            >
              <LoginRounded />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'persistent'}
        open={drawerOpen}
        onClose={isMobile ? handleBackdropClick : handleDrawerToggle}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
          },
        }}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
      >
        <Toolbar /> {/* Spacer for app bar */}
        {drawerContent}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        onClick={handleMainContentClick}
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          transition: theme.transitions.create('margin', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          ...(drawerOpen && !isMobile && {
            marginLeft: DRAWER_WIDTH,
            transition: theme.transitions.create('margin', {
              easing: theme.transitions.easing.easeOut,
              duration: theme.transitions.duration.enteringScreen,
            }),
          }),
        }}
      >
        <Toolbar /> {/* Spacer for app bar */}
        
        {/* Centered Chat Container */}
        <Box 
          sx={{ 
            flexGrow: 1, 
            overflow: 'hidden', 
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 1, sm: 2, md: 3 },
          }}
        >
          <Box 
            sx={{
              width: '100%',
              maxWidth: { xs: '100%', sm: '800px', md: '900px', lg: '1000px' },
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <ChatContainer
                ref={chatContainerRef}
                messages={messages}
                isTyping={isTyping}
                isConnected={isConnected}
              />
            </Box>
            
            {/* Chat Input */}
            <Paper
              elevation={3}
              sx={{
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                mt: 2,
              }}
            >
              <Box sx={{ p: 2 }}>
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={!isConnected}
                  isListening={isListening}
                  onStartVoice={() => {
                    if (voiceSupported) {
                      startListening();
                      setShowVoiceRecorder(true);
                    }
                  }}
                  onStopVoice={() => {
                    stopListening();
                    setShowVoiceRecorder(false);
                  }}
                  voiceSupported={voiceSupported}
                  placeholder="Ask me anything! I'm here to help with tasks, answer questions, solve problems, and provide guidance."
                />
              </Box>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Floating Action Buttons */}
      {isMobile && (
        <>
          <Fab
            color="primary"
            aria-label={t('chat.newConversation')}
            onClick={handleNewConversation}
            sx={{
              position: 'fixed',
              bottom: 100,
              right: 16,
              zIndex: 1000,
            }}
          >
            <AddRounded />
          </Fab>
          
          <Fab
            color="secondary"
            aria-label={t('chat.conversationHistory')}
            onClick={() => setDrawerOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 160,
              right: 16,
              zIndex: 1000,
            }}
          >
            <Badge badgeContent={conversations.length} color="error">
              <HistoryRounded />
            </Badge>
          </Fab>
        </>
      )}

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          isListening={isListening}
          transcript={transcript}
          onStop={stopListening}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload
          onUpload={handleFileUpload}
          onClose={() => setShowFileUpload(false)}
        />
      )}
    </Box>
  );
}