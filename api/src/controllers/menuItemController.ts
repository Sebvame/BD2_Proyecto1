import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { checkJwt, checkRole, handleAuthError } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const menuItemRepository = RepositoryFactory.getMenuItemRepository();
const restaurantRepository = RepositoryFactory.getRestaurantRepository();

// Middleware de validación
const validateMenuItem = [
  body('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('description').optional().trim(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('imageUrl').isURL().withMessage('Valid image URL is required'),
  body('category').notEmpty().trim().withMessage('Category is required'),
  body('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  body('available').optional().isBoolean().withMessage('Available must be a boolean'),
];

const validatePartialMenuItem = [
  body('restaurantId').optional().notEmpty().withMessage('Restaurant ID cannot be empty'),
  body('name').optional().notEmpty().trim().withMessage('Name cannot be empty'),
  body('description').optional().trim(),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('imageUrl').optional().isURL().withMessage('Valid image URL is required'),
  body('category').optional().notEmpty().trim().withMessage('Category cannot be empty'),
  body('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  body('available').optional().isBoolean().withMessage('Available must be a boolean'),
];

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware para verificar que el restaurante existe
const checkRestaurantExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.body.restaurantId || req.params.restaurantId || req.query.restaurantId;
    
    if (restaurantId) {
      const restaurant = await restaurantRepository.findById(restaurantId as string);
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
    }
    
    next();
  } catch (error) {
    logger.error('Error checking restaurant existence:', error);
    next(error);
  }
};

// Obtener todos los items del menú
router.get(
  '/',
  query('restaurantId').optional().notEmpty().withMessage('Restaurant ID cannot be empty'),
  query('category').optional().notEmpty().withMessage('Category cannot be empty'),
  query('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  query('available').optional().isBoolean().withMessage('Available must be a boolean'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId, category, featured, available } = req.query;
      let menuItems;

      if (restaurantId && category) {
        menuItems = await menuItemRepository.findByRestaurantAndCategory(
          restaurantId as string, 
          category as string
        );
      } else if (restaurantId) {
        if (available === 'true') {
          menuItems = await menuItemRepository.findAvailableByRestaurant(restaurantId as string);
        } else {
          menuItems = await menuItemRepository.findByRestaurantId(restaurantId as string);
        }
      } else if (category) {
        menuItems = await menuItemRepository.findByCategory(category as string);
      } else if (featured === 'true') {
        menuItems = await menuItemRepository.findFeaturedItems();
      } else {
        menuItems = await menuItemRepository.findAll();
      }

      res.json({
        filters: { restaurantId, category, featured, available },
        count: menuItems.length,
        results: menuItems
      });
    } catch (error) {
      logger.error('Error fetching menu items:', error);
      next(error);
    }
  }
);

// Obtener items destacados
router.get(
  '/featured',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const featuredItems = await menuItemRepository.findFeaturedItems();
      
      res.json({
        count: featuredItems.length,
        results: featuredItems
      });
    } catch (error) {
      logger.error('Error fetching featured menu items:', error);
      next(error);
    }
  }
);

// Obtener items por restaurante
router.get(
  '/restaurant/:restaurantId',
  param('restaurantId').notEmpty().withMessage('Restaurant ID is required'),
  query('category').optional().notEmpty().withMessage('Category cannot be empty'),
  query('available').optional().isBoolean().withMessage('Available must be a boolean'),
  checkValidation,
  checkRestaurantExists,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { restaurantId } = req.params;
      const { category, available } = req.query;
      let menuItems;

      if (category) {
        menuItems = await menuItemRepository.findByRestaurantAndCategory(
          restaurantId, 
          category as string
        );
      } else if (available === 'true') {
        menuItems = await menuItemRepository.findAvailableByRestaurant(restaurantId);
      } else {
        menuItems = await menuItemRepository.findByRestaurantId(restaurantId);
      }

      res.json({
        restaurantId,
        filters: { category, available },
        count: menuItems.length,
        results: menuItems
      });
    } catch (error) {
      logger.error(`Error fetching menu items for restaurant ${req.params.restaurantId}:`, error);
      next(error);
    }
  }
);

// Obtener items por categoría
router.get(
  '/category/:category',
  param('category').notEmpty().withMessage('Category is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category } = req.params;
      const menuItems = await menuItemRepository.findByCategory(category);
      
      res.json({
        category,
        count: menuItems.length,
        results: menuItems
      });
    } catch (error) {
      logger.error(`Error fetching menu items by category ${req.params.category}:`, error);
      next(error);
    }
  }
);

// Obtener item por ID
router.get(
  '/:id',
  param('id').notEmpty().withMessage('Menu item ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItem = await menuItemRepository.findById(req.params.id);
      
      if (!menuItem) {
        return res.status(404).json({
          error: {
            message: 'Menu item not found',
          },
        });
      }
      
      res.json(menuItem);
    } catch (error) {
      logger.error(`Error fetching menu item with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Crear item del menú (solo admin)
router.post(
  '/',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  validateMenuItem,
  checkValidation,
  checkRestaurantExists,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItemData = {
        ...req.body,
        description: req.body.description || 'Producto sin descripción'
      };
      
      const newMenuItem = await menuItemRepository.create(menuItemData);
      
      logger.info(`Menu item created: ${newMenuItem.id} by user ${req.auth?.sub}`);
      res.status(201).json(newMenuItem);
    } catch (error) {
      logger.error('Error creating menu item:', error);
      next(error);
    }
  }
);

// Actualizar item del menú (solo admin)
router.put(
  '/:id',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('id').notEmpty().withMessage('Menu item ID is required'),
  validatePartialMenuItem,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItemId = req.params.id;
      const updateData = req.body;
      
      // Verificar si el item existe
      const existingMenuItem = await menuItemRepository.findById(menuItemId);
      if (!existingMenuItem) {
        return res.status(404).json({
          error: {
            message: 'Menu item not found',
          },
        });
      }
      
      // Si se está actualizando el restaurantId, verificar que existe
      if (updateData.restaurantId && updateData.restaurantId !== existingMenuItem.restaurantId) {
        const restaurant = await restaurantRepository.findById(updateData.restaurantId);
        if (!restaurant) {
          return res.status(404).json({
            error: {
              message: 'Restaurant not found',
            },
          });
        }
      }
      
      const updatedMenuItem = await menuItemRepository.update(menuItemId, updateData);
      
      logger.info(`Menu item updated: ${menuItemId} by user ${req.auth?.sub}`);
      res.json(updatedMenuItem);
    } catch (error) {
      logger.error(`Error updating menu item with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Actualizar disponibilidad de item (solo admin)
router.patch(
  '/:id/availability',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('id').notEmpty().withMessage('Menu item ID is required'),
  body('available').isBoolean().withMessage('Available must be a boolean'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItemId = req.params.id;
      const { available } = req.body;
      
      // Verificar si el item existe
      const existingMenuItem = await menuItemRepository.findById(menuItemId);
      if (!existingMenuItem) {
        return res.status(404).json({
          error: {
            message: 'Menu item not found',
          },
        });
      }
      
      const updatedMenuItem = await menuItemRepository.updateAvailability(menuItemId, available);
      
      logger.info(`Menu item availability updated: ${menuItemId} to ${available} by user ${req.auth?.sub}`);
      res.json(updatedMenuItem);
    } catch (error) {
      logger.error(`Error updating menu item availability with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Eliminar item del menú (solo admin)
router.delete(
  '/:id',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('id').notEmpty().withMessage('Menu item ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const menuItemId = req.params.id;
      
      // Verificar si el item existe
      const existingMenuItem = await menuItemRepository.findById(menuItemId);
      if (!existingMenuItem) {
        return res.status(404).json({
          error: {
            message: 'Menu item not found',
          },
        });
      }
      
      const deleted = await menuItemRepository.delete(menuItemId);
      if (!deleted) {
        return res.status(500).json({
          error: {
            message: 'Failed to delete menu item',
          },
        });
      }
      
      logger.info(`Menu item deleted: ${menuItemId} by user ${req.auth?.sub}`);
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting menu item with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

export default router;