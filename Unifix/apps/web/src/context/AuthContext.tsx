import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '../api/client';

export interface UserCampus {
  id: string;
  name: string;
  code: string;
  role: 'REPORTER' | 'MANAGEMENT' | 'SUPERMANAGEMENT';
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  isAnonymous: boolean;
  campuses: UserCampus[];
}

interface AuthContextType {
  user: AuthUser | null;
  activeCampus: UserCampus | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSupermanagement: boolean;
  setActiveCampus: (campus: UserCampus) => void;
  login: (identifier: string, code: string, campusId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeCampus, setActiveCampusState] = useState<UserCampus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const token = localStorage.getItem('unifix_access_token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        const res = await ApiClient.getCurrentUser();
        if (res.data) {
          setUser(res.data);
          // Set active campus from saved or default to first campus
          const savedCampusId = localStorage.getItem('unifix_active_campus_id');
          const found = res.data.campuses.find((c: UserCampus) => c.id === savedCampusId);
          setActiveCampusState(found || res.data.campuses[0] || null);
        }
      } catch (err) {
        console.error('Failed to load user session', err);
        ApiClient.clearTokens();
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const setActiveCampus = (campus: UserCampus) => {
    setActiveCampusState(campus);
    localStorage.setItem('unifix_active_campus_id', campus.id);
  };

  const login = async (identifier: string, code: string, campusId: string) => {
    const res = await ApiClient.verifyOTP(identifier, code, campusId);
    if (res.data) {
      const userData: AuthUser = {
        id: res.data.user.id,
        email: res.data.user.email,
        phone: res.data.user.phone,
        firstName: res.data.user.firstName,
        lastName: res.data.user.lastName,
        isAnonymous: res.data.user.isAnonymous,
        campuses: res.data.campuses,
      };
      setUser(userData);
      const currentCampus = userData.campuses?.find((c) => c.id === campusId) || userData.campuses?.[0] || null;
      setActiveCampusState(currentCampus);
      if (currentCampus?.id) {
        localStorage.setItem('unifix_active_campus_id', currentCampus.id);
      }
    }
  };

  const logout = async () => {
    await ApiClient.logout();
    setUser(null);
    setActiveCampusState(null);
    localStorage.removeItem('unifix_active_campus_id');
  };

  const isSupermanagement = Boolean(
    user?.campuses.some((c) => c.role === 'SUPERMANAGEMENT')
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        activeCampus,
        isAuthenticated: !!user,
        isLoading,
        isSupermanagement,
        setActiveCampus,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
