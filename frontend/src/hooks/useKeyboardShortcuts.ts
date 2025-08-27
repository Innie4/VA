import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '@store/chatStore';
import { useThemeStore } from '@store/themeStore';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  target?: HTMLElement | Document;
}

interface UseKeyboardShortcutsReturn {
  shortcuts: KeyboardShortcut[];
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useKeyboardShortcuts = (
  options: UseKeyboardShortcutsOptions = {}
): UseKeyboardShortcutsReturn => {
  const { enabled = true, target = document } = options;
  const { t } = useTranslation();
  const enabledRef = useRef(enabled);
  
  // Store actions
  const {
    createNewConversation,
    deleteConversation,
    currentConversationId,
    conversations,
    selectConversation,
    clearMessages,
  } = useChatStore();
  
  const { toggleDarkMode, increaseFontSize, decreaseFontSize } = useThemeStore();
  
  // Update enabled state
  const setEnabled = useCallback((newEnabled: boolean) => {
    enabledRef.current = newEnabled;
  }, []);
  
  // Navigation shortcuts
  const navigateToNextConversation = useCallback(() => {
    if (!currentConversationId || conversations.length === 0) return;
    
    const currentIndex = conversations.findIndex(c => c.id === currentConversationId);
    const nextIndex = (currentIndex + 1) % conversations.length;
    selectConversation(conversations[nextIndex].id);
  }, [currentConversationId, conversations, selectConversation]);
  
  const navigateToPreviousConversation = useCallback(() => {
    if (!currentConversationId || conversations.length === 0) return;
    
    const currentIndex = conversations.findIndex(c => c.id === currentConversationId);
    const prevIndex = currentIndex === 0 ? conversations.length - 1 : currentIndex - 1;
    selectConversation(conversations[prevIndex].id);
  }, [currentConversationId, conversations, selectConversation]);
  
  // Focus management
  const focusMessageInput = useCallback(() => {
    const messageInput = document.querySelector('[data-testid="message-input"]') as HTMLElement;
    if (messageInput) {
      messageInput.focus();
    }
  }, []);
  
  const focusSearchInput = useCallback(() => {
    const searchInput = document.querySelector('[data-testid="search-input"]') as HTMLElement;
    if (searchInput) {
      searchInput.focus();
    }
  }, []);
  
  // Sidebar management
  const toggleSidebar = useCallback(() => {
    const sidebarToggle = document.querySelector('[data-testid="sidebar-toggle"]') as HTMLButtonElement;
    if (sidebarToggle) {
      sidebarToggle.click();
    }
  }, []);
  
  // Voice shortcuts
  const toggleVoiceRecording = useCallback(() => {
    const voiceButton = document.querySelector('[data-testid="voice-button"]') as HTMLButtonElement;
    if (voiceButton) {
      voiceButton.click();
    }
  }, []);
  
  // File upload
  const triggerFileUpload = useCallback(() => {
    const fileInput = document.querySelector('[data-testid="file-input"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }, []);
  
  // Settings
  const openSettings = useCallback(() => {
    const settingsButton = document.querySelector('[data-testid="settings-button"]') as HTMLButtonElement;
    if (settingsButton) {
      settingsButton.click();
    }
  }, []);
  
  // Help
  const openHelp = useCallback(() => {
    const helpButton = document.querySelector('[data-testid="help-button"]') as HTMLButtonElement;
    if (helpButton) {
      helpButton.click();
    }
  }, []);
  
  // Define shortcuts
  const shortcuts: KeyboardShortcut[] = [
    // Navigation
    {
      key: 'n',
      ctrlKey: true,
      action: createNewConversation,
      description: t('shortcuts.newConversation'),
      category: t('shortcuts.categories.navigation'),
      preventDefault: true,
    },
    {
      key: 'ArrowDown',
      ctrlKey: true,
      action: navigateToNextConversation,
      description: t('shortcuts.nextConversation'),
      category: t('shortcuts.categories.navigation'),
      preventDefault: true,
    },
    {
      key: 'ArrowUp',
      ctrlKey: true,
      action: navigateToPreviousConversation,
      description: t('shortcuts.previousConversation'),
      category: t('shortcuts.categories.navigation'),
      preventDefault: true,
    },
    {
      key: 'j',
      ctrlKey: true,
      action: navigateToNextConversation,
      description: t('shortcuts.nextConversation'),
      category: t('shortcuts.categories.navigation'),
      preventDefault: true,
    },
    {
      key: 'k',
      ctrlKey: true,
      action: navigateToPreviousConversation,
      description: t('shortcuts.previousConversation'),
      category: t('shortcuts.categories.navigation'),
      preventDefault: true,
    },
    
    // Focus management
    {
      key: '/',
      action: focusMessageInput,
      description: t('shortcuts.focusInput'),
      category: t('shortcuts.categories.focus'),
      preventDefault: true,
    },
    {
      key: 'f',
      ctrlKey: true,
      action: focusSearchInput,
      description: t('shortcuts.focusSearch'),
      category: t('shortcuts.categories.focus'),
      preventDefault: true,
    },
    {
      key: 'Escape',
      action: () => {
        // Clear focus from any input
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
      },
      description: t('shortcuts.clearFocus'),
      category: t('shortcuts.categories.focus'),
    },
    
    // Interface
    {
      key: 'b',
      ctrlKey: true,
      action: toggleSidebar,
      description: t('shortcuts.toggleSidebar'),
      category: t('shortcuts.categories.interface'),
      preventDefault: true,
    },
    {
      key: 'd',
      ctrlKey: true,
      shiftKey: true,
      action: toggleDarkMode,
      description: t('shortcuts.toggleDarkMode'),
      category: t('shortcuts.categories.interface'),
      preventDefault: true,
    },
    {
      key: '=',
      ctrlKey: true,
      action: increaseFontSize,
      description: t('shortcuts.increaseFontSize'),
      category: t('shortcuts.categories.interface'),
      preventDefault: true,
    },
    {
      key: '-',
      ctrlKey: true,
      action: decreaseFontSize,
      description: t('shortcuts.decreaseFontSize'),
      category: t('shortcuts.categories.interface'),
      preventDefault: true,
    },
    
    // Actions
    {
      key: 'Delete',
      ctrlKey: true,
      action: () => {
        if (currentConversationId) {
          deleteConversation(currentConversationId);
        }
      },
      description: t('shortcuts.deleteConversation'),
      category: t('shortcuts.categories.actions'),
      preventDefault: true,
    },
    {
      key: 'l',
      ctrlKey: true,
      action: clearMessages,
      description: t('shortcuts.clearMessages'),
      category: t('shortcuts.categories.actions'),
      preventDefault: true,
    },
    
    // Voice and files
    {
      key: 'r',
      ctrlKey: true,
      action: toggleVoiceRecording,
      description: t('shortcuts.toggleVoice'),
      category: t('shortcuts.categories.input'),
      preventDefault: true,
    },
    {
      key: 'u',
      ctrlKey: true,
      action: triggerFileUpload,
      description: t('shortcuts.uploadFile'),
      category: t('shortcuts.categories.input'),
      preventDefault: true,
    },
    
    // Help and settings
    {
      key: ',',
      ctrlKey: true,
      action: openSettings,
      description: t('shortcuts.openSettings'),
      category: t('shortcuts.categories.help'),
      preventDefault: true,
    },
    {
      key: '?',
      ctrlKey: true,
      action: openHelp,
      description: t('shortcuts.openHelp'),
      category: t('shortcuts.categories.help'),
      preventDefault: true,
    },
    {
      key: 'F1',
      action: openHelp,
      description: t('shortcuts.openHelp'),
      category: t('shortcuts.categories.help'),
      preventDefault: true,
    },
  ];
  
  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabledRef.current) return;
      
      // Don't trigger shortcuts when typing in inputs (except for specific cases)
      const target = event.target as HTMLElement;
      const isInputElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
      
      // Allow certain shortcuts even in input elements
      const allowedInInputs = ['Escape', 'F1'];
      const isAllowedInInput = allowedInInputs.includes(event.key) || 
        (event.ctrlKey && ['n', 'f', 'b', 'd', 'r', 'u', ',', '?', '=', '-', 'l', 'Delete', 'ArrowUp', 'ArrowDown', 'j', 'k'].includes(event.key));
      
      if (isInputElement && !isAllowedInInput) {
        return;
      }
      
      // Find matching shortcut
      const matchingShortcut = shortcuts.find(shortcut => {
        return (
          shortcut.key === event.key &&
          !!shortcut.ctrlKey === event.ctrlKey &&
          !!shortcut.shiftKey === event.shiftKey &&
          !!shortcut.altKey === event.altKey &&
          !!shortcut.metaKey === event.metaKey
        );
      });
      
      if (matchingShortcut) {
        if (matchingShortcut.preventDefault) {
          event.preventDefault();
        }
        
        try {
          matchingShortcut.action();
        } catch (error) {
          console.error('Error executing keyboard shortcut:', error);
        }
      }
    },
    [shortcuts]
  );
  
  // Set up event listeners
  useEffect(() => {
    const targetElement = target as EventTarget;
    
    if (enabled) {
      targetElement.addEventListener('keydown', handleKeyDown as EventListener);
    }
    
    return () => {
      targetElement.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, target, handleKeyDown]);
  
  // Update enabled ref when prop changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  
  return {
    shortcuts,
    isEnabled: enabledRef.current,
    setEnabled,
  };
};

// Hook for displaying keyboard shortcuts help
export const useKeyboardShortcutsHelp = () => {
  const { shortcuts } = useKeyboardShortcuts({ enabled: false });
  
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    const category = shortcut.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);
  
  // Format shortcut key combination
  const formatShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const parts: string[] = [];
    
    if (shortcut.ctrlKey) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
    if (shortcut.shiftKey) parts.push('Shift');
    if (shortcut.altKey) parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
    if (shortcut.metaKey) parts.push('Meta');
    
    // Format special keys
    let key = shortcut.key;
    switch (key) {
      case 'ArrowUp':
        key = '↑';
        break;
      case 'ArrowDown':
        key = '↓';
        break;
      case 'ArrowLeft':
        key = '←';
        break;
      case 'ArrowRight':
        key = '→';
        break;
      case ' ':
        key = 'Space';
        break;
      case 'Escape':
        key = 'Esc';
        break;
      case 'Delete':
        key = 'Del';
        break;
      default:
        key = key.toUpperCase();
    }
    
    parts.push(key);
    
    return parts.join(' + ');
  }, []);
  
  return {
    shortcuts,
    groupedShortcuts,
    formatShortcut,
  };
};

// Hook for handling message input shortcuts
export const useMessageInputShortcuts = (onSend: () => void, onNewLine?: () => void) => {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Send message with Enter (but not Shift+Enter)
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSend();
        return;
      }
      
      // New line with Shift+Enter
      if (event.key === 'Enter' && event.shiftKey && onNewLine) {
        // Let the default behavior happen (new line)
        onNewLine();
        return;
      }
    },
    [onSend, onNewLine]
  );
  
  return { handleKeyDown };
};