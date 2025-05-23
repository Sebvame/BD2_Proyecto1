import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '../config';
import { logger } from '../utils/logger';

// Configuración de CORS más granular
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Lista de orígenes permitidos
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:80',
      'http://127.0.0.1:3000',
      'https://restaurant-app.com', // Dominio de producción
      'https://admin.restaurant-app.com' // Panel administrativo
    ];

    // Permitir requests sin origin (mobile apps, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // En desarrollo, ser más permisivo
    if (config.NODE_ENV === 'development') {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID',
    'X-Correlation-ID',
    'Cache-Control'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ],
  maxAge: 86400, // 24 horas para preflight requests
  optionsSuccessStatus: 200 // Para compatibilidad con navegadores antiguos
};

// Configuración de Helmet para security headers
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'block-all-mixed-content': [],
      'font-src': ["'self'", 'https:', 'data:'],
      'frame-ancestors': ["'none'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'object-src': ["'none'"],
      'script-src': ["'self'"],
      'script-src-attr': ["'none'"],
      'style-src': ["'self'", 'https:', "'unsafe-inline'"],
      'upgrade-insecure-requests': [],
    },
  },

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },

  // Frame Options
  frameguard: {
    action: 'deny'
  },

  // Hide Powered By
  hidePoweredBy: true,

  // HSTS
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross Domain Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none'
  },

  // Referrer Policy
  referrerPolicy: {
    policy: ['same-origin']
  },

  // XSS Filter
  xssFilter: true,
});

// Headers de seguridad adicionales personalizados
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Request ID para trazabilidad
  const requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-ID', requestId);

  // Información del servicio
  res.setHeader('X-Service-Name', 'Restaurant-API');
  res.setHeader('X-Service-Version', '1.0.0');

  // Security headers adicionales
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature Policy / Permissions Policy
  res.setHeader('Permissions-Policy', [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()'
  ].join(', '));

  // Cache Control para APIs
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Remover headers que revelan información del servidor
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

// Middleware para detectar y prevenir clickjacking
export const antiClickjacking = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  next();
};

// Middleware para prevenir MIME type sniffing
export const preventMimeSniffing = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

// Middleware para habilitar HSTS
export const enableHSTS = (req: Request, res: Response, next: NextFunction) => {
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
};

// Middleware para CSP específico por ruta
export const routeSpecificCSP = (cspDirectives: { [key: string]: string[] }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const policies = Object.entries(cspDirectives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
    
    res.setHeader('Content-Security-Policy', policies);
    next();
  };
};

// Middleware para controlar el cache por tipo de endpoint
export const cacheControl = (options: {
  public?: boolean;
  maxAge?: number;
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const directives: string[] = [];

    if (options.public) {
      directives.push('public');
    } else {
      directives.push('private');
    }

    if (options.maxAge !== undefined) {
      directives.push(`max-age=${options.maxAge}`);
    }

    if (options.mustRevalidate) {
      directives.push('must-revalidate');
    }

    if (options.noCache) {
      directives.push('no-cache');
    }

    if (options.noStore) {
      directives.push('no-store');
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};

// Middleware para logging de headers de seguridad
export const logSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log headers de seguridad importantes
    const securityHeaders = {
      'x-frame-options': res.getHeader('x-frame-options'),
      'x-content-type-options': res.getHeader('x-content-type-options'),
      'x-xss-protection': res.getHeader('x-xss-protection'),
      'strict-transport-security': res.getHeader('strict-transport-security'),
      'content-security-policy': res.getHeader('content-security-policy'),
      'referrer-policy': res.getHeader('referrer-policy')
    };

    logger.debug('Security headers set:', {
      path: req.path,
      method: req.method,
      headers: securityHeaders
    });

    return originalSend.call(this, data);
  };

  next();
};

// Configuraciones predefinidas para diferentes tipos de endpoints
export const securityProfiles = {
  // Para endpoints públicos (landing pages, etc.)
  public: [
    helmetConfig,
    additionalSecurityHeaders,
    cacheControl({ public: true, maxAge: 3600 }) // 1 hora
  ],

  // Para APIs privadas
  api: [
    helmetConfig,
    additionalSecurityHeaders,
    antiClickjacking,
    cacheControl({ noCache: true, noStore: true })
  ],

  // Para endpoints administrativos
  admin: [
    helmetConfig,
    additionalSecurityHeaders,
    antiClickjacking,
    routeSpecificCSP({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'self'"],
      'frame-src': ["'none'"]
    }),
    cacheControl({ noCache: true, noStore: true, mustRevalidate: true })
  ],

  // Para endpoints de autenticación
  auth: [
    helmetConfig,
    additionalSecurityHeaders,
    antiClickjacking,
    routeSpecificCSP({
      'default-src': ["'self'"],
      'connect-src': ["'self'", `https://${config.AUTH0_DOMAIN}`],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'object-src': ["'none'"],
      'media-src': ["'none'"],
      'frame-src': ["'none'"]
    }),
    cacheControl({ noCache: true, noStore: true })
  ]
};

// Helper para generar Request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware para validar headers críticos de seguridad
export const validateSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Lista de headers críticos que deberían estar presentes
  const criticalHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection'
  ];

  // Interceptar la respuesta para validar headers
  const originalSend = res.send;
  res.send = function(data) {
    const missingHeaders = criticalHeaders.filter(header => 
      !res.getHeader(header)
    );

    if (missingHeaders.length > 0) {
      logger.warn('Missing critical security headers:', {
        path: req.path,
        missingHeaders
      });
    }

    return originalSend.call(this, data);
  };

  next();
};