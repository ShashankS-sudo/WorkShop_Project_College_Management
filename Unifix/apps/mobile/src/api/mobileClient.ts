// Mobile API Client - Unifix React Native with Persistence & Auto-Refresh
import { Platform } from 'react-native';
import { TokenStorage } from './tokenStorage';
import { User } from '../types';

// In Android emulator, 10.0.2.2 maps to host machine's localhost; otherwise localhost
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
let API_BASE_URL = `${DEFAULT_HOST}/api/v1`;

let authToken: string | null = null;
let refreshTokenStr: string | null = null;
let isInitialized = false;
let refreshPromise: Promise<string | null> | null = null;

export const MobileApiClient = {
  setBaseUrl(url: string) {
    API_BASE_URL = url.replace(/\/+$/, '');
  },

  /**
   * Initialize client by hydrating tokens from persistent storage.
   */
  async init(): Promise<{ tokens: { accessToken: string | null; refreshToken: string | null }; user: User | null }> {
    const tokens = await TokenStorage.getTokens();
    const user = await TokenStorage.getUser();
    authToken = tokens.accessToken;
    refreshTokenStr = tokens.refreshToken;
    isInitialized = true;
    return { tokens, user };
  },

  setTokens(access: string, refresh: string) {
    authToken = access;
    refreshTokenStr = refresh;
    // Persist asynchronously
    TokenStorage.saveTokens(access, refresh).catch((err) => {
      console.warn('Failed to save tokens to storage', err);
    });
  },

  async saveSession(user: User, access: string, refresh: string) {
    authToken = access;
    refreshTokenStr = refresh;
    await Promise.all([
      TokenStorage.saveTokens(access, refresh),
      TokenStorage.saveUser(user),
    ]);
  },

  async clearTokens() {
    authToken = null;
    refreshTokenStr = null;
    await TokenStorage.clearAll();
  },

  clearAuth() {
    return this.clearTokens();
  },

  getAccessToken(): string | null {
    return authToken;
  },

  getRefreshToken(): string | null {
    return refreshTokenStr;
  },

  /**
   * Refreshes JWT access token using the rotated refresh token endpoint.
   * Deduplicates concurrent refresh attempts with a single shared promise.
   */
  async refreshTokens(): Promise<string | null> {
    if (refreshPromise) {
      return refreshPromise;
    }

    if (!refreshTokenStr) {
      return null;
    }

    refreshPromise = (async () => {
      try {
        const url = `${API_BASE_URL}/auth/refresh`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refreshTokenStr }),
        });

        if (!response.ok) {
          await this.clearTokens();
          return null;
        }

        const json = await response.json();
        if (json.data?.accessToken && json.data?.refreshToken) {
          this.setTokens(json.data.accessToken, json.data.refreshToken);
          return json.data.accessToken as string;
        }

        await this.clearTokens();
        return null;
      } catch (err) {
        console.warn('MobileApiClient: Token refresh network exception', err);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<T> {
    // If not yet initialized, load from storage first
    if (!isInitialized) {
      await this.init();
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (authToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized with automatic refresh and single retry
    if (response.status === 401 && !isRetry && refreshTokenStr) {
      const newAccessToken = await this.refreshTokens();
      if (newAccessToken) {
        headers['Authorization'] = `Bearer ${newAccessToken}`;
        response = await fetch(url, { ...options, headers });
      }
    }

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || json.message || `Request failed with ${response.status}`);
    }

    return json;
  },

  // Auth
  async getCampuses() {
    return this.request('/campuses');
  },

  async getCampusDetails(campusId: string) {
    return this.request(`/campuses/${campusId}`);
  },

  async requestOTP(identifier: string, campusId: string, isAnonymous: boolean) {
    return this.request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, campusId, isAnonymous }),
    });
  },

  async verifyOTP(identifier: string, code: string, campusId: string, isAnonymous: boolean, displayName?: string) {
    const res: any = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, code, campusId, isAnonymous, displayName }),
    });

    if (res.data?.accessToken && res.data?.refreshToken) {
      if (res.data?.user) {
        await this.saveSession(res.data.user, res.data.accessToken, res.data.refreshToken);
      } else {
        this.setTokens(res.data.accessToken, res.data.refreshToken);
      }
    }
    return res;
  },

  async getCurrentUser() {
    return this.request('/auth/me');
  },

  async getSavedUser(): Promise<User | null> {
    return TokenStorage.getUser();
  },

  // Tickets
  async getTickets(params: string | { campusId: string; status?: string; search?: string }) {
    const q = new URLSearchParams();
    if (typeof params === 'string') {
      q.append('campusId', params);
    } else {
      if (params.campusId) q.append('campusId', params.campusId);
      if (params.status) q.append('status', params.status);
      if (params.search) q.append('search', params.search);
    }
    return this.request(`/tickets?${q.toString()}`);
  },

  async getTicketDetails(ticketId: string) {
    return this.request(`/tickets/${ticketId}`);
  },

  async getTicket(ticketId: string) {
    return this.getTicketDetails(ticketId);
  },

  async createTicket(ticketData: any) {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  },

  async endorseTicket(ticketId: string) {
    return this.request(`/tickets/${ticketId}/endorse`, {
      method: 'POST',
    });
  },

  async addComment(ticketId: string, content: string) {
    return this.request(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async reopenTicket(ticketId: string, reason: string) {
    return this.request(`/tickets/${ticketId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // AI Assistance
  async parseIssueWithAI(campusId: string, text: string) {
    return this.request('/ai/parse', {
      method: 'POST',
      body: JSON.stringify({ campusId, text }),
    });
  },

  async parseWithAI(text: string, campusId: string) {
    return this.parseIssueWithAI(campusId, text);
  },

  async checkSimilarityWithAI(campusId: string, text: string, title?: string, location?: string) {
    return this.request('/ai/similarity', {
      method: 'POST',
      body: JSON.stringify({ campusId, text, title, location }),
    });
  },

  async checkSimilarity(text: string, campusId: string) {
    return this.checkSimilarityWithAI(campusId, text);
  },

  // Notifications
  async getNotifications() {
    return this.request('/notifications');
  },

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', {
      method: 'POST',
    });
  },
};
