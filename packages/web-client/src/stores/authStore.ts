import { create } from 'zustand';
import { api } from '../services/api';
import { websocket } from '../services/websocket';
import { signalService } from '../services/signal';

interface User {
  id: string;
  username: string;
}

interface Device {
  id: number;
  deviceName: string;
  registrationId: number;
}

interface AuthState {
  user: User | null;
  device: Device | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  initializeFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  device: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  register: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Initialize Signal Protocol
      await signalService.initialize();
      
      // Register with server
      const response = await api.register(username, password);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Registration failed');
      }

      const { user, device, token } = response.data;
      
      // Store token
      api.setToken(token);
      
      // Generate and upload PreKeys
      const preKeys = await signalService.generatePreKeys(100);
      await api.uploadPreKeys(preKeys);
      
      // Connect WebSocket
      await websocket.connect(token);
      
      set({
        user,
        device,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Initialize Signal Protocol
      await signalService.initialize();
      
      // Login with server
      const response = await api.login(username, password);
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      const { user, device, token } = response.data;
      
      // Store token
      api.setToken(token);
      
      // Check if we need to upload PreKeys
      try {
        const status = await api.getPreKeyStatus();
        if (status.data.shouldRefill) {
          const preKeys = await signalService.generatePreKeys(100);
          await api.uploadPreKeys(preKeys);
        }
      } catch (error) {
        // First time login - upload PreKeys
        const preKeys = await signalService.generatePreKeys(100);
        await api.uploadPreKeys(preKeys);
      }
      
      // Connect WebSocket
      await websocket.connect(token);
      
      set({
        user,
        device,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    websocket.disconnect();
    api.clearToken();
    set({
      user: null,
      device: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  initializeFromStorage: async () => {
    const token = api.getToken();
    
    if (!token) {
      return;
    }

    set({ isLoading: true });
    
    try {
      // Initialize Signal Protocol
      await signalService.initialize();
      
      // Verify token and get user info
      const response = await api.getMe();
      
      if (response.success && response.data) {
        const { user, devices } = response.data;
        const device = devices[0]; // Use first device
        
        // Reconnect WebSocket
        await websocket.connect(token);
        
        set({
          user,
          device,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Invalid token
        api.clearToken();
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Failed to initialize from storage:', error);
      api.clearToken();
      set({ isLoading: false });
    }
  },
}));
