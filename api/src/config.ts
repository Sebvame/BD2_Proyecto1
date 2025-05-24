import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const config = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  
  // Database Configuration
  DB_TYPE: process.env.DB_TYPE || 'mongodb', // 'mongodb' | 'postgresql'
  
  // MongoDB Configuration
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant-db',
  
  // PostgreSQL Configuration
  POSTGRES_URI: process.env.POSTGRES_URI || 'postgresql://postgres:password@localhost:5432/restaurant_db',
  
  // Redis Configuration
  REDIS_URI: process.env.REDIS_URI || 'redis://localhost:6379',
  
  // Auth0 Configuration
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || 'dev-wf2ay78q8yluyvl7.us.auth0.com',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://restaurant-api.com',
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || 'fXKlFtiID1sVfvZDLI0OaBBDUlhaup8M',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || 'RINPRYjblF88p0kDiMOmDfzjlaryeCIoirZU2CDcI51mfcBoTOyDczSbC2PVp_rd',
  
  // External Services
  SEARCH_SERVICE_URL: process.env.SEARCH_SERVICE_URL || 'http://localhost:3001',
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  
  // CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:80',
    'http://127.0.0.1:3000'
  ],
  
  // Security
  JWT_SECRET: process.env.JWT_SECRET || 'your-fallback-secret-key',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // Session
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret',
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600', 10), // 1 hora
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Business Rules
  DEFAULT_RESERVATION_DURATION: parseInt(process.env.DEFAULT_RESERVATION_DURATION || '120', 10), // 2 horas
  MAX_ADVANCE_BOOKING_DAYS: parseInt(process.env.MAX_ADVANCE_BOOKING_DAYS || '30', 10),
  
  // Email (si necesitas notificaciones)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  
  // Monitoring
  SENTRY_DSN: process.env.SENTRY_DSN,
  
  // Feature flags
  ENABLE_ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true',
  ENABLE_CACHE: process.env.ENABLE_CACHE !== 'false', // Por defecto habilitado
};

// Validación de configuración crítica
const validateConfig = () => {
  const required = [
    'DB_TYPE',
    'AUTH0_DOMAIN',
    'AUTH0_AUDIENCE'
  ];

  const missing = required.filter(key => !config[key as keyof typeof config]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validar que DB_TYPE sea soportado
  if (!['mongodb', 'postgresql'].includes(config.DB_TYPE)) {
    throw new Error('DB_TYPE must be either "mongodb" or "postgresql"');
  }

  // Validar que las URIs de base de datos estén configuradas
  if (config.DB_TYPE === 'mongodb' && !config.MONGODB_URI) {
    throw new Error('MONGODB_URI is required when DB_TYPE is mongodb');
  }

  if (config.DB_TYPE === 'postgresql' && !config.POSTGRES_URI) {
    throw new Error('POSTGRES_URI is required when DB_TYPE is postgresql');
  }

  // Validar que el entorno sea válido
  if (!['development', 'staging', 'production', 'test'].includes(config.NODE_ENV)) {
    console.warn(`Unknown NODE_ENV: ${config.NODE_ENV}. Using 'development' as fallback.`);
  }
};

// Ejecutar validación
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
  if (config.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export default config;