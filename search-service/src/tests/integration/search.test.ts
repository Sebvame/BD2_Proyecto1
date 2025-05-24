import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { initializeElasticsearch, getElasticsearchClient, reindexAllProducts } from '../../services/elasticsearch';
import { initializeRedis, clearCache, closeRedis } from '../../services/cache';

describe('Search Service Integration Tests', () => {
  // Datos de prueba
  const testProducts = [
    {
      id: '1',
      restaurantId: '100',
      name: 'Burger Deluxe',
      description: 'Una deliciosa hamburguesa con queso y tocino',
      price: 10.99,
      imageUrl: 'https://example.com/burger.jpg',
      category: 'Hamburguesas',
      featured: true,
      available: true
    },
    {
      id: '2',
      restaurantId: '100',
      name: 'Pizza Margarita',
      description: 'Pizza clásica con tomate, mozzarella y albahaca',
      price: 12.99,
      imageUrl: 'https://example.com/pizza.jpg',
      category: 'Pizzas',
      featured: false,
      available: true
    },
    {
      id: '3',
      restaurantId: '101',
      name: 'Taco de Pollo',
      description: 'Tacos con pollo, cebolla y cilantro',
      price: 8.99,
      imageUrl: 'https://example.com/taco.jpg',
      category: 'Tacos',
      featured: true,
      available: true
    }
  ];
  
  beforeAll(async () => {
    // Inicializar ElasticSearch y Redis
    await initializeElasticsearch();
    await initializeRedis();
    
    // Limpiar índices y caché
    await clearCache();
    
    const client = getElasticsearchClient();
    try {
      await client.indices.delete({ index: 'products' });
    } catch (error) {
      // Ignorar error si el índice no existe
    }
    
    // Crear índice de productos
    await client.indices.create({
      index: 'products',
      body: {
        mappings: {
          properties: {
            id: { type: 'keyword' },
            restaurantId: { type: 'keyword' },
            name: { type: 'text', analyzer: 'spanish' },
            description: { type: 'text', analyzer: 'spanish' },
            price: { type: 'float' },
            imageUrl: { type: 'keyword' },
            category: { type: 'keyword' },
            featured: { type: 'boolean' },
            available: { type: 'boolean' }
          }
        }
      }
    });
    
    // Insertar datos de prueba
    const operations = testProducts.flatMap(product => [
      { index: { _index: 'products', _id: product.id } },
      product
    ]);
    
    await client.bulk({ refresh: true, body: operations });
  });
  
  afterAll(async () => {
    // Limpiar recursos
    await clearCache();
    
    const client = getElasticsearchClient();
    try {
      await client.indices.delete({ index: 'products' });
    } catch (error) {
      // Ignorar error si el índice no existe
    }
    
    await closeRedis();
  });
  
  describe('Health Check', () => {
    it('should return status 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
  
  describe('Search Endpoints', () => {
    it('should search products by query', async () => {
      const response = await request(app)
        .get('/search/products?q=hamburguesa');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('query', 'hamburguesa');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.results[0]).toHaveProperty('name', 'Burger Deluxe');
    });
    
    it('should search products by category', async () => {
      const response = await request(app)
        .get('/search/products/category/Pizzas');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('category', 'Pizzas');
      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBe(1);
      expect(response.body.results[0]).toHaveProperty('name', 'Pizza Margarita');
    });
    
    it('should reindex all products', async () => {
      // Mock la función reindexAllProducts
      vi.mock('../../services/elasticsearch', async (importActual) => {
        const actual = await importActual();
        return {
          ...(actual as object),
          reindexAllProducts: vi.fn().mockResolvedValue({
            success: true,
            indexed: 3
          })
        };
      });
      
      const response = await request(app)
        .post('/search/reindex');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Reindexing completed successfully');
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('indexed', 3);
    });
    
    it('should return 400 for missing query param', async () => {
      const response = await request(app)
        .get('/search/products');
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });
});