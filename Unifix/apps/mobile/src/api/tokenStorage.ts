// Token & Session Storage with AsyncStorage and In-Memory Fallback - Unifix Mobile
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const ACCESS_TOKEN_KEY = '@unifix/access_token';
const REFRESH_TOKEN_KEY = '@unifix/refresh_token';
const USER_KEY = '@unifix/user';

// In-memory fallback cache
let memAccessToken: string | null = null;
let memRefreshToken: string | null = null;
let memUser: User | null = null;

export const TokenStorage = {
  async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem(ACCESS_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
      ]);
      memAccessToken = accessToken ?? memAccessToken;
      memRefreshToken = refreshToken ?? memRefreshToken;
      return {
        accessToken: memAccessToken,
        refreshToken: memRefreshToken,
      };
    } catch {
      return {
        accessToken: memAccessToken,
        refreshToken: memRefreshToken,
      };
    }
  },

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    memAccessToken = accessToken;
    memRefreshToken = refreshToken;
    try {
      await Promise.all([
        AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
      ]);
    } catch (err) {
      console.warn('TokenStorage: Failed to persist tokens to AsyncStorage', err);
    }
  },

  async clearTokens(): Promise<void> {
    memAccessToken = null;
    memRefreshToken = null;
    try {
      await Promise.all([
        AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      ]);
    } catch (err) {
      console.warn('TokenStorage: Failed to clear tokens from AsyncStorage', err);
    }
  },

  async getUser(): Promise<User | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      if (raw) {
        memUser = JSON.parse(raw);
      }
      return memUser;
    } catch {
      return memUser;
    }
  },

  async saveUser(user: User): Promise<void> {
    memUser = user;
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('TokenStorage: Failed to persist user to AsyncStorage', err);
    }
  },

  async clearUser(): Promise<void> {
    memUser = null;
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch (err) {
      console.warn('TokenStorage: Failed to clear user from AsyncStorage', err);
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all([this.clearTokens(), this.clearUser()]);
  },
};
