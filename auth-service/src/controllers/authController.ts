import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { Auth0Service } from '../services/auth0Service';
import { CacheService } from '../services/cacheService';
import { SecurityService } from '../services/securityService';
import { logger } from '../utils/logger';
import { 
  LoginRequest, 
  RegisterRequest, 
  PasswordResetRequest,
  RefreshTokenRequest,
  ApiResponse,
  SecurityEvent
} from '../types';

const router = express.Router();
const auth0Service = new Auth0Service();
const cacheService = new CacheService();
const securityService = new SecurityService();

// Middleware de validación
const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('connection').optional().isString().withMessage('Connection must be a string'),
];

const validateRegister = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('name').isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('role').optional().isIn(['customer', 'restaurant-admin']).withMessage('Role must be customer or restaurant-admin'),
  body('connection').optional().isString().withMessage('Connection must be a string'),
];

const validatePasswordReset = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('connection').optional().isString().withMessage('Connection must be a string'),
];

const validateRefreshToken = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

const validateTokenRevocation = [
  body('accessToken').notEmpty().withMessage('Access token is required'),
  body('refreshToken').optional().isString().withMessage('Refresh token must be a string'),
];

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array()
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
    return res.status(400).json(response);
  }
  next();
};

// Middleware para logging de seguridad
const logSecurityEvent = (eventType: SecurityEvent['type']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const event: SecurityEvent = {
      type: eventType,
      email: req.body.email,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
      metadata: {
        endpoint: req.path,
        method: req.method
      }
    };

    // Log del evento (sin bloquear la respuesta)
    securityService.logSecurityEvent(event).catch(err => 
      logger.error('Failed to log security event:', err)
    );

    next();
  };
};

// LOGIN
router.post(
  '/login',
  validateLogin,
  checkValidation,
  logSecurityEvent('login'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const loginData: LoginRequest = req.body;
      
      // Verificar rate limiting
      const rateLimitKey = `login:${req.ip}:${loginData.email}`;
      const attempts = await cacheService.incrementRateLimit(rateLimitKey, 15 * 60 * 1000); // 15 minutos
      
      if (attempts > 5) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many login attempts. Please try again later.'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        };
        return res.status(429).json(response);
      }

      const authToken = await auth0Service.login(loginData);
      
      // Crear sesión
      const sessionId = securityService.generateSessionId();
      await cacheService.setSession(sessionId, {
        userId: authToken.accessToken, // Temporal, debería ser el user ID real
        email: loginData.email,
        role: 'customer', // Temporal, debería obtenerse del token
        permissions: [],
        loginTime: Date.now(),
        lastActivity: Date.now(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const response: ApiResponse = {
        success: true,
        data: {
          ...authToken,
          sessionId
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      logger.info(`Successful login for user: ${loginData.email}`);
      res.json(response);

    } catch (error) {
      logger.error('Login error:', error);
      
      // Log failed login attempt
      securityService.logSecurityEvent({
        type: 'failed_login',
        email: req.body.email,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      }).catch(err => logger.error('Failed to log security event:', err));

      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: error instanceof Error ? error.message : 'Login failed'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(401).json(response);
    }
  }
);

// REGISTER
router.post(
  '/register',
  validateRegister,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registerData: RegisterRequest = req.body;
      
      // Rate limiting para registro
      const rateLimitKey = `register:${req.ip}`;
      const attempts = await cacheService.incrementRateLimit(rateLimitKey, 60 * 60 * 1000); // 1 hora
      
      if (attempts > 3) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many registration attempts. Please try again later.'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        };
        return res.status(429).json(response);
      }

      const user = await auth0Service.register(registerData);

      const response: ApiResponse = {
        success: true,
        data: user,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      logger.info(`User registered successfully: ${registerData.email}`);
      res.status(201).json(response);

    } catch (error) {
      logger.error('Registration error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Registration failed'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(400).json(response);
    }
  }
);

// VALIDATE TOKEN
router.post(
  '/validate',
  body('token').notEmpty().withMessage('Token is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      
      const validation = await auth0Service.validateToken(token);
      
      const response: ApiResponse = {
        success: true,
        data: validation,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Token validation error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOKEN_VALIDATION_FAILED',
          message: 'Token validation failed'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(401).json(response);
    }
  }
);

// REFRESH TOKEN
router.post(
  '/refresh',
  validateRefreshToken,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken }: RefreshTokenRequest = req.body;
      
      const authToken = await auth0Service.refreshToken(refreshToken);
      
      const response: ApiResponse = {
        success: true,
        data: authToken,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Token refresh error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh token'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(401).json(response);
    }
  }
);

// LOGOUT
router.post(
  '/logout',
  validateTokenRevocation,
  checkValidation,
  logSecurityEvent('logout'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { accessToken, sessionId } = req.body;
      
      await auth0Service.logout(accessToken);
      
      // Eliminar sesión del caché
      if (sessionId) {
        await cacheService.deleteSession(sessionId);
      }

      const response: ApiResponse = {
        success: true,
        data: { message: 'Logout successful' },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Logout error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Logout failed'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(400).json(response);
    }
  }
);

// PASSWORD RESET
router.post(
  '/reset-password',
  validatePasswordReset,
  checkValidation,
  logSecurityEvent('password_reset'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resetData: PasswordResetRequest = req.body;
      
      // Rate limiting para reset de password
      const rateLimitKey = `reset:${req.ip}:${resetData.email}`;
      const attempts = await cacheService.incrementRateLimit(rateLimitKey, 60 * 60 * 1000); // 1 hora
      
      if (attempts > 3) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many password reset attempts. Please try again later.'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        };
        return res.status(429).json(response);
      }

      await auth0Service.resetPassword(resetData);

      const response: ApiResponse = {
        success: true,
        data: { message: 'Password reset email sent' },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Password reset error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'PASSWORD_RESET_FAILED',
          message: 'Password reset failed'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(400).json(response);
    }
  }
);

// GET USER BY ID
router.get(
  '/user/:id',
  param('id').notEmpty().withMessage('User ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const user = await auth0Service.getUserById(id);
      
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse = {
        success: true,
        data: user,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Get user error:', error);
      
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'USER_FETCH_FAILED',
          message: 'Failed to fetch user'
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      res.status(500).json(response);
    }
  }
);

// HEALTH CHECK
router.get('/health', async (req: Request, res: Response) => {
  try {
    const cacheStats = await cacheService.getStats();
    
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'healthy',
        service: 'Auth Service',
        timestamp: new Date().toISOString(),
        cache: cacheStats
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Health check error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };

    res.status(503).json(response);
  }
});

export default router;