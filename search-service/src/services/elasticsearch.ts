import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

// Cliente de ElasticSearch
let client: Client;

// Índices
const PRODUCT_INDEX = 'products';

// Inicializar ElasticSearch
export const initializeElasticsearch = async () => {
  try {
    logger.info('Initializing ElasticSearch client...');
    
    client = new Client({
      node: config.ELASTICSEARCH_URI,
    });
    
    // Verificar conexión
    const health = await client.cluster.health();
    logger.info(`ElasticSearch cluster status: ${health.status}`);
    
    // Verificar si los índices existen, crearlos si no
    await createIndicesIfNotExist();
    
    return client;
  } catch (error) {
    logger.error('Failed to initialize ElasticSearch:', error);
    throw error;
  }
};

// Crear índices si no existen
const createIndicesIfNotExist = async () => {
  try {
    const indicesExist = await client.indices.exists({ index: PRODUCT_INDEX });
    
    if (!indicesExist) {
      logger.info(`Creating ${PRODUCT_INDEX} index...`);
      
      await client.indices.create({
        index: PRODUCT_INDEX,
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
      
      logger.info(`${PRODUCT_INDEX} index created`);
    }
  } catch (error) {
    logger.error('Error creating indices:', error);
    throw error;
  }
};

// Indexar un producto
export const indexProduct = async (product: any) => {
  try {
    await client.index({
      index: PRODUCT_INDEX,
      id: product.id,
      body: {
        ...product,
        description: product.description || 'Producto sin descripción'
      }
    });
    
    logger.info(`Indexed product ${product.id}`);
    return true;
  } catch (error) {
    logger.error(`Error indexing product ${product.id}:`, error);
    throw error;
  }
};

// Reindexar todos los productos
export const reindexAllProducts = async () => {
  try {
    logger.info('Starting reindexing of all products...');
    
    // Obtener productos de la API principal
    const response = await fetch(`${config.API_URI}/api/menu-items`);
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const products = await response.json();
    
    // Eliminar índice actual
    const indexExists = await client.indices.exists({ index: PRODUCT_INDEX });
    
    if (indexExists) {
      await client.indices.delete({ index: PRODUCT_INDEX });
    }
    
    // Recrear índice
    await createIndicesIfNotExist();
    
    // Indexar todos los productos
    const operations = products.flatMap((product: any) => [
      { index: { _index: PRODUCT_INDEX, _id: product.id } },
      {
        ...product,
        description: product.description || 'Producto sin descripción'
      }
    ]);
    
    if (operations.length > 0) {
      const bulkResponse = await client.bulk({ refresh: true, body: operations });
      
      if (bulkResponse.errors) {
        const erroredDocuments: any[] = [];
        
        bulkResponse.items.forEach((action: any, i: number) => {
          const operation = Object.keys(action)[0];
          
          if (action[operation].error) {
            erroredDocuments.push({
              status: action[operation].status,
              error: action[operation].error,
              operation: operations[i * 2],
              document: operations[i * 2 + 1]
            });
          }
        });
        
        logger.error(`Bulk indexing encountered errors: ${JSON.stringify(erroredDocuments)}`);
      }
      
      logger.info(`Reindexed ${products.length} products`);
    } else {
      logger.info('No products to reindex');
    }
    
    return {
      success: true,
      indexed: products.length
    };
  } catch (error) {
    logger.error('Error reindexing products:', error);
    throw error;
  }
};

// Buscar productos por texto
export const searchProducts = async (query: string) => {
  try {
    const result = await client.search({
      index: PRODUCT_INDEX,
      body: {
        query: {
          multi_match: {
            query,
            fields: ['name^3', 'description', 'category^2'],
            fuzziness: 'AUTO'
          }
        }
      }
    });
    
    return result.hits.hits.map((hit: any) => ({
      ...hit._source,
      score: hit._score
    }));
  } catch (error) {
    logger.error(`Error searching products with query "${query}":`, error);
    throw error;
  }
};

// Buscar productos por categoría
export const searchProductsByCategory = async (category: string) => {
  try {
    const result = await client.search({
      index: PRODUCT_INDEX,
      body: {
        query: {
          term: {
            category: category
          }
        }
      }
    });
    
    return result.hits.hits.map((hit: any) => hit._source);
  } catch (error) {
    logger.error(`Error searching products by category "${category}":`, error);
    throw error;
  }
};

// Obtener cliente de ElasticSearch (para pruebas)
export const getElasticsearchClient = () => client;