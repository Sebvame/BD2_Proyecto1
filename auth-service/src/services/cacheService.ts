import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { User, AuthToken, SessionData, CacheOptions } from '../types';

export class CacheService {
  private client: RedisClientType;
  private connected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.REDIS_URI,
    });

    this.client.on('error', (err) => {
      logger.error('Redis Cache Error:', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis Cache connected');
      this.connected = true;
    });

    this.client.on('ready', () => {
      logger.info('Redis Cache ready');
      this.connected = true;
    });

    this.client.on('end', () => {
      logger.warn('Redis Cache connection ended');
      this.connected = false;
    });

    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.connected = false;
    }
  }

  async setToken(token: string, authToken: AuthToken, ttl?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getTokenKey(token);
      const value = JSON.stringify(authToken);
      const expiry = ttl || authToken.expiresIn || 3600; // Default 1 hora

      await this.client.setEx(key, expiry, value);
      logger.debug(`Token cached: ${key.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Error caching token:', error);
    }
  }

  async getToken(token: string): Promise<AuthToken | null> {
    if (!this.connected) return null;

    try {
      const key = this.getTokenKey(token);
      const value = await this.client.get(key);
      
      if (!value) return null;

      return JSON.parse(value) as AuthToken;
    } catch (error) {
      logger.error('Error retrieving token from cache:', error);
      return null;
    }
  }

  async deleteToken(token: string): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getTokenKey(token);
      await this.client.del(key);
      logger.debug(`Token removed from cache: ${key.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Error deleting token from cache:', error);
    }
  }

  async setUser(userId: string, user: User, ttl: number = 3600): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getUserKey(userId);
      const value = JSON.stringify(user);

      await this.client.setEx(key, ttl, value);
      logger.debug(`User cached: ${userId}`);
    } catch (error) {
      logger.error('Error caching user:', error);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    if (!this.connected) return null;

    try {
      const key = this.getUserKey(userId);
      const value = await this.client.get(key);
      
      if (!value) return null;

      return JSON.parse(value) as User;
    } catch (error) {
      logger.error('Error retrieving user from cache:', error);
      return null;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getUserKey(userId);
      await this.client.del(key);
      logger.debug(`User removed from cache: ${userId}`);
    } catch (error) {
      logger.error('Error deleting user from cache:', error);
    }
  }

  async setSession(sessionId: string, sessionData: SessionData, ttl: number = config.SESSION_TIMEOUT): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getSessionKey(sessionId);
      const value = JSON.stringify(sessionData);

      await this.client.setEx(key, ttl, value);
      logger.debug(`Session cached: ${sessionId}`);
    } catch (error) {
      logger.error('Error caching session:', error);
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.connected) return null;

    try {
      const key = this.getSessionKey(sessionId);
      const value = await this.client.get(key);
      
      if (!value) return null;

      return JSON.parse(value) as SessionData;
    } catch (error) {
      logger.error('Error retrieving session from cache:', error);
      return null;
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = Date.now();
        await this.setSession(sessionId, session);
      }
    } catch (error) {
      logger.error('Error updating session activity:', error);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getSessionKey(sessionId);
      await this.client.del(key);
      logger.debug(`Session removed from cache: ${sessionId}`);
    } catch (error) {
      logger.error('Error deleting session from cache:', error);
    }
  }

  async setRateLimit(identifier: string, count: number, windowMs: number): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getRateLimitKey(identifier);
      const ttl = Math.ceil(windowMs / 1000);

      await this.client.setEx(key, ttl, count.toString());
    } catch (error) {
      logger.error('Error setting rate limit:', error);
    }
  }

  async getRateLimit(identifier: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const key = this.getRateLimitKey(identifier);
      const value = await this.client.get(key);
      
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error('Error retrieving rate limit:', error);
      return 0;
    }
  }

  async incrementRateLimit(identifier: string, windowMs: number): Promise<number> {
    if (!this.connected) return 0;

    try {
      const key = this.getRateLimitKey(identifier);
      const ttl = Math.ceil(windowMs / 1000);
      
      const result = await this.client.multi()
        .incr(key)
        .expire(key, ttl)
        .exec();

      return result ? (result[0] as number) : 0;
    } catch (error) {
      logger.error('Error incrementing rate limit:', error);
      return 0;
    }
  }

  async setSecurityEvent(eventId: string, eventData: any, ttl: number = 86400): Promise<void> {
    if (!this.connected) return;

    try {
      const key = this.getSecurityEventKey(eventId);
      const value = JSON.stringify(eventData);

      await this.client.setEx(key, ttl, value);
      logger.debug(`Security event cached: ${eventId}`);
    } catch (error) {
      logger.error('Error caching security event:', error);
    }
  }

  async getSecurityEvents(pattern: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const keys = await this.client.keys(this.getSecurityEventKey(pattern));
      const events: any[] = [];

      for (const key of keys) {
        const value = await this.client.get(key);
        if (value) {
          events.push(JSON.parse(value));
        }
      }

      return events;
    } catch (error) {
      logger.error('Error retrieving security events:', error);
      return [];
    }
  }

  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.connected) return;

    try {
      // Eliminar usuario del caché
      await this.deleteUser(userId);
      
      // Eliminar todas las sesiones del usuario
      const sessionKeys = await this.client.keys(this.getSessionKey(`*:${userId}`));
      if (sessionKeys.length > 0) {
        await this.client.del(sessionKeys);
      }
      
      logger.debug(`Cache invalidated for user: ${userId}`);
    } catch (error) {
      logger.error('Error invalidating user cache:', error);
    }
  }

  async flushExpiredSessions(): Promise<void> {
    if (!this.connected) return;

    try {
      const sessionKeys = await this.client.keys(this.getSessionKey('*'));
      let expiredCount = 0;

      for (const key of sessionKeys) {
        const session = await this.getSession(key.replace('auth:session:', ''));
        if (session) {
          const now = Date.now();
          const timeSinceActivity = now - session.lastActivity;
          
          if (timeSinceActivity > config.SESSION_TIMEOUT * 1000) {
            await this.client.del(key);
            expiredCount++;
          }
        }
      }

      if (expiredCount > 0) {
        logger.info(`Cleaned up ${expiredCount} expired sessions`);
      }
    } catch (error) {
      logger.error('Error flushing expired sessions:', error);
    }
  }

  async getStats(): Promise<{
    connected: boolean;
    totalKeys: number;
    memoryUsage: string;
    uptime: number;
  }> {
    if (!this.connected) {
      return {
        connected: false,
        totalKeys: 0,
        memoryUsage: '0B',
        uptime: 0
      };
    }

    try {
      const info = await this.client.info('memory');
      const dbSize = await this.client.dbSize();
      
      // Parsear información de memoria
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : '0B';

      return {
        connected: this.connected,
        totalKeys: dbSize,
        memoryUsage,
        uptime: 0 // Se podría calcular desde que se conectó
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return {
        connected: false,
        totalKeys: 0,
        memoryUsage: '0B',
        uptime: 0
      };
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }

  // Helper methods para generar claves consistentes
  private getTokenKey(token: string): string {
    return `auth:token:${token}`;
  }

  private getUserKey(userId: string): string {
    return `auth:user:${userId}`;
  }

  private getSessionKey(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }

  private getRateLimitKey(identifier: string): string {
    return `auth:rate_limit:${identifier}`;
  }

  private getSecurityEventKey(eventId: string): string {
    return `auth:security:${eventId}`;
  }
}