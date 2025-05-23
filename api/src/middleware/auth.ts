import { Request, Response, NextFunction } from 'express';
import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { config } from '../config';
import { logger } from '../utils/logger';

// Definir interfaz para usuario en request
declare global {
  namespace Express {
    interface Request {
      auth?: {
        sub: string;
        permissions?: string[];
        [key: string]: any;
      };
    }
  }
}

// Middleware para verificar el token JWT de Auth0
export const checkJwt = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${config.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }) as GetVerificationKey,
  audience: config.AUTH0_AUDIENCE,
  issuer: `https://${config.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

// Middleware para verificar permisos específicos
export const checkPermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.permissions) {
      logger.warn('No permissions found in token');
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
        },
      });
    }

    const userPermissions = req.auth.permissions as string[];
    
    const hasPermission = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn(`User lacks required permissions: ${requiredPermissions.join(', ')}`);
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
};

// Middleware para verificar roles (customer o restaurant-admin)
export const checkRole = (requiredRole: 'customer' | 'restaurant-admin') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
        },
      });
    }

    // Auth0 guarda el rol en el namespace personalizado
    const userRole = req.auth['https://restaurant-api.com/roles'] || [];
    
    if (!Array.isArray(userRole) || !userRole.includes(requiredRole)) {
      logger.warn(`User lacks required role: ${requiredRole}`);
      return res.status(403).json({
        error: {
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
};

// Middleware para manejar errores de autenticación
export const handleAuthError = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'UnauthorizedError') {
    logger.warn('Authentication error:', err.message);
    return res.status(401).json({
      error: {
        message: 'Invalid token',
      },
    });
  }
  
  next(err);
};