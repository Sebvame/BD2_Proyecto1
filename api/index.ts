import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import { connectToDatabase } from './utils/db';

// Importar rutas
import userRoutes from './controllers/userController';
import restaurantRoutes from './controllers/restaurantController';
import menuItemRoutes from './controllers/menuItemController';
import reservationRoutes from './controllers/reservationController';
import orderRoutes from './controllers/orderController';

// Inicializar express
const app = express();
const PORT = config.PORT || 3000;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/orders', orderRoutes);

// Ruta health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'API', timestamp: new Date().toISOString() });
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
    // Conectar a la base de datos
    await connectToDatabase();
    
    app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Si este archivo se ejecuta directamente, iniciar el servidor
if (require.main === module) {
  startServer();
}

export default app; // Para pruebas