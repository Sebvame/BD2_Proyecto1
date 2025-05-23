import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const config = {
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DB_TYPE: process.env.DB_TYPE || 'mongodb', // mongodb o postgresql
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant',
  POSTGRES_URI: process.env.POSTGRES_URI || 'postgresql://postgres:password@localhost:5432/restaurant',
  
  // Redis
  REDIS_URI: process.env.REDIS_URI || 'redis://localhost:6379',
  
  // Auth0
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN || 'dev-wf2ay78q8yluyvl7.us.auth0.com',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://restaurant-api.com',
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID || 'fXKlFtiID1sVfvZDLI0OaBBDUlhaup8M',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || 'RINPRYjblF88p0kDiMOmDfzjlaryeCIoirZU2CDcI51mfcBoTOyDczSbC2PVp_rd',
  
  // Elasticsearch
  ELASTICSEARCH_URI: process.env.ELASTICSEARCH_URI || 'http://localhost:9200',
};