import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Cliente Redis
let redisClient: ReturnType<typeof createClient>;
let redisConnected = false;

// Inicializar Redis
export const initializeRedis = async () => {
  try {
    logger.info('Initializing Redis client...');
    
    redisClient = createClient({
      url: config.REDIS_URI
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis error:', err);
      redisConnected = false;
    });
    
    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
      redisConnected = true;
    });
    
    redisClient.on('reconnecting', () => {
      logger.warn('Reconnecting to Redis...');
    });
    
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    redisConnected = false;
    return null;
  }
};

// Obtener cliente Redis
export const getRedisClient = () => {
  if (!redisClient || !redisConnected) {
    throw new Error('Redis client not initialized or not connected');
  }
  return redisClient;
};

// Middleware de caché
export const cacheMiddleware = (durationInSeconds: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisConnected) {
      return next();
    }
    
    // Crear clave basada en la URL y parámetros
    const cacheKey = `cache:${req.originalUrl || req.url}`;
    
    try {
      // Intentar obtener datos de caché
      const cachedData = await redisClient.get(cacheKey);
      
      if (cachedData) {
        // Si hay datos en caché, devolverlos
        logger.info(`Cache hit for ${cacheKey}`);
        return res.json(JSON.parse(cachedData));
      }
      
      // Si no hay datos en caché, continuar con la solicitud
      logger.info(`Cache miss for ${cacheKey}`);
      
      // Guardar respuesta original
      const originalSend = res.send;
      
      // Sobreescribir método send para guardar en caché
      res.send = function (body: any): Response {
        // Solo almacenar en caché respuestas exitosas
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisClient.setEx(cacheKey, durationInSeconds, body.toString())
            .catch(err => logger.error(`Error setting cache for ${cacheKey}:`, err));
          
          logger.info(`Cached ${cacheKey} for ${durationInSeconds} seconds`);
        }
        
        // Restaurar el método original y enviar la respuesta
        res.send = originalSend;
        return originalSend.call(this, body);
      };
      
      next();
    } catch (error) {
      logger.error(`Cache error for ${cacheKey}:`, error);
      next();
    }
  };
};

// Limpiar toda la caché
export const clearCache = async () => {
  if (!redisConnected) {
    logger.warn('Redis not connected, cannot clear cache');
    return false;
  }
  
  try {
    // Patrón para buscar todas las claves de caché
    const keys = await redisClient.keys('cache:*');
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared ${keys.length} cache entries`);
    } else {
      logger.info('No cache entries to clear');
    }
    
    return true;
  } catch (error) {
    logger.error('Error clearing cache:', error);
    return false;
  }
};

// Limpiar caché por patrón
export const clearCacheByPattern = async (pattern: string) => {
  if (!redisConnected) {
    logger.warn('Redis not connected, cannot clear cache');
    return false;
  }
  
  try {
    // Patrón para buscar claves de caché específicas
    const keys = await redisClient.keys(`cache:*${pattern}*`);
    
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared ${keys.length} cache entries matching pattern ${pattern}`);
    } else {
      logger.info(`No cache entries matching pattern ${pattern}`);
    }
    
    return true;
  } catch (error) {
    logger.error(`Error clearing cache with pattern ${pattern}:`, error);
    return false;
  }
};

// Cerrar conexión Redis
export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
};

// Inicializar Redis cuando se importa este módulo
initializeRedis().catch(err => 
  logger.error('Failed to initialize Redis on module load:', err)
);