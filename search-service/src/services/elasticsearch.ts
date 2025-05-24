import { Client } from '@elastic/elasticsearch';
import { config } from '../config';
import { logger } from '../utils/logger';

// Cliente de ElasticSearch
let client: Client;

// Índices
const PRODUCT_INDEX = 'restaurant_menu_items';
const RESTAURANT_INDEX = 'restaurants';

// Interfaces
interface SearchProduct {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  featured: boolean;
  available: boolean;
  restaurant?: {
    name: string;
    cuisine: string;
  };
}

interface SearchRestaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  cuisine: string;
  rating: number;
  priceRange: number;
  imageUrl: string;
}

// Inicializar ElasticSearch
export const initializeElasticsearch = async () => {
  try {
    logger.info('Initializing ElasticSearch client...');
    
    client = new Client({
      node: config.ELASTICSEARCH_URI,
      requestTimeout: 30000,
      pingTimeout: 3000,
    });
    
    // Verificar conexión
    const health = await client.cluster.health();
    logger.info(`ElasticSearch cluster status: ${health.status}`);
    
    // Crear índices si no existen
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
    // Índice de productos
    const productIndexExists = await client.indices.exists({ index: PRODUCT_INDEX });
    
    if (!productIndexExists) {
      logger.info(`Creating ${PRODUCT_INDEX} index...`);
      
      await client.indices.create({
        index: PRODUCT_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                spanish_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'spanish_stop',
                    'spanish_stemmer'
                  ]
                }
              },
              filter: {
                spanish_stop: {
                  type: 'stop',
                  stopwords: '_spanish_'
                },
                spanish_stemmer: {
                  type: 'stemmer',
                  language: 'light_spanish'
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              restaurantId: { type: 'keyword' },
              name: { 
                type: 'text', 
                analyzer: 'spanish_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                  suggest: {
                    type: 'completion',
                    analyzer: 'spanish_analyzer'
                  }
                }
              },
              description: { 
                type: 'text', 
                analyzer: 'spanish_analyzer' 
              },
              price: { type: 'float' },
              imageUrl: { type: 'keyword', index: false },
              category: { 
                type: 'keyword',
                fields: {
                  text: { type: 'text', analyzer: 'spanish_analyzer' }
                }
              },
              featured: { type: 'boolean' },
              available: { type: 'boolean' },
              restaurant: {
                type: 'object',
                properties: {
                  name: { type: 'text', analyzer: 'spanish_analyzer' },
                  cuisine: { type: 'keyword' }
                }
              },
              created_at: { type: 'date' },
              updated_at: { type: 'date' }
            }
          }
        }
      });
      
      logger.info(`${PRODUCT_INDEX} index created`);
    }

    // Índice de restaurantes
    const restaurantIndexExists = await client.indices.exists({ index: RESTAURANT_INDEX });
    
    if (!restaurantIndexExists) {
      logger.info(`Creating ${RESTAURANT_INDEX} index...`);
      
      await client.indices.create({
        index: RESTAURANT_INDEX,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                spanish_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding', 'spanish_stop']
                }
              },
              filter: {
                spanish_stop: {
                  type: 'stop',
                  stopwords: '_spanish_'
                }
              }
            }
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: { 
                type: 'text', 
                analyzer: 'spanish_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                  suggest: {
                    type: 'completion',
                    analyzer: 'spanish_analyzer'
                  }
                }
              },
              description: { type: 'text', analyzer: 'spanish_analyzer' },
              address: { type: 'text' },
              cuisine: { type: 'keyword' },
              rating: { type: 'float' },
              priceRange: { type: 'integer' },
              imageUrl: { type: 'keyword', index: false },
              location: { type: 'geo_point' }
            }
          }
        }
      });
      
      logger.info(`${RESTAURANT_INDEX} index created`);
    }
  } catch (error) {
    logger.error('Error creating indices:', error);
    throw error;
  }
};

// Indexar un producto
export const indexProduct = async (product: SearchProduct) => {
  try {
    await client.index({
      index: PRODUCT_INDEX,
      id: product.id,
      body: {
        ...product,
        description: product.description || 'Producto sin descripción',
        updated_at: new Date().toISOString()
      }
    });
    
    logger.debug(`Indexed product ${product.id}`);
    return true;
  } catch (error) {
    logger.error(`Error indexing product ${product.id}:`, error);
    throw error;
  }
};

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

    return {
      hits: result.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score
      })),
      total: typeof result.hits.total === 'object' 
        ? result.hits.total.value 
        : result.hits.total
    };
  } catch (error) {
    logger.error(`Error searching products by category "${category}":`, error);
    throw error;
  }
};

// Indexar un restaurante
export const indexRestaurant = async (restaurant: SearchRestaurant) => {
  try {
    await client.index({
      index: RESTAURANT_INDEX,
      id: restaurant.id,
      body: {
        ...restaurant,
        updated_at: new Date().toISOString()
      }
    });
    
    logger.debug(`Indexed restaurant ${restaurant.id}`);
    return true;
  } catch (error) {
    logger.error(`Error indexing restaurant ${restaurant.id}:`, error);
    throw error;
  }
};

// Buscar productos por texto
export const searchProducts = async (
  query: string, 
  filters?: {
    restaurantId?: string;
    category?: string;
    available?: boolean;
    minPrice?: number;
    maxPrice?: number;
  },
  pagination?: {
    from?: number;
    size?: number;
  }
) => {
  try {
    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Query principal
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'name^3',
            'description^1',
            'category.text^2',
            'restaurant.name^2'
          ],
          fuzziness: 'AUTO',
          minimum_should_match: '75%'
        }
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    // Filtros
    if (filters?.restaurantId) {
      filterClauses.push({ term: { restaurantId: filters.restaurantId } });
    }

    if (filters?.category) {
      filterClauses.push({ term: { category: filters.category } });
    }

    if (filters?.available !== undefined) {
      filterClauses.push({ term: { available: filters.available } });
    }

    if (filters?.minPrice !== undefined || filters?.maxPrice !== undefined) {
      const priceRange: any = {};
      if (filters.minPrice !== undefined) priceRange.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) priceRange.lte = filters.maxPrice;
      filterClauses.push({ range: { price: priceRange } });
    }

    const searchBody = {
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses
        }
      },
      highlight: {
        fields: {
          name: {},
          description: {}
        }
      },
      sort: [
        '_score',
        { featured: { order: 'desc' } },
        { price: { order: 'asc' } }
      ],
      from: pagination?.from || 0,
      size: pagination?.size || 20
    };

    const result = await client.search({
      index: PRODUCT_INDEX,
      body: searchBody
    });

    return {
      hits: result.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight
      })),
      total: typeof result.hits.total === 'object' 
        ? result.hits.total.value 
        : result.hits.total,
      aggregations: result.aggregations
    };
  } catch (error) {
    logger.error(`Error searching products with query "${query}":`, error);
    throw error;
  }
};

// Buscar restaurantes
export const searchRestaurants = async (
  query: string,
  filters?: {
    cuisine?: string;
    priceRange?: number;
    minRating?: number;
  },
  pagination?: {
    from?: number;
    size?: number;
  }
) => {
  try {
    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Query principal
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query.trim(),
          fields: ['name^3', 'description^1', 'cuisine^2'],
          fuzziness: 'AUTO'
        }
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    // Filtros
    if (filters?.cuisine) {
      filterClauses.push({ term: { cuisine: filters.cuisine } });
    }

    if (filters?.priceRange) {
      filterClauses.push({ term: { priceRange: filters.priceRange } });
    }

    if (filters?.minRating) {
      filterClauses.push({ range: { rating: { gte: filters.minRating } } });
    }

    const result = await client.search({
      index: RESTAURANT_INDEX,
      body: {
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses
          }
        },
        sort: [
          '_score',
          { rating: { order: 'desc' } }
        ],
        from: pagination?.from || 0,
        size: pagination?.size || 20
      }
    });

    return {
      hits: result.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score
      })),
      total: typeof result.hits.total === 'object' 
        ? result.hits.total.value 
        : result.hits.total
    };
  } catch (error) {
    logger.error(`Error searching restaurants with query "${query}":`, error);
    throw error;
  }
};

// Obtener sugerencias de autocompletado
export const getSuggestions = async (query: string, type: 'products' | 'restaurants' = 'products') => {
  try {
    const index = type === 'products' ? PRODUCT_INDEX : RESTAURANT_INDEX;
    const field = type === 'products' ? 'name.suggest' : 'name.suggest';

    const result = await client.search({
      index,
      body: {
        suggest: {
          autocomplete: {
            prefix: query,
            completion: {
              field,
              size: 10
            }
          }
        }
      }
    });

    return result.suggest?.autocomplete?.[0]?.options?.map((option: any) => ({
      text: option.text,
      score: option._score,
      source: option._source
    })) || [];
  } catch (error) {
    logger.error(`Error getting suggestions for query "${query}":`, error);
    throw error;
  }
};

// Reindexar todos los datos
export const reindexAllData = async () => {
  try {
    logger.info('Starting full reindexing...');
    
    // Obtener datos de la API principal
    const [productsResponse, restaurantsResponse] = await Promise.all([
      fetch(`${config.API_URI}/api/menu-items`),
      fetch(`${config.API_URI}/api/restaurants`)
    ]);

    if (!productsResponse.ok || !restaurantsResponse.ok) {
      throw new Error('Failed to fetch data from API');
    }

    const products = await productsResponse.json();
    const restaurants = await restaurantsResponse.json();

    // Recrear índices
    await recreateIndices();

    // Indexar restaurantes primero
    if (restaurants.length > 0) {
      const restaurantOps = restaurants.flatMap((restaurant: any) => [
        { index: { _index: RESTAURANT_INDEX, _id: restaurant.id } },
        {
          ...restaurant,
          updated_at: new Date().toISOString()
        }
      ]);

      await client.bulk({ refresh: true, body: restaurantOps });
      logger.info(`Indexed ${restaurants.length} restaurants`);
    }

    // Indexar productos con información del restaurante
    if (products.length > 0) {
      const productOps = products.flatMap((product: any) => {
        const restaurant = restaurants.find((r: any) => r.id === product.restaurantId);
        
        return [
          { index: { _index: PRODUCT_INDEX, _id: product.id } },
          {
            ...product,
            description: product.description || 'Producto sin descripción',
            restaurant: restaurant ? {
              name: restaurant.name,
              cuisine: restaurant.cuisine
            } : undefined,
            updated_at: new Date().toISOString()
          }
        ];
      });

      const bulkResponse = await client.bulk({ refresh: true, body: productOps });
      
      if (bulkResponse.errors) {
        const erroredDocs = bulkResponse.items.filter((item: any) => 
          item.index && item.index.error
        );
        logger.warn(`Bulk indexing had ${erroredDocs.length} errors`);
      }

      logger.info(`Indexed ${products.length} products`);
    }

    return {
      success: true,
      restaurants: restaurants.length,
      products: products.length
    };
  } catch (error) {
    logger.error('Error during full reindexing:', error);
    throw error;
  }
};

// Recrear índices (eliminar y crear de nuevo)
const recreateIndices = async () => {
  const indices = [PRODUCT_INDEX, RESTAURANT_INDEX];
  
  for (const index of indices) {
    const exists = await client.indices.exists({ index });
    if (exists) {
      await client.indices.delete({ index });
      logger.info(`Deleted existing index: ${index}`);
    }
  }
  
  await createIndicesIfNotExist();
};

// Eliminar producto del índice
export const deleteProduct = async (productId: string) => {
  try {
    await client.delete({
      index: PRODUCT_INDEX,
      id: productId
    });
    logger.debug(`Deleted product ${productId} from search index`);
  } catch (error) {
    if (error.meta?.statusCode !== 404) {
      logger.error(`Error deleting product ${productId}:`, error);
      throw error;
    }
  }
};

// Eliminar restaurante del índice
export const deleteRestaurant = async (restaurantId: string) => {
  try {
    await client.delete({
      index: RESTAURANT_INDEX,
      id: restaurantId
    });
    logger.debug(`Deleted restaurant ${restaurantId} from search index`);
  } catch (error) {
    if (error.meta?.statusCode !== 404) {
      logger.error(`Error deleting restaurant ${restaurantId}:`, error);
      throw error;
    }
  }
};

// Obtener cliente (para testing)
export const getElasticsearchClient = () => client;