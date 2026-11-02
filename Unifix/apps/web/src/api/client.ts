// API Client with automatic token handling & refresh - Unifix Web
const API_BASE = '/api/v1';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  metadata?: any;
}

export class ApiClient {
  private static getAccessToken(): string | null {
    return localStorage.getItem('unifix_access_token');
  }

  private static getRefreshToken(): string | null {
    return localStorage.getItem('unifix_refresh_token');
  }

  public static setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('unifix_access_token', accessToken);
    localStorage.setItem('unifix_refresh_token', refreshToken);
  }

  public static clearTokens() {
    localStorage.removeItem('unifix_access_token');
    localStorage.removeItem('unifix_refresh_token');
  }

  public static async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = this.getAccessToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration & automatic refresh
    if (response.status === 401 && this.getRefreshToken()) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        this.clearTokens();
        window.location.reload();
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with ${response.status}`);
    }

    return data;
  }

  private static async tryRefreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;
      const json = await res.json();
      if (json.data?.accessToken && json.data?.refreshToken) {
        this.setTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Auth Methods
  static async requestOTP(identifier: string, campusId: string) {
    return this.request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, campusId, isAnonymous: false }),
    });
  }

  static async verifyOTP(identifier: string, code: string, campusId: string) {
    const res = await this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ identifier, code, campusId, isAnonymous: false }),
    });

    if (res.data?.accessToken && res.data?.refreshToken) {
      this.setTokens(res.data.accessToken, res.data.refreshToken);
    }
    return res;
  }

  static async getCurrentUser() {
    return this.request('/auth/me');
  }

  static async logout() {
    const refreshToken = this.getRefreshToken();
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } finally {
      this.clearTokens();
    }
  }

  // Campus Methods
  static async getCampuses() {
    return this.request('/campuses');
  }

  static async getCampusDetails(campusId: string) {
    return this.request(`/campuses/${campusId}`);
  }

  // Ticket Methods
  static async getTickets(params: Record<string, any>) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    });
    return this.request(`/tickets?${searchParams.toString()}`);
  }

  static async getTicket(ticketId: string) {
    return this.request(`/tickets/${ticketId}`);
  }

  static async acknowledgeTicket(ticketId: string, notes?: string, priority?: string) {
    return this.request(`/tickets/${ticketId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes, priority }),
    });
  }

  static async assignTicket(ticketId: string, assigneeId?: string, departmentId?: string, notes?: string) {
    return this.request(`/tickets/${ticketId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assigneeId, departmentId, notes }),
    });
  }

  static async recordProgress(
    ticketId: string,
    eventType: string,
    title: string,
    details: string,
    resetsStageTimer: boolean
  ) {
    return this.request(`/tickets/${ticketId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ eventType, title, details, resetsStageTimer }),
    });
  }

  static async overridePriority(ticketId: string, priority: string, reason: string) {
    return this.request(`/tickets/${ticketId}/priority`, {
      method: 'POST',
      body: JSON.stringify({ priority, reason }),
    });
  }

  static async resolveTicket(ticketId: string, resolutionSummary: string) {
    return this.request(`/tickets/${ticketId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionSummary }),
    });
  }

  static async reopenTicket(ticketId: string, reason: string) {
    return this.request(`/tickets/${ticketId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  static async markDuplicate(ticketId: string, canonicalTicketId: string, reason?: string) {
    return this.request(`/tickets/${ticketId}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ canonicalTicketId, reason }),
    });
  }

  static async addComment(ticketId: string, content: string, isInternal: boolean) {
    return this.request(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, isInternal }),
    });
  }

  // Dashboard & Analytics
  static async getCampusDashboardStats(campusId: string) {
    return this.request(`/management/campuses/${campusId}/stats`);
  }

  static async getGlobalOverview() {
    return this.request('/management/global-overview');
  }

  static async getAiInsights(campusId?: string) {
    const q = campusId ? `?campusId=${campusId}` : '';
    return this.request(`/ai/insights${q}`);
  }

  // Notifications
  static async getNotifications(unreadOnly = false) {
    return this.request(`/notifications?unreadOnly=${unreadOnly}`);
  }

  static async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  static async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'POST' });
  }
}
