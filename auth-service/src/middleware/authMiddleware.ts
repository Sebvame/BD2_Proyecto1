import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SecurityService } from '../services/securityService';

// Inicializar security service
const securityService = new SecurityService();

// Rate limiting específico para autenticación
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts from this IP, please try again later.'
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `auth:${req.ip}:${req.body?.email || 'no-email'}`;
  },
  skip: (req: Request) => {
    // Skip para health checks
    return req.path === '/health';
  }
});

// Rate limiting para registro
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por IP por hora
  message: {
    success: false,
    error: {
      code: 'REGISTER_RATE_LIMIT_EXCEEDED',
      message: 'Too many registration attempts from this IP, please try again later.'
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  },
  keyGenerator: (req: Request) => {
    return `register:${req.ip}`;
  }
});

// Rate limiting para reset de contraseña
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos por email por hora
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts for this email, please try again later.'
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  },
  keyGenerator: (req: Request) => {
    return `reset:${req.ip}:${req.body?.email || 'no-email'}`;
  }
});

// Middleware para validar Content-Type
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  
  next();
};

// Middleware para sanitizar input
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return securityService.sanitizeInput(value);
    } else if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    } else if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    return value;
  };

  try {
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }
    
    next();
  } catch (error) {
    logger.error('Error during input sanitization:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'SANITIZATION_ERROR',
        message: 'Invalid input format'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Middleware para detectar actividad sospechosa
export const suspiciousActivityDetector = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip;
    const userAgent = req.get('User-Agent') || '';
    const path = req.path;

    // Detectar patrones sospechosos
    const suspiciousPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i,
      /<script|javascript:|onload=|onerror=/i,
      /\.\.\//,
      /(\||;|&|`|\$\()/
    ];

    const requestString = `${req.method} ${path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestString)) {
        logger.warn(`Suspicious activity detected from ${ip}:`, {
          userAgent,
          path,
          method: req.method,
          pattern: pattern.toString()
        });

        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid request'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    next();
  } catch (error) {
    logger.error('Error in suspicious activity detector:', error);
    next();
  }
};

// Middleware para validar User-Agent
export const validateUserAgent = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent');

  if (!userAgent) {
    logger.warn('Request without User-Agent header:', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
  }

  // Detectar User-Agents sospechosos
  const suspiciousPatterns = [
    /^$/,  // User-Agent vacío
    /^Mozilla\/4\.0$/,  // User-Agent muy básico
    /sqlmap|nikto|nmap|masscan/i,  // Herramientas de seguridad
  ];

  if (userAgent && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.warn('Suspicious User-Agent detected:', {
      userAgent,
      ip: req.ip,
      path: req.path
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'SUSPICIOUS_REQUEST',
        message: 'Invalid request'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  next();
};

// Middleware para headers de seguridad adicionales
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Request ID para trazabilidad
  const requestId = req.headers['x-request-id'] || `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', requestId);

  // Headers de seguridad específicos para auth
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache control para auth endpoints
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Remover headers que revelan información
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

// Middleware para logging de eventos de seguridad
export const securityEventLogger = (eventType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Interceptar la respuesta para loggear después
    const originalSend = res.send;
    
    res.send = function(data) {
      const statusCode = res.statusCode;
      const success = statusCode >= 200 && statusCode < 300;
      
      // Log del evento de seguridad
      logger.info(`Security Event: ${eventType}`, {
        success,
        statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        email: req.body?.email,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
      });
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Middleware para verificar IP bloqueadas
export const checkBlockedIPs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIP = req.ip;
    
    if (await securityService.isIPBlocked(clientIP)) {
      logger.warn(`Blocked request from IP: ${clientIP}`);
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error checking IP block status:', error);
    next();
  }
};

// Middleware para timeout de requests
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timeout'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Conjunto de middleware para diferentes tipos de endpoints
export const authMiddleware = {
  // Para endpoints de login
  login: [
    validateContentType,
    sanitizeInput,
    suspiciousActivityDetector,
    validateUserAgent,
    authRateLimiter,
    securityEventLogger('login_attempt'),
    requestTimeout(10000)
  ],
  
  // Para endpoints de registro
  register: [
    validateContentType,
    sanitizeInput,
    suspiciousActivityDetector,
    validateUserAgent,
    registerRateLimiter,
    securityEventLogger('register_attempt'),
    requestTimeout(15000)
  ],
  
  // Para endpoints de reset de contraseña
  passwordReset: [
    validateContentType,
    sanitizeInput,
    suspiciousActivityDetector,
    validateUserAgent,
    passwordResetRateLimiter,
    securityEventLogger('password_reset_attempt'),
    requestTimeout(10000)
  ],
  
  // Para endpoints generales
  general: [
    validateContentType,
    sanitizeInput,
    validateUserAgent,
    requestTimeout(5000)
  ]
};