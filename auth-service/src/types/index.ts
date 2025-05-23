export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'customer' | 'restaurant-admin';
  createdAt: string;
  lastLogin?: string;
  emailVerified: boolean;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

export interface TokenPayload {
  sub: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
  scope?: string;
  permissions?: string[];
  'https://restaurant-api.com/roles'?: string[];
  'https://restaurant-api.com/user_metadata'?: {
    role?: string;
    restaurant_id?: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
  connection?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: 'customer' | 'restaurant-admin';
  connection?: string;
}

export interface PasswordResetRequest {
  email: string;
  connection?: string;
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: TokenPayload;
  error?: string;
  user?: User;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  accessToken: string;
  refreshToken?: string;
}

export interface RoleUpdateRequest {
  userId: string;
  roles: string[];
}

export interface PermissionUpdateRequest {
  userId: string;
  permissions: string[];
}

export interface UserProfileUpdateRequest {
  name?: string;
  picture?: string;
  user_metadata?: {
    role?: string;
    restaurant_id?: string;
    preferences?: Record<string, any>;
  };
}

export interface Auth0ManagementToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  loginTime: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
      user?: User;
      session?: SessionData;
      rateLimit?: RateLimitInfo;
    }
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface Auth0Error {
  error: string;
  error_description: string;
  statusCode: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export interface SecurityEvent {
  type: 'login' | 'logout' | 'failed_login' | 'password_reset' | 'role_change' | 'suspicious_activity';
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}