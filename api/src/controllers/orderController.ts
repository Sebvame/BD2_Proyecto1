import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { checkJwt, checkRole, handleAuthError } from '../middleware/auth';
import { logger } from '../utils/logger';
import { Order, OrderItem } from '../models';

const router = express.Router();
const orderRepository = RepositoryFactory.getOrderRepository();
const restaurantRepository = RepositoryFactory.getRestaurantRepository();
const menuItemRepository = RepositoryFactory.getMenuItemRepository();
const userRepository = RepositoryFactory.getUserRepository();

// Middleware de validación
const validateOrderItem = [
  body('menuItemId').notEmpty().withMessage('Menu item ID is required'),
  body('name').notEmpty().trim().withMessage('Item name is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('specialInstructions').optional().trim().isLength({ max: 200 }).withMessage('Special instructions cannot exceed 200 characters'),
];

const validateOrder = [
  body('userId').optional().notEmpty().withMessage('User ID cannot be empty'),
  body('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*').custom((item, { req }) => {
    const errors = [];
    if (!item.menuItemId || typeof item.menuItemId !== 'string') {
      errors.push('Menu item ID is required');
    }
    if (!item.name || typeof item.name !== 'string') {
      errors.push('Item name is required');
    }
    if (typeof item.price !== 'number' || item.price < 0) {
      errors.push('Price must be a positive number');
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }
    if (item.specialInstructions && typeof item.specialInstructions === 'string' && item.specialInstructions.length > 200) {
      errors.push('Special instructions cannot exceed 200 characters');
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    return true;
  }),
  body('status').optional().isIn(['pending', 'preparing', 'ready', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('total').isFloat({ min: 0 }).withMessage('Total must be a positive number'),
  body('pickupTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Pickup time must be in HH:MM format'),
];

const validatePartialOrder = [
  body('userId').optional().notEmpty().withMessage('User ID cannot be empty'),
  body('restaurantId').optional().notEmpty().withMessage('Restaurant ID cannot be empty'),
  body('status').optional().isIn(['pending', 'preparing', 'ready', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('total').optional().isFloat({ min: 0 }).withMessage('Total must be a positive number'),
  body('pickupTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Pickup time must be in HH:MM format'),
];

const validateStatusUpdate = [
  body('status').isIn(['pending', 'preparing', 'ready', 'completed', 'cancelled']).withMessage('Invalid status'),
];

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware para calcular y validar el total del pedido
const validateOrderTotal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, total } = req.body;
    
    if (items && items.length > 0) {
      // Calcular el total basado en los items
      let calculatedTotal = 0;
      
      for (const item of items) {
        // Verificar que el menu item existe y el precio coincide
        const menuItem = await menuItemRepository.findById(item.menuItemId);
        if (!menuItem) {
          return res.status(404).json({
            error: {
              message: `Menu item not found: ${item.menuItemId}`,
            },
          });
        }
        
        if (!menuItem.available) {
          return res.status(400).json({
            error: {
              message: `Menu item is not available: ${menuItem.name}`,
            },
          });
        }
        
        // El precio del item debe coincidir con el precio actual del menú
        if (Math.abs(item.price - menuItem.price) > 0.01) {
          return res.status(400).json({
            error: {
              message: `Price mismatch for item: ${menuItem.name}. Expected: ${menuItem.price}, received: ${item.price}`,
            },
          });
        }
        
        calculatedTotal += item.price * item.quantity;
      }
      
      // Verificar que el total enviado coincide con el calculado
      if (Math.abs(total - calculatedTotal) > 0.01) {
        return res.status(400).json({
          error: {
            message: `Total mismatch. Expected: ${calculatedTotal.toFixed(2)}, received: ${total}`,
            calculatedTotal: parseFloat(calculatedTotal.toFixed(2)),
          },
        });
      }
      
      // Agregar información calculada a la request
      (req as any).orderInfo = {
        calculatedTotal: parseFloat(calculatedTotal.toFixed(2)),
        itemCount: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      };
    }
    
    next();
  } catch (error) {
    logger.error('Error validating order total:', error);
    next(error);
  }
};

// Obtener todas las órdenes (admin) o por usuario
router.get(
  '/',
  checkJwt,
  handleAuthError,
  query('restaurantId').optional().notEmpty().withMessage('Restaurant ID cannot be empty'),
  query('userId').optional().notEmpty().withMessage('User ID cannot be empty'),
  query('status').optional().isIn(['pending', 'preparing', 'ready', 'completed', 'cancelled']).withMessage('Invalid status'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, userId, status, startDate, endDate, limit } = req.query;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      let orders;

      // Si es admin, puede ver todas las órdenes con filtros
      if (userRole.includes('restaurant-admin')) {
        if (restaurantId && startDate && endDate) {
          orders = await orderRepository.findOrdersByDateRange(
            restaurantId as string, 
            startDate as string, 
            endDate as string
          );
        } else if (restaurantId) {
          orders = await orderRepository.findByRestaurantId(restaurantId as string);
        } else if (userId) {
          orders = await orderRepository.findByUserId(userId as string);
        } else if (status) {
          orders = await orderRepository.findByStatus(status as Order['status']);
        } else {
          orders = await orderRepository.findAll();
        }
      } else {
        // Los clientes solo pueden ver sus propias órdenes
        if (limit) {
          orders = await orderRepository.findRecentOrdersByUser(currentUserId!, parseInt(limit as string));
        } else {
          orders = await orderRepository.findByUserId(currentUserId!);
        }
      }

      // Filtrar por estado si se especifica y no se filtró ya
      if (status && (!userRole.includes('restaurant-admin') || !req.query.status)) {
        orders = orders.filter(order => order.status === status);
      }

      res.json({
        filters: { restaurantId, userId, status, startDate, endDate, limit },
        count: orders.length,
        results: orders
      });
    } catch (error) {
      logger.error('Error fetching orders:', error);
      next(error);
    }
  }
);

// Obtener órdenes activas por restaurante (admin)
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
      
      const activeOrders = await orderRepository.findActiveOrders(restaurantId);
      
      res.json({
        restaurantId,
        count: activeOrders.length,
        results: activeOrders
      });
    } catch (error) {
      logger.error(`Error fetching active orders for restaurant ${req.params.restaurantId}:`, error);
      next(error);
    }
  }
);

// Obtener estadísticas de ingresos por restaurante (admin)
router.get(
  '/restaurant/:restaurantId/revenue',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const { startDate, endDate } = req.query;
      
      // Verificar que el restaurante existe
      const restaurant = await restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      const totalRevenue = await orderRepository.calculateTotalRevenue(
        restaurantId,
        startDate as string,
        endDate as string
      );
      
      res.json({
        restaurantId,
        period: { startDate, endDate },
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        currency: 'USD'
      });
    } catch (error) {
      logger.error(`Error fetching revenue for restaurant ${req.params.restaurantId}:`, error);
      next(error);
    }
  }
);

// Obtener orden por ID
router.get(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Order ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderRepository.findById(req.params.id);
      
      if (!order) {
        return res.status(404).json({
          error: {
            message: 'Order not found',
          },
        });
      }
      
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar que el usuario puede acceder a esta orden
      if (!userRole.includes('restaurant-admin') && order.userId !== currentUserId) {
        return res.status(403).json({
          error: {
            message: 'Cannot access other user\'s order',
          },
        });
      }
      
      res.json(order);
    } catch (error) {
      logger.error(`Error fetching order with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Crear orden
router.post(
  '/',
  checkJwt,
  handleAuthError,
  validateOrder,
  checkValidation,
  validateOrderTotal,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      const orderData = {
        ...req.body,
        userId: req.body.userId || currentUserId,
        status: 'pending' as const,
        createdAt: new Date().toISOString()
      };
      
      // Verificar que el restaurante existe
      const restaurant = await restaurantRepository.findById(orderData.restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      // Verificar que el usuario existe
      const user = await userRepository.findById(orderData.userId);
      if (!user) {
        return res.status(404).json({
          error: {
            message: 'User not found',
          },
        });
      }
      
      const newOrder = await orderRepository.create(orderData);
      
      logger.info(`Order created: ${newOrder.id} by user ${req.auth?.sub}`);
      res.status(201).json({
        ...newOrder,
        orderInfo: (req as any).orderInfo
      });
    } catch (error) {
      logger.error('Error creating order:', error);
      next(error);
    }
  }
);

// Actualizar orden (limitado)
router.put(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Order ID is required'),
  validatePartialOrder,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.id;
      const updateData = req.body;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar si la orden existe
      const existingOrder = await orderRepository.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          error: {
            message: 'Order not found',
          },
        });
      }
      
      // Verificar permisos
      if (!userRole.includes('restaurant-admin') && existingOrder.userId !== currentUserId) {
        return res.status(403).json({
          error: {
            message: 'Cannot modify other user\'s order',
          },
        });
      }
      
      // Los clientes no pueden cambiar ciertos campos
      if (!userRole.includes('restaurant-admin')) {
        const restrictedFields = ['status', 'total', 'restaurantId'];
        const hasRestrictedUpdates = restrictedFields.some(field => field in updateData);
        
        if (hasRestrictedUpdates) {
          return res.status(403).json({
            error: {
              message: 'Customers cannot modify order status, total, or restaurant',
            },
          });
        }
      }
      
      // No se puede modificar una orden completada o cancelada
      if (['completed', 'cancelled'].includes(existingOrder.status)) {
        return res.status(400).json({
          error: {
            message: 'Cannot modify completed or cancelled orders',
          },
        });
      }
      
      const updatedOrder = await orderRepository.update(orderId, updateData);
      
      logger.info(`Order updated: ${orderId} by user ${req.auth?.sub}`);
      res.json(updatedOrder);
    } catch (error) {
      logger.error(`Error updating order with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Actualizar estado de orden (principalmente para admin)
router.patch(
  '/:id/status',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Order ID is required'),
  validateStatusUpdate,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.id;
      const { status } = req.body;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar si la orden existe
      const existingOrder = await orderRepository.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          error: {
            message: 'Order not found',
          },
        });
      }
      
      // Los clientes solo pueden cancelar sus propias órdenes
      if (!userRole.includes('restaurant-admin')) {
        if (existingOrder.userId !== currentUserId) {
          return res.status(403).json({
            error: {
              message: 'Cannot modify other user\'s order',
            },
          });
        }
        
        // Los clientes solo pueden cancelar y solo si está en estado "pending"
        if (status !== 'cancelled' || existingOrder.status !== 'pending') {
          return res.status(403).json({
            error: {
              message: 'Customers can only cancel pending orders',
            },
          });
        }
      }
      
      // Validar transiciones de estado
      const validTransitions: Record<string, string[]> = {
        pending: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['completed', 'cancelled'],
        completed: [],
        cancelled: []
      };
      
      if (!validTransitions[existingOrder.status].includes(status)) {
        return res.status(400).json({
          error: {
            message: `Invalid status transition from ${existingOrder.status} to ${status}`,
            validTransitions: validTransitions[existingOrder.status],
          },
        });
      }
      
      const updatedOrder = await orderRepository.updateStatus(orderId, status);
      
      logger.info(`Order status updated: ${orderId} to ${status} by user ${req.auth?.sub}`);
      res.json(updatedOrder);
    } catch (error) {
      logger.error(`Error updating order status with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Actualizar tiempo de recogida (solo admin)
router.patch(
  '/:id/pickup-time',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('id').notEmpty().withMessage('Order ID is required'),
  body('pickupTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Pickup time must be in HH:MM format'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.id;
      const { pickupTime } = req.body;
      
      // Verificar si la orden existe
      const existingOrder = await orderRepository.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          error: {
            message: 'Order not found',
          },
        });
      }
      
      const updatedOrder = await orderRepository.updatePickupTime(orderId, pickupTime);
      
      logger.info(`Order pickup time updated: ${orderId} to ${pickupTime} by user ${req.auth?.sub}`);
      res.json(updatedOrder);
    } catch (error) {
      logger.error(`Error updating order pickup time with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Eliminar orden (solo admin o usuario propietario si está en estado "pending")
router.delete(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('Order ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.id;
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      const currentUserId = req.auth?.sub?.replace('auth0|', '');
      
      // Verificar si la orden existe
      const existingOrder = await orderRepository.findById(orderId);
      if (!existingOrder) {
        return res.status(404).json({
          error: {
            message: 'Order not found',
          },
        });
      }
      
      // Verificar permisos
      if (!userRole.includes('restaurant-admin') && existingOrder.userId !== currentUserId) {
        return res.status(403).json({
          error: {
            message: 'Cannot delete other user\'s order',
          },
        });
      }
      
      // Los clientes solo pueden eliminar órdenes en estado "pending"
      if (!userRole.includes('restaurant-admin') && existingOrder.status !== 'pending') {
        return res.status(403).json({
          error: {
            message: 'Can only delete pending orders',
          },
        });
      }
      
      const deleted = await orderRepository.delete(orderId);
      if (!deleted) {
        return res.status(500).json({
          error: {
            message: 'Failed to delete order',
          },
        });
      }
      
      logger.info(`Order deleted: ${orderId} by user ${req.auth?.sub}`);
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting order with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

export default router;