import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '../utils/logger';

// Interface para errores de validación
interface ValidationError {
  field: string;
  message: string;
  value?: any;
  location?: string;
}

// Middleware principal de validación
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors: ValidationError[] = errors.array().map((error: ExpressValidationError) => ({
      field: 'field' in error ? error.field : 'unknown',
      message: error.msg,
      value: 'value' in error ? error.value : undefined,
      location: 'location' in error ? error.location : undefined,
    }));

    logger.warn('Request validation failed:', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      errors: formattedErrors
    });

    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: formattedErrors
      }
    });
  }

  next();
};

// Sanitización de input para prevenir XSS
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Sanitizar HTML/XSS
      return DOMPurify.sanitize(value, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [] 
      }).trim();
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
    // Sanitizar body
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }

    // Sanitizar query parameters
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }

    // Sanitizar params
    if (req.params) {
      req.params = sanitizeValue(req.params);
    }

    next();
  } catch (error) {
    logger.error('Error during input sanitization:', error);
    res.status(400).json({
      error: {
        message: 'Invalid input format',
        code: 'SANITIZATION_ERROR'
      }
    });
  }
};

// Validación de Content-Type
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.headers['content-type'];
      
      if (!contentType) {
        return res.status(400).json({
          error: {
            message: 'Content-Type header is required',
            code: 'MISSING_CONTENT_TYPE'
          }
        });
      }

      const hasValidContentType = allowedTypes.some(type => 
        contentType.toLowerCase().includes(type.toLowerCase())
      );

      if (!hasValidContentType) {
        return res.status(415).json({
          error: {
            message: `Unsupported Content-Type. Allowed types: ${allowedTypes.join(', ')}`,
            code: 'UNSUPPORTED_CONTENT_TYPE'
          }
        });
      }
    }

    next();
  };
};

// Validación de tamaño de payload
export const validatePayloadSize = (maxSizeBytes: number = 1024 * 1024) => { // 1MB por defecto
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      return res.status(413).json({
        error: {
          message: `Payload too large. Maximum size: ${maxSizeBytes} bytes`,
          code: 'PAYLOAD_TOO_LARGE'
        }
      });
    }

    next();
  };
};

// Validación de headers obligatorios
export const requireHeaders = (requiredHeaders: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missingHeaders: string[] = [];

    for (const header of requiredHeaders) {
      if (!req.headers[header.toLowerCase()]) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        error: {
          message: `Missing required headers: ${missingHeaders.join(', ')}`,
          code: 'MISSING_HEADERS'
        }
      });
    }

    next();
  };
};

// Validación de User-Agent
export const validateUserAgent = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.headers['user-agent'];

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
      error: {
        message: 'Invalid request',
        code: 'SUSPICIOUS_REQUEST'
      }
    });
  }

  next();
};

// Validación de caracteres permitidos en parámetros de URL
export const validateUrlParams = (req: Request, res: Response, next: NextFunction) => {
  const allowedPattern = /^[a-zA-Z0-9\-_\.@]+$/;

  for (const [key, value] of Object.entries(req.params)) {
    if (typeof value === 'string' && !allowedPattern.test(value)) {
      logger.warn('Invalid URL parameter detected:', {
        parameter: key,
        value,
        ip: req.ip,
        path: req.path
      });

      return res.status(400).json({
        error: {
          message: `Invalid parameter format: ${key}`,
          code: 'INVALID_PARAMETER_FORMAT'
        }
      });
    }
  }

  next();
};

// Validación de profundidad de objetos anidados
export const validateObjectDepth = (maxDepth: number = 5) => {
  const getObjectDepth = (obj: any, currentDepth: number = 0): number => {
    if (currentDepth > maxDepth) return currentDepth;
    
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const depths = Object.values(obj).map(value => 
        getObjectDepth(value, currentDepth + 1)
      );
      return Math.max(currentDepth, ...depths);
    }
    
    if (Array.isArray(obj)) {
      const depths = obj.map(item => getObjectDepth(item, currentDepth + 1));
      return Math.max(currentDepth, ...depths);
    }
    
    return currentDepth;
  };

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      const depth = getObjectDepth(req.body);
      
      if (depth > maxDepth) {
        return res.status(400).json({
          error: {
            message: `Object nesting too deep. Maximum depth: ${maxDepth}`,
            code: 'OBJECT_TOO_DEEP'
          }
        });
      }
    }

    next();
  };
};

// Validación de propiedades adicionales no permitidas
export const preventUnknownProperties = (allowedProperties: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      const unknownProperties = Object.keys(req.body).filter(
        key => !allowedProperties.includes(key)
      );

      if (unknownProperties.length > 0) {
        return res.status(400).json({
          error: {
            message: `Unknown properties not allowed: ${unknownProperties.join(', ')}`,
            code: 'UNKNOWN_PROPERTIES'
          }
        });
      }
    }

    next();
  };
};

// Validación de tipos de datos estricta
export const validateDataTypes = (schema: { [key: string]: string }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const errors: ValidationError[] = [];

    for (const [field, expectedType] of Object.entries(schema)) {
      const value = req.body[field];
      
      if (value !== undefined) {
        let isValid = false;

        switch (expectedType) {
          case 'string':
            isValid = typeof value === 'string';
            break;
          case 'number':
            isValid = typeof value === 'number' && !isNaN(value);
            break;
          case 'boolean':
            isValid = typeof value === 'boolean';
            break;
          case 'array':
            isValid = Array.isArray(value);
            break;
          case 'object':
            isValid = typeof value === 'object' && !Array.isArray(value) && value !== null;
            break;
          case 'email':
            isValid = typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            break;
          case 'url':
            isValid = typeof value === 'string' && /^https?:\/\/.+/.test(value);
            break;
          case 'uuid':
            isValid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
            break;
        }

        if (!isValid) {
          errors.push({
            field,
            message: `Expected ${expectedType} but received ${typeof value}`,
            value
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          message: 'Data type validation failed',
          code: 'TYPE_VALIDATION_ERROR',
          details: errors
        }
      });
    }

    next();
  };
};

// Middleware combinado para validación completa
export const fullValidationSuite = {
  // Para endpoints de autenticación
  auth: [
    validateContentType(['application/json']),
    validatePayloadSize(10 * 1024), // 10KB
    sanitizeInput,
    validateUserAgent,
    validateObjectDepth(3),
    validateRequest
  ],

  // Para endpoints de API general
  api: [
    validateContentType(['application/json']),
    validatePayloadSize(100 * 1024), // 100KB
    sanitizeInput,
    validateUserAgent,
    validateUrlParams,
    validateObjectDepth(5),
    validateRequest
  ],

  // Para endpoints de upload de archivos
  upload: [
    validateContentType(['multipart/form-data', 'application/octet-stream']),
    validatePayloadSize(10 * 1024 * 1024), // 10MB
    validateUserAgent,
    requireHeaders(['content-length']),
    validateRequest
  ],

  // Para endpoints administrativos
  admin: [
    validateContentType(['application/json']),
    validatePayloadSize(50 * 1024), // 50KB
    sanitizeInput,
    validateUserAgent,
    validateUrlParams,
    validateObjectDepth(4),
    requireHeaders(['authorization']),
    validateRequest
  ]
};

// Helper para aplicar múltiples middlewares
export const applyValidation = (...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) => {
  return middlewares;
};