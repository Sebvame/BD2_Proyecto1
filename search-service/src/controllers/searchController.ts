import express, { Request, Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { 
  searchProducts, 
  searchRestaurants, 
  getSuggestions,
  reindexAllData,
  indexProduct,
  indexRestaurant,
  deleteProduct,
  deleteRestaurant,
  checkHealth
} from '../services/elasticsearch';
import { cacheMiddleware, clearCache, clearCacheByPattern } from '../services/cache';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = express.Router();

// Interfaces para request/response types
interface SearchFilters {
  restaurantId?: string;
  category?: string;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  cuisine?: string;
  priceRange?: number;
  minRating?: number;
}

interface PaginationParams {
  from?: number;
  size?: number;
}

// Middleware para verificar errores de validación
const checkValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array()
      },
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Middleware para parsear parámetros de paginación
const parsePagination = (req: Request, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const size = Math.min(
    parseInt(req.query.size as string) || config.DEFAULT_RESULTS_PER_PAGE,
    config.MAX_RESULTS_PER_PAGE
  );
  
  req.pagination = {
    from: (page - 1) * size,
    size: size
  };
  
  next();
};

// Extender Request interface
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}

// Health check específico para el servicio de búsqueda
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await checkHealth();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'Search Service',
        timestamp: new Date().toISOString(),
        elasticsearch: health
      }
    });
  } catch (error) {
    logger.error('Search service health check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        message: 'Service unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Buscar productos por texto
router.get(
  '/products',
  [
    query('q').optional().isString().withMessage('Search query must be a string'),
    query('restaurantId').optional().isString().withMessage('Restaurant ID must be a string'),
    query('category').optional().isString().withMessage('Category must be a string'),
    query('available').optional().isBoolean().withMessage('Available must be a boolean'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('size').optional().isInt({ min: 1, max: config.MAX_RESULTS_PER_PAGE }).withMessage(`Size must be between 1 and ${config.MAX_RESULTS_PER_PAGE}`)
  ],
  checkValidation,
  parsePagination,
  cacheMiddleware(config.CACHE_TTL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchQuery = (req.query.q as string) || '';
      const filters: SearchFilters = {
        restaurantId: req.query.restaurantId as string,
        category: req.query.category as string,
        available: req.query.available === 'true' ? true : req.query.available === 'false' ? false : undefined,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined
      };
      
      // Remover filtros undefined
      Object.keys(filters).forEach(key => 
        filters[key as keyof SearchFilters] === undefined && delete filters[key as keyof SearchFilters]
      );

      logger.info(`Searching products with query: "${searchQuery}"`, { filters, pagination: req.pagination });
      
      const results = await searchProducts(searchQuery, filters, req.pagination);
      
      const page = Math.floor((req.pagination?.from || 0) / (req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE)) + 1;
      const totalPages = Math.ceil(results.total / (req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE));
      
      res.json({
        success: true,
        data: {
          query: searchQuery,
          filters,
          results: results.hits,
          pagination: {
            page,
            size: req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE,
            total: results.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error searching products:', error);
      next(error);
    }
  }
);

// Buscar restaurantes
router.get(
  '/restaurants',
  [
    query('q').optional().isString().withMessage('Search query must be a string'),
    query('cuisine').optional().isString().withMessage('Cuisine must be a string'),
    query('priceRange').optional().isInt({ min: 1, max: 3 }).withMessage('Price range must be 1, 2, or 3'),
    query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Min rating must be between 0 and 5'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('size').optional().isInt({ min: 1, max: config.MAX_RESULTS_PER_PAGE }).withMessage(`Size must be between 1 and ${config.MAX_RESULTS_PER_PAGE}`)
  ],
  checkValidation,
  parsePagination,
  cacheMiddleware(config.CACHE_TTL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchQuery = (req.query.q as string) || '';
      const filters: SearchFilters = {
        cuisine: req.query.cuisine as string,
        priceRange: req.query.priceRange ? parseInt(req.query.priceRange as string) : undefined,
        minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined
      };
      
      // Remover filtros undefined
      Object.keys(filters).forEach(key => 
        filters[key as keyof SearchFilters] === undefined && delete filters[key as keyof SearchFilters]
      );

      logger.info(`Searching restaurants with query: "${searchQuery}"`, { filters, pagination: req.pagination });
      
      const results = await searchRestaurants(searchQuery, filters, req.pagination);
      
      const page = Math.floor((req.pagination?.from || 0) / (req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE)) + 1;
      const totalPages = Math.ceil(results.total / (req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE));
      
      res.json({
        success: true,
        data: {
          query: searchQuery,
          filters,
          results: results.hits,
          pagination: {
            page,
            size: req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE,
            total: results.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error searching restaurants:', error);
      next(error);
    }
  }
);

// Autocompletado y sugerencias
router.get(
  '/suggestions',
  [
    query('q').isString().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
    query('type').optional().isIn(['products', 'restaurants']).withMessage('Type must be "products" or "restaurants"')
  ],
  checkValidation,
  cacheMiddleware(config.CACHE_TTL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const searchQuery = req.query.q as string;
      const type = (req.query.type as 'products' | 'restaurants') || 'products';
      
      logger.info(`Getting suggestions for query: "${searchQuery}", type: ${type}`);
      
      const suggestions = await getSuggestions(searchQuery, type);
      
      res.json({
        success: true,
        data: {
          query: searchQuery,
          type,
          suggestions
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      next(error);
    }
  }
);

// Buscar productos por categoría (endpoint específico para compatibilidad)
router.get(
  '/products/category/:category',
  [
    param('category').isString().notEmpty().withMessage('Category is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('size').optional().isInt({ min: 1, max: config.MAX_RESULTS_PER_PAGE }).withMessage(`Size must be between 1 and ${config.MAX_RESULTS_PER_PAGE}`)
  ],
  checkValidation,
  parsePagination,
  cacheMiddleware(config.CACHE_TTL * 2), // Cache más largo para categorías
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = req.params.category;
      
      logger.info(`Searching products by category: ${category}`);
      
      const results = await searchProducts('', { category }, req.pagination);
      
      const page = Math.floor((req.pagination?.from || 0) / (req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE)) + 1;
      const totalPages = Math.ceil(results.total / (req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE));
      
      res.json({
        success: true,
        data: {
          category,
          results: results.hits,
          pagination: {
            page,
            size: req.pagination?.size || config.DEFAULT_RESULTS_PER_PAGE,
            total: results.total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error searching products by category ${req.params.category}:`, error);
      next(error);
    }
  }
);

// Indexar producto individual
router.post(
  '/index/product',
  [
    express.json(),
    // Validaciones básicas para el producto
    // En un entorno real, esto debería venir de un webhook o queue
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productData = req.body;
      
      logger.info(`Indexing product: ${productData.id}`);
      
      const success = await indexProduct(productData);
      
      if (success) {
        // Limpiar cache relacionado
        await clearCacheByPattern(`products`);
        
        res.status(201).json({
          success: true,
          data: {
            message: 'Product indexed successfully',
            productId: productData.id
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to index product'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error indexing product:', error);
      next(error);
    }
  }
);

// Indexar restaurante individual
router.post(
  '/index/restaurant',
  [
    express.json(),
    // Validaciones básicas para el restaurante
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantData = req.body;
      
      logger.info(`Indexing restaurant: ${restaurantData.id}`);
      
      const success = await indexRestaurant(restaurantData);
      
      if (success) {
        // Limpiar cache relacionado
        await clearCacheByPattern(`restaurants`);
        
        res.status(201).json({
          success: true,
          data: {
            message: 'Restaurant indexed successfully',
            restaurantId: restaurantData.id
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            message: 'Failed to index restaurant'
          },
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error indexing restaurant:', error);
      next(error);
    }
  }
);

// Reindexar todos los productos y restaurantes
router.post(
  '/reindex',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Starting full reindex...');
      
      const result = await reindexAllData();
      
      // Limpiar toda la caché después del reindex
      await clearCache();
      
      res.json({
        success: true,
        data: {
          message: 'Reindexing completed successfully',
          ...result
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error reindexing:', error);
      next(error);
    }
  }
);

// Eliminar producto del índice
router.delete(
  '/index/product/:id',
  [
    param('id').isString().notEmpty().withMessage('Product ID is required')
  ],
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id;
      
      logger.info(`Deleting product from index: ${productId}`);
      
      await deleteProduct(productId);
      
      // Limpiar cache relacionado
      await clearCacheByPattern(`products`);
      
      res.json({
        success: true,
        data: {
          message: 'Product removed from index successfully',
          productId
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error deleting product ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Eliminar restaurante del índice
router.delete(
  '/index/restaurant/:id',
  [
    param('id').isString().notEmpty().withMessage('Restaurant ID is required')
  ],
  checkValidation,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const restaurantId = req.params.id;
      
      logger.info(`Deleting restaurant from index: ${restaurantId}`);
      
      await deleteRestaurant(restaurantId);
      
      // Limpiar cache relacionado
      await clearCacheByPattern(`restaurants`);
      
      res.json({
        success: true,
        data: {
          message: 'Restaurant removed from index successfully',
          restaurantId
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error deleting restaurant ${req.params.id}:`, error);
      next(error);
    }
  }
);

// Limpiar caché manualmente
router.post(
  '/cache/clear',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pattern = req.body.pattern;
      
      if (pattern) {
        await clearCacheByPattern(pattern);
        logger.info(`Cache cleared for pattern: ${pattern}`);
      } else {
        await clearCache();
        logger.info('All cache cleared');
      }
      
      res.json({
        success: true,
        data: {
          message: pattern ? `Cache cleared for pattern: ${pattern}` : 'All cache cleared'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error clearing cache:', error);
      next(error);
    }
  }
);

// Middleware de manejo de errores específico para el search service
router.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Search service error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Determinar el código de estado basado en el tipo de error
  let statusCode = 500;
  let errorCode = 'SEARCH_ERROR';

  if (error.message.includes('ElasticSearch client not initialized')) {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
  } else if (error.message.includes('validation failed')) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error.message.includes('not found')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: config.NODE_ENV === 'production' ? 'Search service error' : error.message
    },
    timestamp: new Date().toISOString()
  });
});

export default router;