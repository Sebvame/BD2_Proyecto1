import express, { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { checkJwt, checkRole, handleAuthError } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const restaurantRepository = RepositoryFactory.getRestaurantRepository();

// Middleware de validación
const validateRestaurant = [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('description').notEmpty().trim().withMessage('Description is required'),
  body('address').notEmpty().trim().withMessage('Address is required'),
  body('phone').notEmpty().trim().withMessage('Phone is required'),
  body('imageUrl').isURL().withMessage('Valid image URL is required'),
  body('cuisine').notEmpty().trim().withMessage('Cuisine is required'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  body('priceRange').isIn([1, 2, 3]).withMessage('Price range must be 1, 2, or 3'),
  body('openingHours.opens').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Opening hours must be in HH:MM format'),
  body('openingHours.closes').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Closing hours must be in HH:MM format'),
];

const validatePartialRestaurant = [
  body('name').optional().notEmpty().trim().withMessage('Name cannot be empty'),
  body('description').optional().notEmpty().trim().withMessage('Description cannot be empty'),
  body('address').optional().notEmpty().trim().withMessage('Address cannot be empty'),
  body('phone').optional().notEmpty().trim().withMessage('Phone cannot be empty'),
  body('imageUrl').optional().isURL().withMessage('Valid image URL is required'),
  body('cuisine').optional().notEmpty().trim().withMessage('Cuisine cannot be empty'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
  body('priceRange').optional().isIn([1, 2, 3]).withMessage('Price range must be 1, 2, or 3'),
  body('openingHours.opens').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Opening hours must be in HH:MM format'),
  body('openingHours.closes').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Closing hours must be in HH:MM format'),
];

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Obtener todos los restaurantes
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurants = await restaurantRepository.findAll();
      res.json(restaurants);
    } catch (error) {
      logger.error('Error fetching all restaurants:', error);
      next(error);
    }
  }
);

// Buscar restaurantes por query text
router.get(
  '/search',
  query('q').optional().isString().notEmpty().withMessage('Search query must be a non-empty string'),
  query('cuisine').optional().isString().notEmpty().withMessage('Cuisine filter must be a non-empty string'),
  query('priceRange').optional().isIn(['1', '2', '3']).withMessage('Price range must be 1, 2, or 3'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q, cuisine, priceRange } = req.query;
      let restaurants;

      if (q) {
        restaurants = await restaurantRepository.searchRestaurants(q as string);
      } else if (cuisine) {
        restaurants = await restaurantRepository.findByCuisine(cuisine as string);
      } else if (priceRange) {
        restaurants = await restaurantRepository.findByPriceRange(parseInt(priceRange as string) as 1 | 2 | 3);
      } else {
        restaurants = await restaurantRepository.findAll();
      }

      res.json({
        query: q || '',
        filters: { cuisine, priceRange },
        count: restaurants.length,
        results: restaurants
      });
    } catch (error) {
      logger.error('Error searching restaurants:', error);
      next(error);
    }
  }
);

// Obtener restaurantes por tipo de cocina
router.get(
  '/cuisine/:cuisine',
  param('cuisine').notEmpty().withMessage('Cuisine parameter is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cuisine } = req.params;
      const restaurants = await restaurantRepository.findByCuisine(cuisine);
      
      res.json({
        cuisine,
        count: restaurants.length,
        results: restaurants
      });
    } catch (error) {
      logger.error(`Error fetching restaurants by cuisine ${req.params.cuisine}:`, error);
      next(error);
    }
  }
);

// Obtener restaurantes por rango de precios
router.get(
  '/price-range/:range',
  param('range').isIn(['1', '2', '3']).withMessage('Price range must be 1, 2, or 3'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const priceRange = parseInt(req.params.range) as 1 | 2 | 3;
      const restaurants = await restaurantRepository.findByPriceRange(priceRange);
      
      res.json({
        priceRange,
        count: restaurants.length,
        results: restaurants
      });
    } catch (error) {
      logger.error(`Error fetching restaurants by price range ${req.params.range}:`, error);
      next(error);
    }
  }
);

// Obtener restaurante por ID
router.get(
  '/:id',
  param('id').notEmpty().withMessage('Restaurant ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurant = await restaurantRepository.findById(req.params.id);
      
      if (!restaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      res.json(restaurant);
    } catch (error) {
      logger.error(`Error fetching restaurant with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Crear restaurante (solo admin)
router.post(
  '/',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  validateRestaurant,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantData = req.body;
      
      const newRestaurant = await restaurantRepository.create(restaurantData);
      
      logger.info(`Restaurant created: ${newRestaurant.id} by user ${req.auth?.sub}`);
      res.status(201).json(newRestaurant);
    } catch (error) {
      logger.error('Error creating restaurant:', error);
      next(error);
    }
  }
);

// Actualizar restaurante (solo admin)
router.put(
  '/:id',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('id').notEmpty().withMessage('Restaurant ID is required'),
  validatePartialRestaurant,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.params.id;
      const updateData = req.body;
      
      // Verificar si el restaurante existe
      const existingRestaurant = await restaurantRepository.findById(restaurantId);
      if (!existingRestaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      const updatedRestaurant = await restaurantRepository.update(restaurantId, updateData);
      
      logger.info(`Restaurant updated: ${restaurantId} by user ${req.auth?.sub}`);
      res.json(updatedRestaurant);
    } catch (error) {
      logger.error(`Error updating restaurant with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Eliminar restaurante (solo admin)
router.delete(
  '/:id',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  param('id').notEmpty().withMessage('Restaurant ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.params.id;
      
      // Verificar si el restaurante existe
      const existingRestaurant = await restaurantRepository.findById(restaurantId);
      if (!existingRestaurant) {
        return res.status(404).json({
          error: {
            message: 'Restaurant not found',
          },
        });
      }
      
      const deleted = await restaurantRepository.delete(restaurantId);
      if (!deleted) {
        return res.status(500).json({
          error: {
            message: 'Failed to delete restaurant',
          },
        });
      }
      
      logger.info(`Restaurant deleted: ${restaurantId} by user ${req.auth?.sub}`);
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting restaurant with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

export default router;