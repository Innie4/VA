import { createTheme, Theme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Custom color palette
const lightPalette = {
  primary: {
    main: '#1976d2',
    light: '#42a5f5',
    dark: '#1565c0',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#dc004e',
    light: '#ff5983',
    dark: '#9a0036',
    contrastText: '#ffffff',
  },
  background: {
    default: '#fafafa',
    paper: '#ffffff',
  },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
  },
};

const darkPalette = {
  primary: {
    main: '#90caf9',
    light: '#e3f2fd',
    dark: '#42a5f5',
    contrastText: '#000000',
  },
  secondary: {
    main: '#f48fb1',
    light: '#ffc1e3',
    dark: '#bf5f82',
    contrastText: '#000000',
  },
  background: {
    default: '#121212',
    paper: '#1e1e1e',
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
  },
};

export const createAppTheme = (isDarkMode: boolean): Theme => {
  const mode: PaletteMode = isDarkMode ? 'dark' : 'light';
  const palette = isDarkMode ? darkPalette : lightPalette;

  return createTheme({
    palette: {
      mode,
      ...palette,
      error: {
        main: '#f44336',
        light: '#e57373',
        dark: '#d32f2f',
      },
      warning: {
        main: '#ff9800',
        light: '#ffb74d',
        dark: '#f57c00',
      },
      info: {
        main: '#2196f3',
        light: '#64b5f6',
        dark: '#1976d2',
      },
      success: {
        main: '#4caf50',
        light: '#81c784',
        dark: '#388e3c',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 300,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 300,
        lineHeight: 1.2,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 400,
        lineHeight: 1.2,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 400,
        lineHeight: 1.2,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 500,
        lineHeight: 1.2,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.2,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.43,
      },
    },
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: isDarkMode ? '#6b6b6b #2b2b2b' : '#c1c1c1 #f1f1f1',
            '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
              backgroundColor: isDarkMode ? '#2b2b2b' : '#f1f1f1',
              width: 8,
            },
            '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
              borderRadius: 8,
              backgroundColor: isDarkMode ? '#6b6b6b' : '#c1c1c1',
              minHeight: 24,
            },
            '&::-webkit-scrollbar-thumb:focus, & *::-webkit-scrollbar-thumb:focus': {
              backgroundColor: isDarkMode ? '#959595' : '#a8a8a8',
            },
            '&::-webkit-scrollbar-thumb:active, & *::-webkit-scrollbar-thumb:active': {
              backgroundColor: isDarkMode ? '#959595' : '#a8a8a8',
            },
            '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
              backgroundColor: isDarkMode ? '#959595' : '#a8a8a8',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 500,
            padding: '8px 16px',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: isDarkMode
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
          },
        },
      },
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 900,
        lg: 1200,
        xl: 1536,
      },
    },
  });
};

// Custom theme extensions
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      chatBubble: {
        user: {
          backgroundColor: string;
          color: string;
        };
        assistant: {
          backgroundColor: string;
          color: string;
        };
      };
    };
  }

  interface ThemeOptions {
    custom?: {
      chatBubble?: {
        user?: {
          backgroundColor?: string;
          color?: string;
        };
        assistant?: {
          backgroundColor?: string;
          color?: string;
        };
      };
    };
  }
}