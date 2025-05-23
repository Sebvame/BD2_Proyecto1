import express, { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { checkJwt, checkRole, handleAuthError } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();
const userRepository = RepositoryFactory.getUserRepository();

// Middleware de validación
const validateUser = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('role').isIn(['customer', 'restaurant-admin']).withMessage('Role must be either customer or restaurant-admin'),
];

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Obtener todos los usuarios (solo admin)
router.get(
  '/',
  checkJwt,
  checkRole('restaurant-admin'),
  handleAuthError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await userRepository.findAll();
      res.json(users);
    } catch (error) {
      logger.error('Error fetching all users:', error);
      next(error);
    }
  }
);

// Obtener usuario por ID
router.get(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('User ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;
      
      // Verificar que el usuario solo pueda acceder a su propia información
      // a menos que sea admin
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      if (!userRole.includes('restaurant-admin') && req.auth?.sub !== `auth0|${userId}`) {
        return res.status(403).json({
          error: {
            message: 'Cannot access other user information',
          },
        });
      }
      
      const user = await userRepository.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: {
            message: 'User not found',
          },
        });
      }
      
      res.json(user);
    } catch (error) {
      logger.error(`Error fetching user with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Crear usuario
router.post(
  '/',
  validateUser,
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, role } = req.body;
      
      // Verificar si el usuario ya existe
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: {
            message: 'User with this email already exists',
          },
        });
      }
      
      const newUser = await userRepository.create({
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      });
      
      res.status(201).json(newUser);
    } catch (error) {
      logger.error('Error creating user:', error);
      next(error);
    }
  }
);

// Actualizar usuario
router.put(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('User ID is required'),
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['customer', 'restaurant-admin']).withMessage('Role must be either customer or restaurant-admin'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;
      
      // Verificar que el usuario solo pueda actualizar su propia información
      // a menos que sea admin
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      if (!userRole.includes('restaurant-admin') && req.auth?.sub !== `auth0|${userId}`) {
        return res.status(403).json({
          error: {
            message: 'Cannot update other user information',
          },
        });
      }
      
      const { name, email, role } = req.body;
      
      // Verificar si el usuario existe
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        return res.status(404).json({
          error: {
            message: 'User not found',
          },
        });
      }
      
      // Si se está actualizando el email, verificar que no esté en uso
      if (email && email !== existingUser.email) {
        const userWithEmail = await userRepository.findByEmail(email);
        if (userWithEmail) {
          return res.status(409).json({
            error: {
              message: 'Email is already in use',
            },
          });
        }
      }
      
      const updatedUser = await userRepository.update(userId, {
        name,
        email,
        role,
      });
      
      res.json(updatedUser);
    } catch (error) {
      logger.error(`Error updating user with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Eliminar usuario
router.delete(
  '/:id',
  checkJwt,
  handleAuthError,
  param('id').notEmpty().withMessage('User ID is required'),
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.id;
      
      // Verificar que el usuario solo pueda eliminar su propia cuenta
      // a menos que sea admin
      const userRole = req.auth?.['https://restaurant-api.com/roles'] || [];
      if (!userRole.includes('restaurant-admin') && req.auth?.sub !== `auth0|${userId}`) {
        return res.status(403).json({
          error: {
            message: 'Cannot delete other user',
          },
        });
      }
      
      // Verificar si el usuario existe
      const existingUser = await userRepository.findById(userId);
      if (!existingUser) {
        return res.status(404).json({
          error: {
            message: 'User not found',
          },
        });
      }
      
      const deleted = await userRepository.delete(userId);
      if (!deleted) {
        return res.status(500).json({
          error: {
            message: 'Failed to delete user',
          },
        });
      }
      
      res.status(204).send();
    } catch (error) {
      logger.error(`Error deleting user with ID ${req.params.id}:`, error);
      next(error);
    }
  }
);

export default router;