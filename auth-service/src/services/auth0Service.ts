import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from './cacheService';
import { 
  User, 
  AuthToken, 
  LoginRequest, 
  RegisterRequest, 
  PasswordResetRequest,
  TokenPayload,
  TokenValidationResult
} from '../types';

export class Auth0Service {
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  // Para login, redirigir al frontend a Auth0 Universal Login
  async getLoginUrl(): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.AUTH0_CLIENT_ID,
      redirect_uri: `${config.API_BASE_URL}/auth/callback`,
      scope: 'openid profile email',
      audience: config.AUTH0_AUDIENCE
    });

    return `https://${config.AUTH0_DOMAIN}/authorize?${params.toString()}`;
  }

  // Para logout
  async getLogoutUrl(): Promise<string> {
    const params = new URLSearchParams({
      client_id: config.AUTH0_CLIENT_ID,
      returnTo: config.API_BASE_URL
    });

    return `https://${config.AUTH0_DOMAIN}/v2/logout?${params.toString()}`;
  }

  // Validar token usando el payload que ya viene del middleware
  async validateTokenPayload(payload: TokenPayload): Promise<User | null> {
    try {
      const userId = payload.sub;
      
      // Verificar caché primero
      const cachedUser = await this.cacheService.getUser(userId);
      if (cachedUser) {
        return cachedUser;
      }

      // Crear usuario basado en el payload del token
      const user: User = {
        id: userId,
        email: payload['https://restaurant-api.com/email'] || payload.email || '',
        name: payload['https://restaurant-api.com/name'] || payload.name || '',
        picture: payload.picture,
        role: this.extractUserRole(payload),
        createdAt: payload['https://restaurant-api.com/created_at'] || new Date().toISOString(),
        emailVerified: payload.email_verified || false,
      };

      // Cache del usuario
      await this.cacheService.setUser(userId, user, 3600); // 1 hora
      return user;

    } catch (error) {
      logger.error('Failed to validate token payload:', error);
      return null;
    }
  }

  // Para reset de password - redirigir a Auth0
  async getPasswordResetUrl(email: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: config.AUTH0_CLIENT_ID,
      email: email,
      connection: 'Username-Password-Authentication'
    });

    return `https://${config.AUTH0_DOMAIN}/dbconnections/change_password?${params.toString()}`;
  }

  // Obtener información del usuario por ID (simplificado)
  async getUserById(userId: string): Promise<User | null> {
    try {
      const cachedUser = await this.cacheService.getUser(userId);
      return cachedUser;
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error);
      return null;
    }
  }

  private extractUserRole(payload: TokenPayload): 'customer' | 'restaurant-admin' {
    // Buscar el rol en custom claims o scopes
    const roles = payload['https://restaurant-api.com/roles'] || [];
    const userMetadata = payload['https://restaurant-api.com/user_metadata'];
    
    if (userMetadata?.role) {
      return userMetadata.role;
    }
    
    if (roles.includes('restaurant-admin')) {
      return 'restaurant-admin';
    }
    
    return 'customer';
  }
}

// Nueva clase simplificada para manejo de autenticación
export class SimpleAuthService {
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  // Crear sesión basada en token validado
  async createSession(tokenPayload: TokenPayload, req: any): Promise<string> {
    const sessionId = this.generateSessionId();
    
    const sessionData = {
      userId: tokenPayload.sub,
      email: tokenPayload.email || '',
      role: this.extractUserRole(tokenPayload),
      permissions: tokenPayload.permissions || [],
      loginTime: Date.now(),
      lastActivity: Date.now(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    await this.cacheService.setSession(sessionId, sessionData);
    return sessionId;
  }

  // Validar y refrescar sesión
  async validateSession(sessionId: string): Promise<any | null> {
    try {
      const session = await this.cacheService.getSession(sessionId);
      if (session) {
        // Actualizar última actividad
        await this.cacheService.updateSessionActivity(sessionId);
        return session;
      }
      return null;
    } catch (error) {
      logger.error('Session validation failed:', error);
      return null;
    }
  }

  // Cerrar sesión
  async closeSession(sessionId: string): Promise<void> {
    await this.cacheService.deleteSession(sessionId);
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUserRole(payload: TokenPayload): 'customer' | 'restaurant-admin' {
    const roles = payload['https://restaurant-api.com/roles'] || [];
    const userMetadata = payload['https://restaurant-api.com/user_metadata'];
    
    if (userMetadata?.role) {
      return userMetadata.role;
    }
    
    if (roles.includes('restaurant-admin')) {
      return 'restaurant-admin';
    }
    
    return 'customer';
  }
}