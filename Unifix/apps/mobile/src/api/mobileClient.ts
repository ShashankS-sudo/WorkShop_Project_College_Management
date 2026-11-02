// Mobile API Client - Unifix React Native
import { Platform } from 'react-native';

// In Android emulator, 10.0.2.2 maps to host machine's localhost; otherwise localhost
const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
let API_BASE_URL = `${DEFAULT_HOST}/api/v1`;

let authToken: string | null = null;
let refreshTokenStr: string | null = null;

export const MobileApiClient = {
  setBaseUrl(url: string) {
    API_BASE_URL = url.replace(/\/+$/, '');
  },

  setTokens(access: string, refresh: string) {
    authToken = access;
    refreshTokenStr = refresh;
  },

  clearTokens() {
    authToken = null;
    refreshTokenStr = null;
  },

  clearAuth() {
    this.clearTokens();
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { ...options, headers });
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
      this.setTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res;
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
