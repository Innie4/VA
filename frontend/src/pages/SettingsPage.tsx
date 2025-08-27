import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Button,

  Divider,
  Alert,
  Chip,

  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  DarkMode,
  LightMode,
  VolumeUp,
  VolumeOff,
  Notifications,
  NotificationsOff,
  Language,
  Palette,
  Accessibility,
  Security,
  Download,
  Delete,
  Help,
  Info,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@store/themeStore';
import { useAuthStore } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { supportedLanguages, SupportedLanguage } from '../i18n/config';
import { useKeyboardShortcutsHelp } from '@hooks/useKeyboardShortcuts';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Store hooks
  const {
    isDarkMode,
    fontSize,
    highContrast,
    reducedMotion,
    toggleDarkMode,
    setFontSize,
    setHighContrast,
    setReducedMotion,
  } = useThemeStore();
  
  const { user, updateProfile } = useAuthStore();
  const { conversations, clearMessages } = useChatStore();
  const { groupedShortcuts, formatShortcut } = useKeyboardShortcutsHelp();
  
  // State
  const [selectedSection, setSelectedSection] = useState('appearance');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [notifications, setNotifications] = useState({
    desktop: true,
    sound: true,
    email: false,
  });
  const [privacy, setPrivacy] = useState({
    analytics: true,
    crashReports: true,
    dataCollection: false,
  });
  
  // Handle language change
  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    if (user) {
      updateProfile({
        preferences: {
          ...user.preferences,
          language: languageCode,
        },
      });
    }
  };
  
  // Handle export data
  const handleExportData = () => {
    const data = {
      conversations,
      settings: {
        theme: isDarkMode ? 'dark' : 'light',
        language: i18n.language,
        fontSize,
        highContrast,
        reducedMotion,
        notifications,
        privacy,
      },
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `va-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setShowExportDialog(false);
  };
  
  // Handle clear data
  const handleClearData = () => {
    clearMessages();
    // Clear other data as needed
    setShowClearDataDialog(false);
  };
  
  // Appearance settings
  const AppearanceSettings = () => (
    <Card>
      <CardHeader
        title={t('settings.appearance.title')}
        avatar={<Palette />}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={isDarkMode}
                onChange={toggleDarkMode}
                icon={<LightMode />}
                checkedIcon={<DarkMode />}
              />
            }
            label={t('settings.appearance.darkMode')}
          />
          
          <Box>
            <Typography gutterBottom>
              {t('settings.appearance.fontSize')}
            </Typography>
            <Slider
              value={fontSize === 'small' ? 0 : fontSize === 'medium' ? 1 : 2}
              onChange={(_, value) => {
                const sizes = ['small', 'medium', 'large'] as const;
                setFontSize(sizes[value as number]);
              }}
              step={1}
              marks={[
                { value: 0, label: t('settings.appearance.small') },
                { value: 1, label: t('settings.appearance.medium') },
                { value: 2, label: t('settings.appearance.large') },
              ]}
              min={0}
              max={2}
            />
          </Box>
          
          <FormControlLabel
            control={
              <Switch
                checked={highContrast}
                onChange={(e) => setHighContrast(e.target.checked)}
              />
            }
            label={t('settings.appearance.highContrast')}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={reducedMotion}
                onChange={(e) => setReducedMotion(e.target.checked)}
              />
            }
            label={t('settings.appearance.reducedMotion')}
          />
        </Box>
      </CardContent>
    </Card>
  );
  
  // Language settings
  const LanguageSettings = () => (
    <Card>
      <CardHeader
        title={t('settings.language.title')}
        avatar={<Language />}
      />
      <CardContent>
        <FormControl fullWidth>
          <InputLabel>{t('settings.language.select')}</InputLabel>
          <Select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            label={t('settings.language.select')}
          >
            {supportedLanguages.map((lang: SupportedLanguage) => (
              <MenuItem key={lang.code} value={lang.code}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </CardContent>
    </Card>
  );
  
  // Notification settings
  const NotificationSettings = () => (
    <Card>
      <CardHeader
        title={t('settings.notifications.title')}
        avatar={notifications.desktop ? <Notifications /> : <NotificationsOff />}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={notifications.desktop}
                onChange={(e) => setNotifications(prev => ({ ...prev, desktop: e.target.checked }))}
              />
            }
            label={t('settings.notifications.desktop')}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={notifications.sound}
                onChange={(e) => setNotifications(prev => ({ ...prev, sound: e.target.checked }))}
                icon={<VolumeOff />}
                checkedIcon={<VolumeUp />}
              />
            }
            label={t('settings.notifications.sound')}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={notifications.email}
                onChange={(e) => setNotifications(prev => ({ ...prev, email: e.target.checked }))}
              />
            }
            label={t('settings.notifications.email')}
          />
        </Box>
      </CardContent>
    </Card>
  );
  
  // Privacy settings
  const PrivacySettings = () => (
    <Card>
      <CardHeader
        title={t('settings.privacy.title')}
        avatar={<Security />}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={privacy.analytics}
                onChange={(e) => setPrivacy(prev => ({ ...prev, analytics: e.target.checked }))}
              />
            }
            label={t('settings.privacy.analytics')}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={privacy.crashReports}
                onChange={(e) => setPrivacy(prev => ({ ...prev, crashReports: e.target.checked }))}
              />
            }
            label={t('settings.privacy.crashReports')}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={privacy.dataCollection}
                onChange={(e) => setPrivacy(prev => ({ ...prev, dataCollection: e.target.checked }))}
              />
            }
            label={t('settings.privacy.dataCollection')}
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => setShowExportDialog(true)}
            >
              {t('settings.privacy.exportData')}
            </Button>
            
            <Button
              variant="outlined"
              color="error"
              startIcon={<Delete />}
              onClick={() => setShowClearDataDialog(true)}
            >
              {t('settings.privacy.clearData')}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
  
  // Accessibility settings
  const AccessibilitySettings = () => (
    <Card>
      <CardHeader
        title={t('settings.accessibility.title')}
        avatar={<Accessibility />}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info">
            {t('settings.accessibility.description')}
          </Alert>
          
          <Button
            variant="outlined"
            startIcon={<Help />}
            onClick={() => setShowShortcuts(true)}
          >
            {t('settings.accessibility.keyboardShortcuts')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
  
  // About section
  const AboutSettings = () => (
    <Card>
      <CardHeader
        title={t('settings.about.title')}
        avatar={<Info />}
      />
      <CardContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2">
            {t('settings.about.version')}: 1.0.0
          </Typography>
          
          <Typography variant="body2">
            {t('settings.about.description')}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={t('settings.about.openSource')} variant="outlined" />
            <Chip label={t('settings.about.privacy')} variant="outlined" />
            <Chip label={t('settings.about.secure')} variant="outlined" />
          </Box>
          
          <Button variant="outlined" href="#" target="_blank">
            {t('settings.about.documentation')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
  
  const sections: SettingsSection[] = [
    {
      id: 'appearance',
      title: t('settings.appearance.title'),
      icon: <Palette />,
      component: <AppearanceSettings />,
    },
    {
      id: 'language',
      title: t('settings.language.title'),
      icon: <Language />,
      component: <LanguageSettings />,
    },
    {
      id: 'notifications',
      title: t('settings.notifications.title'),
      icon: <Notifications />,
      component: <NotificationSettings />,
    },
    {
      id: 'privacy',
      title: t('settings.privacy.title'),
      icon: <Security />,
      component: <PrivacySettings />,
    },
    {
      id: 'accessibility',
      title: t('settings.accessibility.title'),
      icon: <Accessibility />,
      component: <AccessibilitySettings />,
    },
    {
      id: 'about',
      title: t('settings.about.title'),
      icon: <Info />,
      component: <AboutSettings />,
    },
  ];
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('settings.title')}
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 3, flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Sidebar */}
        <Box sx={{ minWidth: isMobile ? 'auto' : 250 }}>
          <Card>
            <List>
              {sections.map((section) => (
                <ListItem
                  key={section.id}
                  button
                  selected={selectedSection === section.id}
                  onClick={() => setSelectedSection(section.id)}
                >
                  <Box sx={{ mr: 2 }}>{section.icon}</Box>
                  <ListItemText primary={section.title} />
                </ListItem>
              ))}
            </List>
          </Card>
        </Box>
        
        {/* Content */}
        <Box sx={{ flex: 1 }}>
          {sections.find(s => s.id === selectedSection)?.component}
        </Box>
      </Box>
      
      {/* Keyboard Shortcuts Dialog */}
      <Dialog
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('settings.accessibility.keyboardShortcuts')}</DialogTitle>
        <DialogContent>
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {category}
              </Typography>
              <List dense>
                {shortcuts.map((shortcut, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={shortcut.description}
                      secondary={
                        <Chip
                          label={formatShortcut(shortcut)}
                          size="small"
                          variant="outlined"
                        />
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShortcuts(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Export Data Dialog */}
      <Dialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      >
        <DialogTitle>{t('settings.privacy.exportData')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('settings.privacy.exportDataDescription')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleExportData} variant="contained">
            {t('common.export')}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Clear Data Dialog */}
      <Dialog
        open={showClearDataDialog}
        onClose={() => setShowClearDataDialog(false)}
      >
        <DialogTitle>{t('settings.privacy.clearData')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('settings.privacy.clearDataWarning')}
          </Alert>
          <Typography>
            {t('settings.privacy.clearDataDescription')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearDataDialog(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleClearData} color="error" variant="contained">
            {t('common.clear')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SettingsPage;