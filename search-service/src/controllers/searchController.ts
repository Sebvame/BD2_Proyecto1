import express, { Request, Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { searchProducts, searchProductsByCategory, reindexAllProducts } from '../services/elasticsearch';
import { cacheMiddleware, clearCache } from '../services/cache';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Buscar productos por texto
router.get(
  '/products',
  query('q').isString().notEmpty().withMessage('Search query is required'),
  checkValidation,
  cacheMiddleware(60 * 5), // Cache por 5 minutos
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchQuery = req.query.q as string;
      logger.info(`Searching products with query: ${searchQuery}`);
      
      const results = await searchProducts(searchQuery);
      
      res.json({
        query: searchQuery,
        count: results.length,
        results
      });
    } catch (error) {
      logger.error('Error searching products:', error);
      next(error);
    }
  }
);

// Buscar productos por categoría
router.get(
  '/products/category/:category',
  param('category').isString().notEmpty().withMessage('Category is required'),
  checkValidation,
  cacheMiddleware(60 * 10), // Cache por 10 minutos
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.params.category;
      logger.info(`Searching products by category: ${category}`);
      
      const results = await searchProductsByCategory(category);
      
      res.json({
        category,
        count: results.length,
        results
      });
    } catch (error) {
      logger.error(`Error searching products by category ${req.params.category}:`, error);
      next(error);
    }
  }
);

// Reindexar todos los productos
router.post(
  '/reindex',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Reindexing all products...');
      
      const result = await reindexAllProducts();
      
      // Limpiar caché
      clearCache();
      
      res.json({
        message: 'Reindexing completed successfully',
        ...result
      });
    } catch (error) {
      logger.error('Error reindexing products:', error);
      next(error);
    }
  }
);

export default router;