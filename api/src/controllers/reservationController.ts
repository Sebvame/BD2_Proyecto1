import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { checkJwt, checkRole, handleAuthError } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const reservationRepository = RepositoryFactory.getReservationRepository();
const restaurantRepository = RepositoryFactory.getRestaurantRepository();
const userRepository = RepositoryFactory.getUserRepository();

// Middleware de validación
const validateReservation = [
  body('userId').optional().notEmpty().withMessage('User ID cannot be empty'),
  body('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('partySize').isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('status').optional().isIn(['pending', 'confirmed', 'cancelled']).withMessage('Status must be pending, confirmed, or cancelled'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
];

const validatePartialReservation = [
  body('userId').optional().notEmpty().withMessage('User ID cannot be empty'),
  body('restaurantId').optional().notEmpty().withMessage('Restaurant ID cannot be empty'),
  body('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Time must be in HH:MM format'),
  body('partySize').optional().isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('status').optional().isIn(['pending', 'confirmed', 'cancelled']).withMessage('Status must be pending, confirmed, or cancelled'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
];

const validateStatusUpdate = [
  body('status').isIn(['pending', 'confirmed', 'cancelled']).withMessage('Status must be pending, confirmed, or cancelled'),
];

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware para validar fecha no sea en el pasado
const validateFutureDate = (req: Request, res: Response, next: NextFunction) => {
  const { date, time } = req.body;
  
  if (date && time) {
    const reservationDateTime = new Date(`${date}T${time}:00`);
    const now = new Date();
    
    if (reservationDateTime <= now) {
      return res.status(400).json({
        error: {
          message: 'Reservation date and time must be in the future',
        },
      });
    }
  }
  
  next();
};

// Middleware para verificar disponibilidad
const checkAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurantId, date, time } = req.body;
    
    if (restaurantId && date && time) {
      // Verificar cuántas reservas hay para esa fecha y hora
      const existingReservations = await reservationRepository.findByDateAndTime(
        restaurantId, 
        date, 
        time
      );
      
      // Límite simple: máximo 10 reservas por hora (esto debería ser configurable por restaurante)
      const MAX_RESERVATIONS_PER_HOUR = 10;
      
      if (existingReservations.length >= MAX_RESERVATIONS_PER_HOUR) {
        return res.status(409).json({
          error: {
            message: 'No availability for the selected date and time',
            availableSlots: MAX_RESERVATIONS_PER_HOUR - existingReservations.length,
          },
        });
      }
      
      // Agregar información de disponibilidad a la request
      (req as any).availabilityInfo = {
        existingReservations: existingReservations.length,
        maxCapacity: MAX_RESERVATIONS_PER_HOUR,
        availableSlots: MAX_RESERVATIONS_PER_HOUR - existingReservations.length,
      };
    }
    
    next();
  } catch (error) {
    logger.error('Error checking availability:', error);
    next(error);
  }
};

// Obtener todas las reservas (admin) o por usuario
router.get(
  '/',
  checkJwt,
  handleAuthError,
  query('restaurantId').optional().notEmpty().withMessage('Restaurant ID cannot be empty'),
  query('userId').optional().notEmpty().withMessage('User ID cannot be empty'),
  query('status').optional().isIn(['pending', 'confirmed', 'cancelled']).withMessage('Status must be pending, confirmed, or cancelled'),
  query('startDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Start date must be in YYYY-MM-DD format'),
  query('endDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('End date must be in YYYY-MM-DD format'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, userId, status, startDate, endDate } = req.query;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      let reservations;

      // Si es admin, puede ver todas las reservas con filtros
      if (userRole.includes('restaurant-admin')) {
        if (restaurantId && startDate && endDate) {
          reservations = await reservationRepository.findByDateRange(
            restaurantId as string, 
            startDate as string, 
            endDate as string
          );
        } else if (restaurantId) {
          reservations = await reservationRepository.findByRestaurantId(restaurantId as string);
        } else if (userId) {
          reservations = await reservationRepository.findByUserId(userId as string);
        } else {
          reservations = await reservationRepository.findAll();
        }
      } else {
        // Los clientes solo pueden ver sus propias reservas
        reservations = await reservationRepository.findByUserId(currentUserId!);
      }

      // Filtrar por estado si se especifica
      if (status) {
        reservations = reservations.filter(reservation => reservation.status === status);
      }

      res.json({
        filters: { restaurantId, userId, status, startDate, endDate },
        count: reservations.length,
        results: reservations
      });
    } catch (error) {
      logger.error('Error fetching reservations:', error);
      next(error);
    }
  }
);

// Obtener reservas activas por restaurante (admin)
router.get(
  '/restaurant/:restaurantId/active',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      
      // Verificar que el restaurante existe
      const restaurant = await restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      const activeReservations = await reservationRepository.findActiveReservations(restaurantId);
      
      res.json({
        restaurantId,
        count: activeReservations.length,
        results: activeReservations
      });
    } catch (error) {
      logger.error(`Error fetching active reservations for restaurant ${req.params.restaurantId}:`, error);
      next(error);
    }
  }
);

// Obtener disponibilidad para una fecha específica
router.get(
  '/availability/:restaurantId/:date',
  param('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  param('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be in YYYY-MM-DD format'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, date } = req.params;
      
      // Verificar que el restaurante existe
      const restaurant = await restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      // Obtener el conteo de reservas para esa fecha
      const reservationCount = await reservationRepository.countReservationsByDate(restaurantId, date);
      
      // Configuración simple de disponibilidad (esto debería venir de la configuración del restaurante)
      const MAX_DAILY_RESERVATIONS = 100; // Máximo por día
      const MAX_HOURLY_RESERVATIONS = 10; // Máximo por hora
      
      // Generar horarios disponibles (ejemplo: cada hora de 12:00 a 22:00)
      const availableSlots = [];
      const startHour = 12;
      const endHour = 22;
      
      for (let hour = startHour; hour <= endHour; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const hourlyReservations = await reservationRepository.findByDateAndTime(
          restaurantId, 
          date, 
          timeSlot
        );
        
        availableSlots.push({
          time: timeSlot,
          available: hourlyReservations.length < MAX_HOURLY_RESERVATIONS,
          remainingSlots: Math.max(0, MAX_HOURLY_RESERVATIONS - hourlyReservations.length),
          currentReservations: hourlyReservations.length
        });
      }
      
      res.json({
        restaurantId,
        date,
        totalReservations: reservationCount,
        maxDailyCapacity: MAX_DAILY_RESERVATIONS,
        remainingDailySlots: Math.max(0, MAX_DAILY_RESERVATIONS - reservationCount),
        timeSlots: availableSlots
      });
    } catch (error) {
      logger.error(`Error fetching availability for restaurant ${req.params.restaurantId} on ${req.params.date}:`, error);
      next(error);
    }
  }
);

// Obtener reserva por ID
router.get(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Reservation ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservation = await reservationRepository.findById(req.params.id);
      
      if (!reservation) {
        return res.status(404).json({
          error: {
            message: 'Reservation not found',
          },
        });
      }
      
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar que el usuario puede acceder a esta reserva
      if (!userRole.includes('restaurant-admin') && reservation.userId !== currentUserId) {
        return res.status(403).json({
          error: {
            message: 'Cannot access other user\'s reservation',
          },
        });
      }
      
      res.json(reservation);
    } catch (error) {
      logger.error(`Error fetching reservation with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Crear reserva
router.post(
  '/',
  checkJwt,
  handleAuthError,
  validateReservation,
  checkValidation,
  validateFutureDate,
  checkAvailability,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      const reservationData = {
        ...req.body,
        userId: req.body.userId || currentUserId, // Usar el usuario actual si no se especifica
        status: 'pending' as const
      };
      
      // Verificar que el restaurante existe
      const restaurant = await restaurantRepository.findById(reservationData.restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      // Verificar que el usuario existe
      const user = await userRepository.findById(reservationData.userId);
      if (!user) {
        return res.status(404).json({
          error: {
            message: 'User not found',
          },
        });
      }
      
      const newReservation = await reservationRepository.create(reservationData);
      
      logger.info(`Reservation created: ${newReservation.id} by user ${req.auth?.sub}`);
      res.status(201).json({
        ...newReservation,
        availabilityInfo: (req as any).availabilityInfo
      });
    } catch (error) {
      logger.error('Error creating reservation:', error);
      next(error);
    }
  }
);

// Actualizar reserva
router.put(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Reservation ID is required'),
  validatePartialReservation,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id;
      const updateData = req.body;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar si la reserva existe
      const existingReservation = await reservationRepository.findById(reservationId);
      if (!existingReservation) {
        return res.status(404).json({
          error: {
            message: 'Reservation not found',
          },
        });
      }
      
      // Verificar permisos: admin puede editar cualquier reserva, usuario solo las suyas
      if (!userRole.includes('restaurant-admin') && existingReservation.userId !== currentUserId) {
        return res.status(403).json({
          error: {
            message: 'Cannot modify other user\'s reservation',
          },
        });
      }
      
      // Validar fecha futura si se está actualizando la fecha/hora
      if (updateData.date || updateData.time) {
        const date = updateData.date || existingReservation.date;
        const time = updateData.time || existingReservation.time;
        const reservationDateTime = new Date(`${date}T${time}:00`);
        const now = new Date();
        
        if (reservationDateTime <= now) {
          return res.status(400).json({
            error: {
              message: 'Reservation date and time must be in the future',
            },
          });
        }
      }
      
      const updatedReservation = await reservationRepository.update(reservationId, updateData);
      
      logger.info(`Reservation updated: ${reservationId} by user ${req.auth?.sub}`);
      res.json(updatedReservation);
    } catch (error) {
      logger.error(`Error updating reservation with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Actualizar estado de reserva (principalmente para admin)
router.patch(
  '/:id/status',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Reservation ID is required'),
  validateStatusUpdate,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id;
      const { status } = req.body;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar si la reserva existe
      const existingReservation = await reservationRepository.findById(reservationId);
      if (!existingReservation) {
        return res.status(404).json({
          error: {
            message: 'Reservation not found',
          },
        });
      }
      
      // Los clientes solo pueden cancelar sus propias reservas
      if (!userRole.includes('restaurant-admin')) {
        if (existingReservation.userId !== currentUserId) {
          return res.status(403).json({
            error: {
              message: 'Cannot modify other user\'s reservation',
            },
          });
        }
        
        // Los clientes solo pueden cancelar
        if (status !== 'cancelled') {
          return res.status(403).json({
            error: {
              message: 'Customers can only cancel reservations',
            },
          });
        }
      }
      
      const updatedReservation = await reservationRepository.updateStatus(reservationId, status);
      
      logger.info(`Reservation status updated: ${reservationId} to ${status} by user ${req.auth?.sub}`);
      res.json(updatedReservation);
    } catch (error) {
      logger.error(`Error updating reservation status with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Eliminar reserva
router.delete(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Reservation ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reservationId = req.params.id;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar si la reserva existe
      const existingReservation = await reservationRepository.findById(reservationId);
      if (!existingReservation) {
        return res.status(404).json({
          error: {
            message: 'Reservation not found',
          },
        });
      }
      
      // Verificar permisos
      if (!userRole.includes('restaurant-admin') && existingReservation.userId !== currentUserId) {
        return res.status(403).json({
          error: {
            message: 'Cannot delete other user\'s reservation',
          },
        });
      }
      
      const deleted = await reservationRepository.delete(reservationId);
      if (!deleted) {
        return res.status(500).json({
          error: {
            message: 'Failed to delete reservation',
          },
        });
      }
      
      logger.info(`Reservation deleted: ${reservationId} by user ${req.auth?.sub}`);
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting reservation with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

export default router;