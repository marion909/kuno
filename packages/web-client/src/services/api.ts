import { config } from '../config';

export interface AuthResponse {
  success: boolean;
  data?: {
    user: {
      id: string;
      username: string;
    };
    device: {
      id: number;
      deviceName: string;
      registrationId: number;
    };
    token: string;
  };
  error?: string;
}

export class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error: any) {
        const isLastRetry = i === retries - 1;
        const shouldRetry = error.message === 'Network error' || error.message?.includes('503');
        
        if (isLastRetry || !shouldRetry) {
          throw error;
        }
        
        console.log(`Retry ${i + 1}/${retries} for ${endpoint} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${config.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(username: string, password: string, deviceName: string = 'Web Browser'): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceName }),
    });
  }

  async login(username: string, password: string, deviceName: string = 'Web Browser'): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceName }),
    });
  }

  async getMe(): Promise<any> {
    return this.requestWithRetry('/api/auth/me', {}, 3, 1000);
  }

  // PreKey endpoints
  async uploadPreKeys(data: {
    identityKey: string;
    signedPreKey: { id: number; publicKey: string; signature: string };
    oneTimePreKeys: { id: number; publicKey: string }[];
  }): Promise<any> {
    return this.request('/api/keys/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPreKeyBundle(username: string): Promise<any> {
    return this.request(`/api/keys/${username}`);
  }

  async getPreKeyStatus(): Promise<any> {
    return this.request('/api/keys/status');
  }

  // Generic HTTP methods for flexible use
  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string, options?: { data?: any }): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: options?.data ? JSON.stringify(options.data) : undefined,
    });
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }
}

export const api = new ApiService();
