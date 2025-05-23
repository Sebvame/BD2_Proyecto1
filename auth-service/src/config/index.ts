import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const config = {
  // Server
  PORT: process.env.AUTH_PORT || 3002,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Auth0 Configuration
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || 'dev-wf2ay78q8yluyvl7.us.auth0.com',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://restaurant-api.com',
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || 'fXKlFtiID1sVfvZDLI0OaBBDUlhaup8M',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || 'RINPRYjblF88p0kDiMOmDfzjlaryeCIoirZU2CDcI51mfcBoTOyDczSbC2PVp_rd',
  
  // Management API
  AUTH0_MANAGEMENT_CLIENT_ID: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
  AUTH0_MANAGEMENT_CLIENT_SECRET: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
  
  // Redis para caché de tokens
  REDIS_URI: process.env.REDIS_URI || 'redis://localhost:6379',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-fallback-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  
  // Session Configuration
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '3600'), // 1 hora en segundos
  
  // API URLs
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  
  // Security
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  
  // Allowed Origins for CORS
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:80'
  ],
};

// Validar configuración crítica
const requiredEnvVars = [
  'AUTH0_DOMAIN',
  'AUTH0_AUDIENCE',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar] && config.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export default config;