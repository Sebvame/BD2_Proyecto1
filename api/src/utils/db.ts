import mongoose from 'mongoose';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from './logger';

// Conexión a MongoDB
let mongoConnection: typeof mongoose | null = null;

// Conexión a PostgreSQL
let pgPool: Pool | null = null;

export const connectToDatabase = async () => {
  const dbType = config.DB_TYPE;
  
  if (dbType === 'mongodb') {
    return connectToMongoDB();
  } else if (dbType === 'postgresql') {
    return connectToPostgreSQL();
  } else {
    throw new Error(`Unsupported database type: ${dbType}`);
  }
};

export const connectToMongoDB = async () => {
  if (mongoConnection) {
    return mongoConnection;
  }

  try {
    logger.info('Connecting to MongoDB...');
    mongoose.set('strictQuery', false);
    
    // Conectar a la base de datos
    await mongoose.connect(config.MONGODB_URI);
    
    // Eventos de conexión
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoConnection = mongoose;
    logger.info('Connected to MongoDB successfully');
    return mongoConnection;
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

export const connectToPostgreSQL = async () => {
  if (pgPool) {
    return pgPool;
  }

  try {
    logger.info('Connecting to PostgreSQL...');
    
    // Crear un nuevo pool de conexiones
    const pool = new Pool({
      connectionString: config.POSTGRES_URI,
    });
    
    // Probar la conexión
    const client = await pool.connect();
    client.release();
    
    pgPool = pool;
    logger.info('Connected to PostgreSQL successfully');
    return pgPool;
  } catch (error) {
    logger.error('Error connecting to PostgreSQL:', error);
    throw error;
  }
};

export const getMongoConnection = () => {
  if (!mongoConnection) {
    throw new Error('MongoDB connection not established');
  }
  return mongoConnection;
};

export const getPgPool = () => {
  if (!pgPool) {
    throw new Error('PostgreSQL connection not established');
  }
  return pgPool;
};

export const closeConnections = async () => {
  try {
    if (mongoConnection) {
      await mongoose.disconnect();
      mongoConnection = null;
      logger.info('Disconnected from MongoDB');
    }
    
    if (pgPool) {
      await pgPool.end();
      pgPool = null;
      logger.info('Disconnected from PostgreSQL');
    }
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};