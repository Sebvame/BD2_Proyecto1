import { ManagementClient, AuthenticationClient } from 'auth0';
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
  TokenValidationResult,
  Auth0ManagementToken,
  RoleUpdateRequest,
  UserProfileUpdateRequest,
  Auth0Error
} from '../types';

export class Auth0Service {
  private managementClient: ManagementClient;
  private authClient: AuthenticationClient;
  private cacheService: CacheService;
  private managementToken: string | null = null;
  private managementTokenExpiry: number = 0;

  constructor() {
    this.authClient = new AuthenticationClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_CLIENT_ID,
      clientSecret: config.AUTH0_CLIENT_SECRET,
    });

    this.managementClient = new ManagementClient({
      domain: config.AUTH0_DOMAIN,
      clientId: config.AUTH0_MANAGEMENT_CLIENT_ID || config.AUTH0_CLIENT_ID,
      clientSecret: config.AUTH0_MANAGEMENT_CLIENT_SECRET || config.AUTH0_CLIENT_SECRET,
      scope: 'read:users update:users create:users delete:users read:roles update:roles create:roles delete:roles read:role_members update:role_members'
    });

    this.cacheService = new CacheService();
  }

  async login(credentials: LoginRequest): Promise<AuthToken> {
    try {
      logger.info(`Attempting login for user: ${credentials.email}`);

      const response = await this.authClient.oauth.passwordGrant({
        username: credentials.email,
        password: credentials.password,
        scope: 'openid profile email read:users',
        audience: config.AUTH0_AUDIENCE,
      });

      const authToken: AuthToken = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        idToken: response.data.id_token,
        tokenType: response.data.token_type || 'Bearer',
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
      };

      // Cache del token para validaciones rápidas
      await this.cacheService.setToken(response.data.access_token, authToken, response.data.expires_in);

      logger.info(`Login successful for user: ${credentials.email}`);
      return authToken;

    } catch (error) {
      logger.error(`Login failed for user ${credentials.email}:`, error);
      this.handleAuth0Error(error);
      throw new Error('Login failed');
    }
  }

  async register(userData: RegisterRequest): Promise<User> {
    try {
      logger.info(`Attempting registration for user: ${userData.email}`);

      // Crear usuario en Auth0
      const auth0User = await this.managementClient.users.create({
        email: userData.email,
        password: userData.password,
        name: userData.name,
        connection: userData.connection || 'Username-Password-Authentication',
        email_verified: false,
        user_metadata: {
          role: userData.role || 'customer'
        }
      });

      // Asignar rol por defecto
      await this.assignUserRole(auth0User.data.user_id!, userData.role || 'customer');

      const user: User = {
        id: auth0User.data.user_id!,
        email: auth0User.data.email!,
        name: auth0User.data.name!,
        picture: auth0User.data.picture,
        role: userData.role || 'customer',
        createdAt: auth0User.data.created_at!,
        emailVerified: auth0User.data.email_verified || false,
      };

      logger.info(`Registration successful for user: ${userData.email}`);
      return user;

    } catch (error) {
      logger.error(`Registration failed for user ${userData.email}:`, error);
      this.handleAuth0Error(error);
      throw new Error('Registration failed');
    }
  }

  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Intentar obtener del caché primero
      const cachedToken = await this.cacheService.getToken(token);
      if (cachedToken) {
        const user = await this.getUserFromToken(token);
        return {
          isValid: true,
          payload: this.extractTokenPayload(token),
          user
        };
      }

      // Validar con Auth0
      const userInfo = await this.authClient.users.getInfo(token);
      
      if (userInfo.data) {
        const user = await this.getUserById(userInfo.data.sub!);
        return {
          isValid: true,
          payload: this.extractTokenPayload(token),
          user
        };
      }

      return { isValid: false, error: 'Invalid token' };

    } catch (error) {
      logger.error('Token validation failed:', error);
      return { isValid: false, error: 'Token validation failed' };
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const response = await this.authClient.oauth.refreshToken({
        refresh_token: refreshToken,
      });

      const authToken: AuthToken = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken,
        idToken: response.data.id_token,
        tokenType: response.data.token_type || 'Bearer',
        expiresIn: response.data.expires_in,
        scope: response.data.scope,
      };

      // Cache del nuevo token
      await this.cacheService.setToken(response.data.access_token, authToken, response.data.expires_in);

      return authToken;

    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new Error('Failed to refresh token');
    }
  }

  async logout(accessToken: string): Promise<void> {
    try {
      // Revocar el token
      await this.authClient.oauth.revokeRefreshToken({
        token: accessToken,
      });

      // Remover del caché
      await this.cacheService.deleteToken(accessToken);

      logger.info('Logout successful');
    } catch (error) {
      logger.error('Logout failed:', error);
      throw new Error('Logout failed');
    }
  }

  async resetPassword(request: PasswordResetRequest): Promise<void> {
    try {
      await this.authClient.database.changePassword({
        email: request.email,
        connection: request.connection || 'Username-Password-Authentication',
      });

      logger.info(`Password reset initiated for user: ${request.email}`);
    } catch (error) {
      logger.error(`Password reset failed for user ${request.email}:`, error);
      throw new Error('Password reset failed');
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      // Intentar obtener del caché primero
      const cachedUser = await this.cacheService.getUser(userId);
      if (cachedUser) {
        return cachedUser;
      }

      const auth0User = await this.managementClient.users.get({ id: userId });
      
      if (!auth0User.data) {
        return null;
      }

      const user: User = {
        id: auth0User.data.user_id!,
        email: auth0User.data.email!,
        name: auth0User.data.name!,
        picture: auth0User.data.picture,
        role: this.extractUserRole(auth0User.data),
        createdAt: auth0User.data.created_at!,
        lastLogin: auth0User.data.last_login,
        emailVerified: auth0User.data.email_verified || false,
      };

      // Cache del usuario
      await this.cacheService.setUser(userId, user);

      return user;
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error);
      return null;
    }
  }

  async updateUserProfile(userId: string, updates: UserProfileUpdateRequest): Promise<User | null> {
    try {
      const auth0User = await this.managementClient.users.update(
        { id: userId },
        {
          name: updates.name,
          picture: updates.picture,
          user_metadata: updates.user_metadata,
        }
      );

      if (!auth0User.data) {
        return null;
      }

      const user: User = {
        id: auth0User.data.user_id!,
        email: auth0User.data.email!,
        name: auth0User.data.name!,
        picture: auth0User.data.picture,
        role: this.extractUserRole(auth0User.data),
        createdAt: auth0User.data.created_at!,
        lastLogin: auth0User.data.last_login,
        emailVerified: auth0User.data.email_verified || false,
      };

      // Actualizar caché
      await this.cacheService.setUser(userId, user);

      logger.info(`User profile updated: ${userId}`);
      return user;
    } catch (error) {
      logger.error(`Failed to update user profile ${userId}:`, error);
      throw new Error('Failed to update user profile');
    }
  }

  async assignUserRole(userId: string, role: string): Promise<void> {
    try {
      // Obtener ID del rol
      const roleId = await this.getRoleId(role);
      if (!roleId) {
        throw new Error(`Role not found: ${role}`);
      }

      // Asignar rol al usuario
      await this.managementClient.users.assignRoles(
        { id: userId },
        { roles: [roleId] }
      );

      // Invalidar caché del usuario
      await this.cacheService.deleteUser(userId);

      logger.info(`Role ${role} assigned to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to assign role ${role} to user ${userId}:`, error);
      throw new Error('Failed to assign role');
    }
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    try {
      const roleId = await this.getRoleId(role);
      if (!roleId) {
        throw new Error(`Role not found: ${role}`);
      }

      await this.managementClient.users.removeRoles(
        { id: userId },
        { roles: [roleId] }
      );

      // Invalidar caché del usuario
      await this.cacheService.deleteUser(userId);

      logger.info(`Role ${role} removed from user ${userId}`);
    } catch (error) {
      logger.error(`Failed to remove role ${role} from user ${userId}:`, error);
      throw new Error('Failed to remove role');
    }
  }

  async getUsersByRole(role: string): Promise<User[]> {
    try {
      const roleId = await this.getRoleId(role);
      if (!roleId) {
        return [];
      }

      const response = await this.managementClient.roles.getUsers({ id: roleId });
      
      return response.data.map(auth0User => ({
        id: auth0User.user_id!,
        email: auth0User.email!,
        name: auth0User.name!,
        picture: auth0User.picture,
        role: role as 'customer' | 'restaurant-admin',
        createdAt: auth0User.created_at!,
        lastLogin: auth0User.last_login,
        emailVerified: auth0User.email_verified || false,
      }));
    } catch (error) {
      logger.error(`Failed to get users by role ${role}:`, error);
      return [];
    }
  }

  private async getRoleId(roleName: string): Promise<string | null> {
    try {
      const roles = await this.managementClient.roles.getAll();
      const role = roles.data.find(r => r.name === roleName);
      return role?.id || null;
    } catch (error) {
      logger.error(`Failed to get role ID for ${roleName}:`, error);
      return null;
    }
  }

  private extractUserRole(auth0User: any): 'customer' | 'restaurant-admin' {
    // Intentar obtener el rol de user_metadata
    if (auth0User.user_metadata?.role) {
      return auth0User.user_metadata.role;
    }

    // Intentar obtener de app_metadata
    if (auth0User.app_metadata?.role) {
      return auth0User.app_metadata.role;
    }

    // Por defecto, customer
    return 'customer';
  }

  private extractTokenPayload(token: string): TokenPayload {
    // Esta es una implementación simplificada
    // En producción, deberías usar una librería como jsonwebtoken
    try {
      const base64Payload = token.split('.')[1];
      const payload = Buffer.from(base64Payload, 'base64').toString();
      return JSON.parse(payload) as TokenPayload;
    } catch (error) {
      logger.error('Failed to extract token payload:', error);
      throw new Error('Invalid token format');
    }
  }

  private async getUserFromToken(token: string): Promise<User | undefined> {
    try {
      const userInfo = await this.authClient.users.getInfo(token);
      if (userInfo.data) {
        return await this.getUserById(userInfo.data.sub!);
      }
      return undefined;
    } catch (error) {
      logger.error('Failed to get user from token:', error);
      return undefined;
    }
  }

  private handleAuth0Error(error: any): void {
    if (error.response?.data) {
      const auth0Error = error.response.data as Auth0Error;
      logger.error(`Auth0 Error: ${auth0Error.error} - ${auth0Error.error_description}`);
      
      // Mapear errores comunes de Auth0 a mensajes más amigables
      switch (auth0Error.error) {
        case 'invalid_grant':
          throw new Error('Invalid credentials provided');
        case 'too_many_attempts':
          throw new Error('Too many failed attempts. Please try again later');
        case 'invalid_user_password':
          throw new Error('Invalid email or password');
        default:
          throw new Error(auth0Error.error_description || 'Authentication failed');
      }
    }
    
    throw error;
  }
}