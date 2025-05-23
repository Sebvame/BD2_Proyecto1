import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createClient } from 'redis';
import { logger } from '../utils/logger';
import { config } from '../config';

// Cliente Redis para rate limiting distribuido
let redisClient: ReturnType<typeof createClient> | null = null;

const initializeRedis = async () => {
  try {
    redisClient = createClient({ url: config.REDIS_URI });
    await redisClient.connect();
    logger.info('Rate limiting Redis client connected');
  } catch (error) {
    logger.error('Failed to connect Redis for rate limiting:', error);
    redisClient = null;
  }
};

// Inicializar Redis
initializeRedis();

// Configuraciones de rate limiting por endpoint
export const rateLimitConfigs = {
  // General API
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de requests por ventana de tiempo
    message: {
      error: {
        message: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.ip || 'unknown';
    },
    skip: (req: Request) => {
      // Skip para health checks
      return req.path === '/health';
    }
  }),

  // Login attempts - más estricto
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por IP
    message: {
      error: {
        message: 'Too many authentication attempts from this IP, please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
      }
    },
    keyGenerator: (req: Request) => {
      return `auth:${req.ip}:${req.body?.email || 'no-email'}`;
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Creación de recursos - moderado
  create: rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 20, // 20 creaciones por IP
    message: {
      error: {
        message: 'Too many creation requests from this IP, please try again later.',
        code: 'CREATE_RATE_LIMIT_EXCEEDED'
      }
    },
    keyGenerator: (req: Request) => {
      const userId = req.auth?.sub || req.ip;
      return `create:${userId}`;
    }
  }),

  // Búsquedas - más permisivo pero controlado
  search: rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 50, // 50 búsquedas por usuario
    message: {
      error: {
        message: 'Too many search requests, please try again later.',
        code: 'SEARCH_RATE_LIMIT_EXCEEDED'
      }
    },
    keyGenerator: (req: Request) => {
      const userId = req.auth?.sub || req.ip;
      return `search:${userId}`;
    }
  }),

  // Endpoints administrativos - muy estricto
  admin: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 100, // 100 operaciones por hora
    message: {
      error: {
        message: 'Administrative action rate limit exceeded.',
        code: 'ADMIN_RATE_LIMIT_EXCEEDED'
      }
    },
    keyGenerator: (req: Request) => {
      const userId = req.auth?.sub || req.ip;
      return `admin:${userId}`;
    }
  }),

  // File uploads - muy restrictivo
  upload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 uploads por hora
    message: {
      error: {
        message: 'File upload rate limit exceeded.',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
      }
    },
    keyGenerator: (req: Request) => {
      const userId = req.auth?.sub || req.ip;
      return `upload:${userId}`;
    }
  })
};

// Speed limiting - ralentizar requests cuando se acercan al límite
export const speedLimitConfigs = {
  general: slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutos
    delayAfter: 50, // permitir 50 requests a velocidad completa
    delayMs: 500, // agregar 500ms de delay por request después del límite
    maxDelayMs: 20000, // máximo delay de 20 segundos
    keyGenerator: (req: Request) => {
      return req.ip || 'unknown';
    }
  }),

  search: slowDown({
    windowMs: 5 * 60 * 1000, // 5 minutos
    delayAfter: 30, // permitir 30 búsquedas a velocidad completa
    delayMs: 200, // agregar 200ms de delay
    maxDelayMs: 5000, // máximo delay de 5 segundos
    keyGenerator: (req: Request) => {
      const userId = req.auth?.sub || req.ip;
      return `search:${userId}`;
    }
  })
};

// Rate limiting personalizado basado en Redis
export const customRateLimit = (options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
  skipSuccessful?: boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      // Si Redis no está disponible, continuar sin rate limiting
      return next();
    }

    try {
      const key = `${options.keyPrefix}:${req.ip}`;
      const now = Date.now();
      const window = options.windowMs;

      // Usar pipeline para operaciones atómicas
      const pipeline = redisClient.multi();
      
      // Eliminar entradas antiguas
      pipeline.zRemRangeByScore(key, 0, now - window);
      
      // Contar requests actuales
      pipeline.zCard(key);
      
      // Agregar el request actual
      pipeline.zAdd(key, { score: now, value: now.toString() });
      
      // Establecer expiración
      pipeline.expire(key, Math.ceil(window / 1000));

      const results = await pipeline.exec();
      const currentCount = results?.[1] as number || 0;

      if (currentCount >= options.max) {
        logger.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
        
        return res.status(429).json({
          error: {
            message: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil(window / 1000)
          }
        });
      }

      // Agregar headers informativos
      res.setHeader('X-RateLimit-Limit', options.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - currentCount - 1));
      res.setHeader('X-RateLimit-Reset', new Date(now + window).toISOString());

      next();

    } catch (error) {
      logger.error('Rate limiting error:', error);
      // En caso de error, permitir el request
      next();
    }
  };
};

// Rate limiting basado en usuario autenticado
export const userRateLimit = (options: {
  windowMs: number;
  max: number;
  skipAnonymous?: boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.sub;
    
    if (!userId && options.skipAnonymous) {
      return next();
    }

    const key = userId ? `user:${userId}` : `ip:${req.ip}`;
    
    return customRateLimit({
      windowMs: options.windowMs,
      max: options.max,
      keyPrefix: key
    })(req, res, next);
  };
};

// Rate limiting adaptativo basado en la carga del sistema
export const adaptiveRateLimit = (baseOptions: {
  windowMs: number;
  maxLow: number;
  maxHigh: number;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Simular carga del sistema (en producción usarías métricas reales)
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Calcular "carga" simple basada en memoria
      const memoryLoadPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      // Ajustar límite basado en la carga
      let maxRequests = baseOptions.maxHigh;
      if (memoryLoadPercent > 80) {
        maxRequests = Math.floor(baseOptions.maxLow * 0.5); // Muy restrictivo
      } else if (memoryLoadPercent > 60) {
        maxRequests = baseOptions.maxLow; // Restrictivo
      } else if (memoryLoadPercent > 40) {
        maxRequests = Math.floor((baseOptions.maxLow + baseOptions.maxHigh) / 2); // Moderado
      }

      return customRateLimit({
        windowMs: baseOptions.windowMs,
        max: maxRequests,
        keyPrefix: 'adaptive'
      })(req, res, next);

    } catch (error) {
      logger.error('Adaptive rate limiting error:', error);
      next();
    }
  };
};

// Middleware para detectar y bloquear comportamiento sospechoso
export const suspiciousActivityDetector = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const userAgent = req.get('User-Agent') || '';
  const path = req.path;

  // Detectar patrones sospechosos
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i,
    // XSS attempts
    /<script|javascript:|onload=|onerror=/i,
    // Path traversal
    /\.\.\//,
    // Command injection
    /(\||;|&|`|\$\()/
  ];

  const requestString = `${req.method} ${path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.warn(`Suspicious activity detected from ${ip}:`, {
        userAgent,
        path,
        method: req.method,
        query: req.query,
        body: req.body,
        pattern: pattern.toString()
      });

      // Incrementar contador de actividad sospechosa
      if (redisClient) {
        const suspiciousKey = `suspicious:${ip}`;
        redisClient.incr(suspiciousKey).then(count => {
          redisClient?.expire(suspiciousKey, 24 * 60 * 60); // 24 horas
          
          // Bloquear si hay muchas actividades sospechosas
          if (count >= 5) {
            logger.error(`Blocking IP ${ip} due to repeated suspicious activity`);
            // Aquí podrías implementar el bloqueo automático
          }
        }).catch(err => logger.error('Error tracking suspicious activity:', err));
      }

      return res.status(400).json({
        error: {
          message: 'Invalid request',
          code: 'BAD_REQUEST'
        }
      });
    }
  }

  next();
};

// Middleware para detectar bots/crawlers
export const botDetector = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent') || '';
  
  // Patrones de bots comunes
  const botPatterns = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|java|go-http/i,
    /postman|insomnia/i
  ];

  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot) {
    logger.info(`Bot detected: ${userAgent} from ${req.ip}`);
    
    // Aplicar rate limiting más estricto para bots
    return rateLimitConfigs.general(req, res, next);
  }

  next();
};

// Cleanup function para cerrar conexiones Redis
export const cleanup = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Rate limiting Redis client disconnected');
  }
};