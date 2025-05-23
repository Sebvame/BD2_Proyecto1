import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './src/utils/logger';
import { initializeElasticsearch } from './src/services/elasticsearch';

// Importar rutas
import searchRoutes from './controllers/searchController';

// Inicializar express
const app = express();
const PORT = config.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Rutas
app.use('/search', searchRoutes);

// Ruta health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'Search', timestamp: new Date().toISOString() });
});

// Middleware de manejo de errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(`${err.name}: ${err.message}`);
  res.status(500).json({
    error: {
      message: 'Internal server error',
    },
  });
});

// Iniciar el servidor
const startServer = async () => {
  try {
    // Inicializar ElasticSearch
    await initializeElasticsearch();
    
    app.listen(PORT, () => {
      logger.info(`Search service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start search service:', error);
    process.exit(1);
  }
};

// Si este archivo se ejecuta directamente, iniciar el servidor
if (require.main === module) {
  startServer();
}

export default app; // Para pruebas