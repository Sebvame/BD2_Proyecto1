import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const config = {
  // Server
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // ElasticSearch
  ELASTICSEARCH_URI: process.env.ELASTICSEARCH_URI || 'http://localhost:9200',
  
  // Redis
  REDIS_URI: process.env.REDIS_URI || 'redis://localhost:6379',
  
  // API Principal (para obtener datos a indexar)
  API_URI: process.env.API_URI || 'http://localhost:3000',
};