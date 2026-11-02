// Shared configuration for Unifix
// Centralized configuration management

// Environment variable names
const ENV = {
  // Application
  NODE_ENV: 'NODE_ENV',
  PORT: 'PORT',
  
  // Database
  DATABASE_URL: 'DATABASE_URL',
  DIRECT_URL: 'DIRECT_URL',
  
  // Supabase
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  
  // JWT
  JWT_ACCESS_SECRET: 'JWT_ACCESS_SECRET',
  JWT_ACCESS_EXPIRES_IN: 'JWT_ACCESS_EXPIRES_IN', // e.g., "15m", "1h"
  JWT_REFRESH_SECRET: 'JWT_REFRESH_SECRET',
  JWT_REFRESH_EXPIRES_IN: 'JWT_REFRESH_EXPIRES_IN',
  REFRESH_TOKEN_PEPPER: 'REFRESH_TOKEN_PEPPER',
  
  // AI
  AI_PROVIDER: 'AI_PROVIDER', // "openai", "mock"
  AI_BASE_URL: 'AI_BASE_URL',
  AI_API_KEY: 'AI_API_KEY',
  AI_MODEL: 'AI_MODEL',
  AI_TIMEOUT_MS: 'AI_TIMEOUT_MS',
  AI_MAX_RETRIES: 'AI_MAX_RETRIES',
  AI_ENABLED: 'AI_ENABLED',
  
  // Security
  RATE_LIMIT_WINDOW_MS: 'RATE_LIMIT_WINDOW_MS',
  RATE_LIMIT_MAX: 'RATE_LIMIT_MAX',
  
  // Origins
  WEB_ORIGIN: 'WEB_ORIGIN',
  MOBILE_APP_SCHEME: 'MOBILE_APP_SCHEME',
};

// Default configuration values
const DEFAULTS = {
  PORT: 3000,
  NODE_ENV: 'development',
  
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  
  AI_PROVIDER: 'mock',
  AI_TIMEOUT_MS: 30000,
  AI_MAX_RETRIES: 1,
  AI_ENABLED: true,
  
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  RATE_LIMIT_MAX: 100, // requests
  
  TICKET_STAGE_DURATIONS: {
    REPORTED: 24, // hours
    ACKNOWLEDGED: 48,
    ACTIVE: 168, // 7 days
    RESOLVING: 48,
  },
  
  CRITICAL_STAGE_DURATIONS: {
    REPORTED: 4, // hours
    ACKNOWLEDGED: 8,
    ACTIVE: 48,
    RESOLVING: 24,
  },
};

// Configuration interface
interface AppConfig {
  // Application
  nodeEnv: string;
  port: number;
  
  // Database
  db: {
    url: string;
    directUrl?: string;
    pool?: {
      timeout?: number;
      max?: number;
      min?: number;
      idleTimeout?: number;
    };
  };
  
  // Supabase
  supabase?: {
    url?: string;
    anonKey?: string;
    serviceRoleKey?: string;
  };
  
  // JWT
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
    refreshTokenPepper: string;
  };
  
  // AI
  ai: {
    provider: string;
    baseUrl?: string;
    apiKey?: string;
    model: string;
    timeoutMs: number;
    maxRetries: number;
    enabled: boolean;
  };
  
  // Security
  rateLimit: {
    windowMs: number;
    max: number;
  };
  
  // origins
  webOrigin?: string;
  mobileAppScheme?: string;
}

// Load configuration from environment
function loadConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || DEFAULTS.NODE_ENV,
    port: parseInt(process.env.PORT || DEFAULTS.PORT.toString(), 10),
    
    db: {
      url: process.env.DATABASE_URL || '',
      directUrl: process.env.DIRECT_URL,
      pool: {
        timeout: 30,
        max: 10,
        min: 2,
        idleTimeout: 30000,
      },
    },
    
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET || '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || DEFAULTS.JWT_ACCESS_EXPIRES_IN,
      refreshSecret: process.env.JWT_REFRESH_SECRET || '',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || DEFAULTS.JWT_REFRESH_EXPIRES_IN,
      refreshTokenPepper: process.env.REFRESH_TOKEN_PEPPER || '',
    },
    
    ai: {
      provider: process.env.AI_PROVIDER || DEFAULTS.AI_PROVIDER,
      baseUrl: process.env.AI_BASE_URL,
      apiKey: process.env.AI_API_KEY,
      model: process.env.AI_MODEL || 'gpt-4',
      timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || DEFAULTS.AI_TIMEOUT_MS.toString(), 10),
      maxRetries: parseInt(process.env.AI_MAX_RETRIES || DEFAULTS.AI_MAX_RETRIES.toString(), 10),
      enabled: process.env.AI_ENABLED !== 'false',
    },
    
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || DEFAULTS.RATE_LIMIT_WINDOW_MS.toString(), 10),
      max: parseInt(process.env.RATE_LIMIT_MAX || DEFAULTS.RATE_LIMIT_MAX.toString(), 10),
    },
    
    webOrigin: process.env.WEB_ORIGIN,
    mobileAppScheme: process.env.MOBILE_APP_SCHEME,
  };
}

// Validate required configuration
function validateConfig(config: AppConfig): void {
  const missing: string[] = [];
  
  if (!config.db.url) missing.push('DATABASE_URL');
  if (!config.jwt.accessSecret) missing.push('JWT_ACCESS_SECRET');
  if (!config.jwt.refreshSecret) missing.push('JWT_REFRESH_SECRET');
  if (!config.jwt.refreshTokenPepper) missing.push('REFRESH_TOKEN_PEPPER');
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

// Get configuration instance
let instance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!instance) {
    const config = loadConfig();
    validateConfig(config);
    instance = config;
  }
  return instance;
}

export function resetConfig(): void {
  instance = null;
}

export { ENV, DEFAULTS };
