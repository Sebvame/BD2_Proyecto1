import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { connectToDatabase } from './utils/db';
import { RepositoryFactory } from './repositories/repositoryFactory';

// Security & Rate Limiting Middleware
import { 
  corsOptions, 
  helmetConfig, 
  additionalSecurityHeaders,
  securityProfiles 
} from './middleware/securityHeaders';
import { 
  rateLimitConfigs, 
  speedLimitConfigs,
  suspiciousActivityDetector,
  botDetector
} from './middleware/rateLimiting';
import { 
  fullValidationSuite,
  sanitizeInput,
  validateContentType,
  validatePayloadSize
} from './middleware/requestValidation';

// Importar rutas
import userRoutes from './controllers/userController';
import restaurantRoutes from './controllers/restaurantController';
import menuItemRoutes from './controllers/menuItemController';
import reservationRoutes from './controllers/reservationController';
import orderRoutes from './controllers/orderController';

// Inicializar express
const app = express();
const PORT = config.PORT || 3000;

// Trust proxy para obtener IPs reales
app.set('trust proxy', 1);

// Aplicar headers de seguridad globales
app.use(helmetConfig);
app.use(additionalSecurityHeaders);

// CORS configuration
app.use(cors(corsOptions));

// Rate limiting global (aplicar antes que otros middleware)
app.use(rateLimitConfigs.general);
app.use(speedLimitConfigs.general);


// Body parsing con validación de tamaño
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitización de input global
app.use(sanitizeInput);

// Request logging
const morganLogger = require('morgan');
app.use(morganLogger('combined', { 
  stream: { write: (message: string) => logger.info(message.trim()) },
  skip: (req: Request) => req.path === '/health' // No logear health checks
}));

// Middleware para añadir Request ID
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// RUTAS CON MIDDLEWARE ESPECÍFICO

// Rutas de usuarios (perfil administrativo)
app.use('/api/users', 
  ...securityProfiles.admin,
  rateLimitConfigs.admin,
  userRoutes
);

// Rutas de restaurantes (públicas + admin)
app.use('/api/restaurants',
  ...securityProfiles.api,
  speedLimitConfigs.search, // Para búsquedas de restaurantes
  restaurantRoutes
);

// Rutas de items del menú (públicas + admin)
app.use('/api/menu-items',
  ...securityProfiles.api,
  speedLimitConfigs.search, // Para búsquedas de menú
  menuItemRoutes
);

// Rutas de reservas (protegidas)
app.use('/api/reservations',
  ...securityProfiles.api,
  rateLimitConfigs.create, // Limitar creación de reservas
  reservationRoutes
);

// Rutas de órdenes (protegidas)
app.use('/api/orders',
  ...securityProfiles.api,
  rateLimitConfigs.create, // Limitar creación de órdenes
  orderRoutes
);

// Health check (sin middleware pesado)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'Restaurant API', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: config.DB_TYPE,
    environment: config.NODE_ENV
  });
});

// Endpoint para estadísticas de seguridad (solo admin)
app.get('/api/security/stats', 
  ...securityProfiles.admin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Aquí podrías implementar estadísticas de seguridad
      res.json({
        message: 'Security stats endpoint',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`,
      code: 'ROUTE_NOT_FOUND'
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    }
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log del error con contexto
  logger.error('Unhandled error:', {
    error: err.message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id']
  });

  // Determinar código de estado
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  }

  // No revelar detalles del error en producción
  const errorMessage = config.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: {
      message: errorMessage,
      code: errorCode
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    }
  });
});

// Función para iniciar el servidor
const startServer = async () => {
  try {
    // Validar configuración de repositorios
    RepositoryFactory.validateConfiguration();
    
    // Conectar a la base de datos
    await connectToDatabase();
    
    // Verificar que los repositorios funcionan
    const userRepo = RepositoryFactory.getUserRepository();
    logger.info(`Database repositories initialized (${config.DB_TYPE})`);
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Restaurant API server running on port ${PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info(`🔒 Database: ${config.DB_TYPE}`);
      logger.info(`🔐 Security headers enabled`);
      logger.info(`⚡ Rate limiting active`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        try {
          // Cerrar conexiones de base de datos
          const { closeConnections } = await import('./utils/db.js');
          await closeConnections();
          
          // Cleanup de rate limiting
          const { cleanup } = await import('./middleware/rateLimiting.js');
          await cleanup();
          
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force close after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Si este archivo se ejecuta directamente, iniciar el servidor
if (require.main === module) {
  startServer();
}

export default app;