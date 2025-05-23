import winston from 'winston';
import { config } from '../config';

// Definir los niveles de log
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Añadir colores a winston
winston.addColors(colors);

// Definir el formato
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, stack, ...meta } = info;
      
      let logMessage = `${timestamp} [AUTH-SERVICE] ${level}: ${message}`;
      
      // Agregar stack trace si es un error
      if (stack) {
        logMessage += `\n${stack}`;
      }
      
      // Agregar metadata si existe
      if (Object.keys(meta).length > 0) {
        logMessage += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      return logMessage;
    },
  ),
);

// Definir los transportes
const transports = [
  // Consola
  new winston.transports.Console({
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
  
  // Archivos de log
  new winston.transports.File({
    filename: 'logs/auth-error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  new winston.transports.File({ 
    filename: 'logs/auth-combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Log de seguridad separado
  new winston.transports.File({
    filename: 'logs/auth-security.log',
    level: 'warn',
    maxsize: 5242880, // 5MB
    maxFiles: 10,
  }),
];

// Crear el logger
export const logger = winston.createLogger({
  level: config.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports,
  // No salir en errores no capturados
  exitOnError: false,
});

// Stream para Morgan
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Funciones auxiliares para logging estructurado
export const loggers = {
  security: (event: string, data: any) => {
    logger.warn(`SECURITY_EVENT: ${event}`, data);
  },
  
  auth: (action: string, data: any) => {
    logger.info(`AUTH_ACTION: ${action}`, data);
  },
  
  api: (method: string, endpoint: string, statusCode: number, responseTime: number, userId?: string) => {
    logger.http(`${method} ${endpoint} ${statusCode} ${responseTime}ms`, { userId });
  },
  
  error: (error: Error, context?: any) => {
    logger.error(error.message, { 
      error: error.name,
      stack: error.stack,
      context 
    });
  },
  
  debug: (message: string, data?: any) => {
    if (config.NODE_ENV === 'development') {
      logger.debug(message, data);
    }
  }
};

export default logger;