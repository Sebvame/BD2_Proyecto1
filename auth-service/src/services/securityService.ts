import crypto from 'crypto';
import { CacheService } from './cacheService';
import { logger } from '../utils/logger';
import { SecurityEvent } from '../types';

export class SecurityService {
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Log al sistema principal
      logger.info('Security Event:', {
        type: event.type,
        userId: event.userId,
        email: event.email,
        ipAddress: event.ipAddress,
        timestamp: event.timestamp,
        metadata: event.metadata
      });

      // Guardar en caché para análisis
      const eventId = `${event.type}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      await this.cacheService.setSecurityEvent(eventId, event);

      // Detectar actividad sospechosa
      await this.detectSuspiciousActivity(event);

    } catch (error) {
      logger.error('Failed to log security event:', error);
    }
  }

  async detectSuspiciousActivity(event: SecurityEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'failed_login':
          await this.checkFailedLoginAttempts(event);
          break;
        case 'login':
          await this.checkUnusualLoginPattern(event);
          break;
        case 'password_reset':
          await this.checkPasswordResetPattern(event);
          break;
      }
    } catch (error) {
      logger.error('Error detecting suspicious activity:', error);
    }
  }

  private async checkFailedLoginAttempts(event: SecurityEvent): Promise<void> {
    if (!event.email || !event.ipAddress) return;

    try {
      // Verificar intentos fallidos por email
      const emailAttempts = await this.cacheService.incrementRateLimit(
        `failed_login:email:${event.email}`, 
        60 * 60 * 1000 // 1 hora
      );

      // Verificar intentos fallidos por IP
      const ipAttempts = await this.cacheService.incrementRateLimit(
        `failed_login:ip:${event.ipAddress}`, 
        60 * 60 * 1000 // 1 hora
      );

      // Alerta si hay muchos intentos fallidos
      if (emailAttempts >= 5) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          email: event.email,
          ipAddress: event.ipAddress,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: 'Multiple failed login attempts for email',
            attempts: emailAttempts,
            originalEvent: event
          }
        });
      }

      if (ipAttempts >= 10) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          ipAddress: event.ipAddress,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: 'Multiple failed login attempts from IP',
            attempts: ipAttempts,
            originalEvent: event
          }
        });
      }

    } catch (error) {
      logger.error('Error checking failed login attempts:', error);
    }
  }

  private async checkUnusualLoginPattern(event: SecurityEvent): Promise<void> {
    if (!event.email || !event.ipAddress) return;

    try {
      // Obtener logins recientes para este usuario
      const recentLogins = await this.cacheService.getSecurityEvents(`login:*:${event.email}`);
      
      if (recentLogins.length > 0) {
        const lastLogin = recentLogins[recentLogins.length - 1];
        
        // Verificar login desde IP diferente en poco tiempo
        if (lastLogin.ipAddress !== event.ipAddress) {
          const timeDiff = new Date(event.timestamp).getTime() - new Date(lastLogin.timestamp).getTime();
          
          // Si el login anterior fue hace menos de 30 minutos desde otra IP
          if (timeDiff < 30 * 60 * 1000) {
            await this.logSecurityEvent({
              type: 'suspicious_activity',
              userId: event.userId,
              email: event.email,
              ipAddress: event.ipAddress,
              timestamp: new Date().toISOString(),
              metadata: {
                reason: 'Login from different IP in short time',
                previousIp: lastLogin.ipAddress,
                currentIp: event.ipAddress,
                timeDifferenceMinutes: Math.floor(timeDiff / (60 * 1000)),
                originalEvent: event
              }
            });
          }
        }
      }

    } catch (error) {
      logger.error('Error checking unusual login pattern:', error);
    }
  }

  private async checkPasswordResetPattern(event: SecurityEvent): Promise<void> {
    if (!event.email || !event.ipAddress) return;

    try {
      // Verificar múltiples resets de password
      const resetAttempts = await this.cacheService.incrementRateLimit(
        `password_reset:${event.email}`, 
        24 * 60 * 60 * 1000 // 24 horas
      );

      if (resetAttempts >= 3) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          email: event.email,
          ipAddress: event.ipAddress,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: 'Multiple password reset attempts',
            attempts: resetAttempts,
            originalEvent: event
          }
        });
      }

    } catch (error) {
      logger.error('Error checking password reset pattern:', error);
    }
  }

  async getSecurityStats(): Promise<{
    totalEvents: number;
    eventsByType: { [type: string]: number };
    suspiciousActivities: number;
    blockedIPs: string[];
    recentEvents: SecurityEvent[];
  }> {
    try {
      // Obtener todos los eventos de seguridad
      const allEvents = await this.cacheService.getSecurityEvents('*');
      
      // Agrupar por tipo
      const eventsByType: { [type: string]: number } = {};
      allEvents.forEach(event => {
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      });

      // Contar actividades sospechosas
      const suspiciousActivities = eventsByType['suspicious_activity'] || 0;

      // Obtener IPs bloqueadas (esto sería una implementación más compleja)
      const blockedIPs: string[] = [];

      // Eventos recientes (últimos 10)
      const recentEvents = allEvents
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      return {
        totalEvents: allEvents.length,
        eventsByType,
        suspiciousActivities,
        blockedIPs,
        recentEvents
      };

    } catch (error) {
      logger.error('Error getting security stats:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        suspiciousActivities: 0,
        blockedIPs: [],
        recentEvents: []
      };
    }
  }

  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const [salt, hash] = hashedPassword.split(':');
      const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      return hash === verifyHash;
    } catch (error) {
      logger.error('Error verifying password:', error);
      return false;
    }
  }

  sanitizeInput(input: string): string {
    return input.replace(/[<>'"&]/g, (match) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match];
    });
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Verificar patrones comunes débiles
    const weakPatterns = [
      /(.)\1{3,}/, // Repetición de caracteres
      /123456|password|qwerty|admin/i, // Patrones comunes
      /^(.+)\1+$/ // Repetición de patrones
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(password)) {
        errors.push('Password contains weak patterns');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = lowercase + uppercase + numbers + symbols;

    let password = '';
    
    // Asegurar que tenga al menos un carácter de cada tipo
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Llenar el resto con caracteres aleatorios
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Mezclar la contraseña
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  isValidIPAddress(ip: string): boolean {
    // IPv4
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    // IPv6 (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      await this.cacheService.flushExpiredSessions();
      logger.info('Expired sessions cleaned up');
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
    }
  }

  async blockSuspiciousIP(ip: string, reason: string, durationHours: number = 24): Promise<void> {
    try {
      const blockKey = `blocked_ip:${ip}`;
      const blockData = {
        ip,
        reason,
        blockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      };

      await this.cacheService.setSecurityEvent(blockKey, blockData, durationHours * 60 * 60);
      
      logger.warn(`IP blocked: ${ip} for ${reason}`);
    } catch (error) {
      logger.error('Error blocking IP:', error);
    }
  }

  async isIPBlocked(ip: string): Promise<boolean> {
    try {
      const blockKey = `blocked_ip:${ip}`;
      const blockData = await this.cacheService.getSecurityEvents(blockKey);
      return blockData.length > 0;
    } catch (error) {
      logger.error('Error checking if IP is blocked:', error);
      return false;
    }
  }
}