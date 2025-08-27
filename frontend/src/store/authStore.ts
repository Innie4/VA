import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences: {
    language: string;
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    emailUpdates: boolean;
  };
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: Date;
  };
  createdAt: Date;
  lastLoginAt?: Date;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface ResetPasswordData {
  email: string;
}

interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Computed
  token: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
  
  // Internal
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// API functions for backend communication
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }
    
    const data = await response.json();
    
    const user: User = {
      id: data.data.user.id,
      email: data.data.user.email,
      name: `${data.data.user.firstName} ${data.data.user.lastName}`,
      avatar: data.data.user.avatar,
      role: data.data.user.role === 'admin' ? 'admin' : 'user',
      preferences: {
        language: 'en',
        theme: 'auto',
        notifications: true,
        emailUpdates: false,
      },
      subscription: {
        plan: data.data.user.tier || 'free',
        status: 'active',
      },
      createdAt: new Date(data.data.user.createdAt),
      lastLoginAt: data.data.user.lastLoginAt ? new Date(data.data.user.lastLoginAt) : undefined,
    };
    
    const tokens: AuthTokens = {
      accessToken: data.data.tokens.accessToken,
      refreshToken: data.data.tokens.refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    };
    
    return { user, tokens };
  },
  
  register: async (credentials: RegisterCredentials): Promise<{ user: User; tokens: AuthTokens }> => {
    if (credentials.password !== credentials.confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
    const [firstName, ...lastNameParts] = credentials.name.split(' ');
    const lastName = lastNameParts.join(' ') || '';
    
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        confirmPassword: credentials.confirmPassword,
        firstName,
        lastName,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Registration failed');
    }
    
    const data = await response.json();
    
    const user: User = {
      id: data.data.user.id,
      email: data.data.user.email,
      name: `${data.data.user.firstName} ${data.data.user.lastName}`,
      avatar: data.data.user.avatar,
      role: data.data.user.role === 'admin' ? 'admin' : 'user',
      preferences: {
        language: 'en',
        theme: 'auto',
        notifications: true,
        emailUpdates: false,
      },
      subscription: {
        plan: data.data.user.tier || 'free',
        status: 'active',
      },
      createdAt: new Date(data.data.user.createdAt),
    };
    
    const tokens: AuthTokens = {
      accessToken: data.data.tokens.accessToken,
      refreshToken: data.data.tokens.refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
    
    return { user, tokens };
  },
  
  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Token refresh failed');
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  },
  
  resetPassword: async (email: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Password reset failed');
    }
  },
  
  changePassword: async (data: ChangePasswordData, token: string): Promise<void> => {
    if (data.newPassword !== data.confirmPassword) {
      throw new Error('Passwords do not match');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Password change failed');
    }
  },
  
  updateProfile: async (updates: Partial<User>, token: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Profile update failed');
    }
    
    const data = await response.json();
    
    return {
      id: data.data.id,
      email: data.data.email,
      name: `${data.data.firstName} ${data.data.lastName}`,
      avatar: data.data.avatar,
      role: data.data.role === 'admin' ? 'admin' : 'user',
      preferences: {
        language: 'en',
        theme: 'auto',
        notifications: true,
        emailUpdates: false,
      },
      subscription: {
        plan: data.data.tier || 'free',
        status: 'active',
      },
      createdAt: new Date(data.data.createdAt),
      lastLoginAt: data.data.lastLoginAt ? new Date(data.data.lastLoginAt) : undefined,
    } as User;
  },
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: true, // Start with loading true to check persisted state
        error: null,
        
        // Computed
        get token() {
          return get().tokens?.accessToken || null;
        },
        
        // Actions
        login: async (credentials) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          
          try {
            const { user, tokens } = await api.login(credentials);
            
            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.isAuthenticated = true;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Login failed';
              state.isLoading = false;
            });
            throw error;
          }
        },
        
        register: async (credentials) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          
          try {
            const { user, tokens } = await api.register(credentials);
            
            set((state) => {
              state.user = user;
              state.tokens = tokens;
              state.isAuthenticated = true;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Registration failed';
              state.isLoading = false;
            });
            throw error;
          }
        },
        
        logout: () => {
          set((state) => {
            state.user = null;
            state.tokens = null;
            state.isAuthenticated = false;
            state.error = null;
          });
        },
        
        refreshToken: async () => {
          const { tokens } = get();
          if (!tokens?.refreshToken) {
            throw new Error('No refresh token available');
          }
          
          try {
            const newTokens = await api.refreshToken(tokens.refreshToken);
            
            set((state) => {
              state.tokens = newTokens;
            });
          } catch (error) {
            // If refresh fails, logout user
            get().logout();
            throw error;
          }
        },
        
        resetPassword: async (data) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          
          try {
            await api.resetPassword(data.email);
            
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Password reset failed';
              state.isLoading = false;
            });
            throw error;
          }
        },
        
        changePassword: async (data) => {
          const { tokens } = get();
          if (!tokens?.accessToken) {
            throw new Error('No access token available');
          }
          
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          
          try {
            await api.changePassword(data, tokens.accessToken);
            
            set((state) => {
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Password change failed';
              state.isLoading = false;
            });
            throw error;
          }
        },
        
        updateProfile: async (updates) => {
          const { tokens } = get();
          if (!tokens?.accessToken) {
            throw new Error('No access token available');
          }
          
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });
          
          try {
            const updatedUser = await api.updateProfile(updates, tokens.accessToken);
            
            set((state) => {
              state.user = updatedUser;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Profile update failed';
              state.isLoading = false;
            });
            throw error;
          }
        },
        
        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },
        
        // Internal setters
        setUser: (user) => {
          set((state) => {
            state.user = user;
            state.isAuthenticated = !!user;
          });
        },
        
        setTokens: (tokens) => {
          set((state) => {
            state.tokens = tokens;
          });
        },
        
        setLoading: (loading) => {
          set((state) => {
            state.isLoading = loading;
          });
        },
        
        setError: (error) => {
          set((state) => {
            state.error = error;
          });
        },
      })),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Initialize auth state from persisted data
export const initializeAuth = () => {
  const { user, tokens, setLoading, logout } = useAuthStore.getState();
  
  // If we have persisted user and tokens, validate them
  if (user && tokens) {
    // Check if token is expired
    const isExpired = tokens.expiresAt.getTime() <= Date.now();
    
    if (isExpired) {
      // Token expired, logout user
      logout();
    } else {
      // Token is valid, user is authenticated
      useAuthStore.setState({ isAuthenticated: true });
    }
  }
  
  // Set loading to false after initialization
  setLoading(false);
};

// Token refresh interceptor
let refreshPromise: Promise<void> | null = null;

export const setupTokenRefresh = () => {
  const checkAndRefreshToken = async () => {
    const { tokens, refreshToken, logout } = useAuthStore.getState();
    
    if (!tokens) return;
    
    // Check if token is about to expire (5 minutes before)
    const expiresIn = tokens.expiresAt.getTime() - Date.now();
    const shouldRefresh = expiresIn < 5 * 60 * 1000; // 5 minutes
    
    if (shouldRefresh && !refreshPromise) {
      refreshPromise = refreshToken()
        .catch((error) => {
          console.error('Token refresh failed:', error);
          logout();
        })
        .finally(() => {
          refreshPromise = null;
        });
      
      await refreshPromise;
    }
  };
  
  // Check token every minute
  const interval = setInterval(checkAndRefreshToken, 60 * 1000);
  
  // Initial check
  checkAndRefreshToken();
  
  return () => clearInterval(interval);
};

// Selectors
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthToken = () => useAuthStore((state) => state.token);