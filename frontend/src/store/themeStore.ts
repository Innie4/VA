import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  isDarkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
  toggleDarkMode: () => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

const defaultState = {
  isDarkMode: false,
  fontSize: 'medium' as const,
  highContrast: false,
  reducedMotion: false,
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      ...defaultState,
      
      toggleDarkMode: () => {
        set((state) => ({ isDarkMode: !state.isDarkMode }));
      },
      
      setFontSize: (size) => {
        set({ fontSize: size });
      },
      
      increaseFontSize: () => {
        const { fontSize } = get();
        const sizes = ['small', 'medium', 'large'] as const;
        const currentIndex = sizes.indexOf(fontSize);
        if (currentIndex < sizes.length - 1) {
          set({ fontSize: sizes[currentIndex + 1] });
        }
      },
      
      decreaseFontSize: () => {
        const { fontSize } = get();
        const sizes = ['small', 'medium', 'large'] as const;
        const currentIndex = sizes.indexOf(fontSize);
        if (currentIndex > 0) {
          set({ fontSize: sizes[currentIndex - 1] });
        }
      },
      
      setHighContrast: (enabled) => {
        set({ highContrast: enabled });
      },
      
      setReducedMotion: (enabled) => {
        set({ reducedMotion: enabled });
      },
      
      resetToDefaults: () => {
        set(defaultState);
      },
    }),
    {
      name: 'theme-preferences',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration if needed
        if (version === 0) {
          return {
            ...defaultState,
            isDarkMode: persistedState?.isDarkMode ?? defaultState.isDarkMode,
          };
        }
        return persistedState;
      },
    }
  )
);

// Initialize theme based on system preference if no saved preference exists
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('theme-preferences');
  if (!savedTheme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    useThemeStore.setState({
      isDarkMode: prefersDark,
      reducedMotion: prefersReducedMotion,
      highContrast: prefersHighContrast,
    });
  }
  
  // Listen for system theme changes
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const highContrastMediaQuery = window.matchMedia('(prefers-contrast: high)');
  
  const handleDarkModeChange = () => {
    const savedTheme = localStorage.getItem('theme-preferences');
    if (!savedTheme) {
      useThemeStore.getState().toggleDarkMode();
    }
  };
  
  const handleReducedMotionChange = (e: MediaQueryListEvent) => {
    useThemeStore.getState().setReducedMotion(e.matches);
  };
  
  const handleHighContrastChange = (e: MediaQueryListEvent) => {
    useThemeStore.getState().setHighContrast(e.matches);
  };
  
  darkModeMediaQuery.addEventListener('change', handleDarkModeChange);
  reducedMotionMediaQuery.addEventListener('change', handleReducedMotionChange);
  highContrastMediaQuery.addEventListener('change', handleHighContrastChange);
}