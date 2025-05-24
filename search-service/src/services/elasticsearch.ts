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

interface SearchResult<T> {
  hits: T[];
  total: number;
  aggregations?: any;
}

// Inicializar ElasticSearch
export const initializeElasticsearch = async (): Promise<Client> => {
  try {
    logger.info('Initializing ElasticSearch client...');
    
    client = new Client({
      node: config.ELASTICSEARCH_URI,
      requestTimeout: 30000,
      pingTimeout: 3000,
      maxRetries: 3,
      auth: config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD ? {
        username: config.ELASTICSEARCH_USERNAME,
        password: config.ELASTICSEARCH_PASSWORD
      } : undefined
    });
    
    // Verificar conexión
    await client.ping();
    logger.info('ElasticSearch connection successful');
    
    // Obtener información del cluster
    const health = await client.cluster.health();
    logger.info(`ElasticSearch cluster status: ${health.status}`);
    
    // Crear índices si no existen
    await createIndicesIfNotExist();
    
    return client;
  } catch (error) {
    logger.error('Failed to initialize ElasticSearch:', error);
    throw new Error(`ElasticSearch initialization failed: ${error.message}`);
  }
};

// Crear índices si no existen
const createIndicesIfNotExist = async (): Promise<void> => {
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
                },
                autocomplete_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'asciifolding',
                    'autocomplete_filter'
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
                },
                autocomplete_filter: {
                  type: 'edge_ngram',
                  min_gram: 2,
                  max_gram: 20
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
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'spanish_analyzer'
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
                  name: { 
                    type: 'text', 
                    analyzer: 'spanish_analyzer',
                    fields: {
                      keyword: { type: 'keyword' }
                    }
                  },
                  cuisine: { type: 'keyword' }
                }
              },
              created_at: { type: 'date' },
              updated_at: { type: 'date' }
            }
          }
        }
      });
      
      logger.info(`${PRODUCT_INDEX} index created successfully`);
    } else {
      logger.info(`${PRODUCT_INDEX} index already exists`);
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
                },
                autocomplete_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding', 'autocomplete_filter']
                }
              },
              filter: {
                spanish_stop: {
                  type: 'stop',
                  stopwords: '_spanish_'
                },
                autocomplete_filter: {
                  type: 'edge_ngram',
                  min_gram: 2,
                  max_gram: 20
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
                  autocomplete: {
                    type: 'text',
                    analyzer: 'autocomplete_analyzer',
                    search_analyzer: 'spanish_analyzer'
                  }
                }
              },
              description: { type: 'text', analyzer: 'spanish_analyzer' },
              address: { 
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              cuisine: { type: 'keyword' },
              rating: { type: 'float' },
              priceRange: { type: 'integer' },
              imageUrl: { type: 'keyword', index: false },
              location: { type: 'geo_point' },
              openingHours: {
                type: 'object',
                properties: {
                  opens: { type: 'keyword' },
                  closes: { type: 'keyword' }
                }
              },
              created_at: { type: 'date' },
              updated_at: { type: 'date' }
            }
          }
        }
      });
      
      logger.info(`${RESTAURANT_INDEX} index created successfully`);
    } else {
      logger.info(`${RESTAURANT_INDEX} index already exists`);
    }
  } catch (error) {
    logger.error('Error creating indices:', error);
    throw new Error(`Failed to create indices: ${error.message}`);
  }
};

// Indexar un producto
export const indexProduct = async (product: SearchProduct): Promise<boolean> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    const response = await client.index({
      index: PRODUCT_INDEX,
      id: product.id,
      body: {
        ...product,
        description: product.description || 'Producto sin descripción',
        updated_at: new Date().toISOString()
      }
    });
    
    logger.debug(`Indexed product ${product.id}, result: ${response.result}`);
    return response.result === 'created' || response.result === 'updated';
  } catch (error) {
    logger.error(`Error indexing product ${product.id}:`, error);
    throw new Error(`Failed to index product: ${error.message}`);
  }
};

// Indexar un restaurante
export const indexRestaurant = async (restaurant: SearchRestaurant): Promise<boolean> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    const response = await client.index({
      index: RESTAURANT_INDEX,
      id: restaurant.id,
      body: {
        ...restaurant,
        updated_at: new Date().toISOString()
      }
    });
    
    logger.debug(`Indexed restaurant ${restaurant.id}, result: ${response.result}`);
    return response.result === 'created' || response.result === 'updated';
  } catch (error) {
    logger.error(`Error indexing restaurant ${restaurant.id}:`, error);
    throw new Error(`Failed to index restaurant: ${error.message}`);
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
): Promise<SearchResult<SearchProduct & { score: number; highlights?: any }>> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Query principal
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'name^3',
            'name.autocomplete^2',
            'description^1',
            'category.text^2',
            'restaurant.name^2'
          ],
          fuzziness: 'AUTO',
          minimum_should_match: '75%',
          type: 'best_fields'
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
          name: {
            pre_tags: ['<em>'],
            post_tags: ['</em>']
          },
          description: {
            pre_tags: ['<em>'],
            post_tags: ['</em>']
          }
        }
      },
      sort: [
        '_score',
        { featured: { order: 'desc' } },
        { price: { order: 'asc' } }
      ],
      from: pagination?.from || 0,
      size: Math.min(pagination?.size || 20, 100) // Máximo 100 resultados
    };

    const result = await client.search({
      index: PRODUCT_INDEX,
      body: searchBody
    });

    const hits = result.hits.hits.map((hit: any) => ({
      ...hit._source,
      score: hit._score,
      highlights: hit.highlight
    }));

    const total = typeof result.hits.total === 'object' 
      ? result.hits.total.value 
      : result.hits.total;

    return {
      hits,
      total: total || 0,
      aggregations: result.aggregations
    };
  } catch (error) {
    logger.error(`Error searching products with query "${query}":`, error);
    throw new Error(`Product search failed: ${error.message}`);
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
): Promise<SearchResult<SearchRestaurant & { score: number }>> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Query principal
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query.trim(),
          fields: [
            'name^3', 
            'name.autocomplete^2',
            'description^1', 
            'cuisine^2',
            'address^1'
          ],
          fuzziness: 'AUTO',
          type: 'best_fields'
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
        size: Math.min(pagination?.size || 20, 100)
      }
    });

    const hits = result.hits.hits.map((hit: any) => ({
      ...hit._source,
      score: hit._score
    }));

    const total = typeof result.hits.total === 'object' 
      ? result.hits.total.value 
      : result.hits.total;

    return {
      hits,
      total: total || 0
    };
  } catch (error) {
    logger.error(`Error searching restaurants with query "${query}":`, error);
    throw new Error(`Restaurant search failed: ${error.message}`);
  }
};

// Obtener sugerencias de autocompletado
export const getSuggestions = async (
  query: string, 
  type: 'products' | 'restaurants' = 'products'
): Promise<Array<{ text: string; score: number; source: any }>> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    const index = type === 'products' ? PRODUCT_INDEX : RESTAURANT_INDEX;
    const field = type === 'products' ? 'name.autocomplete' : 'name.autocomplete';

    const result = await client.search({
      index,
      body: {
        query: {
          match: {
            [field]: {
              query: query,
              operator: 'and'
            }
          }
        },
        _source: ['id', 'name', 'category', 'cuisine'],
        size: 10
      }
    });

    return result.hits.hits.map((hit: any) => ({
      text: hit._source.name,
      score: hit._score,
      source: hit._source
    }));
  } catch (error) {
    logger.error(`Error getting suggestions for query "${query}":`, error);
    return [];
  }
};

// Reindexar todos los datos
export const reindexAllData = async (): Promise<{ success: boolean; restaurants: number; products: number }> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    logger.info('Starting full reindexing...');
    
    // Obtener datos de la API principal con manejo de errores mejorado
    let products: any[] = [];
    let restaurants: any[] = [];

    try {
      const fetch = (await import('node-fetch')).default;
      
      const [productsResponse, restaurantsResponse] = await Promise.allSettled([
        fetch(`${config.API_URI}/api/menu-items`),
        fetch(`${config.API_URI}/api/restaurants`)
      ]);

      if (productsResponse.status === 'fulfilled' && productsResponse.value.ok) {
        products = await productsResponse.value.json();
        if (Array.isArray(products.results)) {
          products = products.results;
        }
      } else {
        logger.warn('Failed to fetch products for reindexing');
      }

      if (restaurantsResponse.status === 'fulfilled' && restaurantsResponse.value.ok) {
        restaurants = await restaurantsResponse.value.json();
        if (Array.isArray(restaurants.results)) {
          restaurants = restaurants.results;
        }
      } else {
        logger.warn('Failed to fetch restaurants for reindexing');
      }
    } catch (fetchError) {
      logger.error('Error fetching data from API:', fetchError);
      throw new Error('Failed to fetch data from API for reindexing');
    }

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

      const bulkResponse = await client.bulk({ 
        refresh: true, 
        body: restaurantOps,
        timeout: '60s'
      });
      
      if (bulkResponse.errors) {
        const errors = bulkResponse.items.filter((item: any) => 
          item.index && item.index.error
        );
        logger.warn(`Restaurant bulk indexing had ${errors.length} errors`);
      }

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

      const bulkResponse = await client.bulk({ 
        refresh: true, 
        body: productOps,
        timeout: '60s'
      });
      
      if (bulkResponse.errors) {
        const errors = bulkResponse.items.filter((item: any) => 
          item.index && item.index.error
        );
        logger.warn(`Product bulk indexing had ${errors.length} errors`);
      }

      logger.info(`Indexed ${products.length} products`);
    }

    logger.info('Full reindexing completed successfully');
    return {
      success: true,
      restaurants: restaurants.length,
      products: products.length
    };
  } catch (error) {
    logger.error('Error during full reindexing:', error);
    throw new Error(`Reindexing failed: ${error.message}`);
  }
};

// Recrear índices (eliminar y crear de nuevo)
const recreateIndices = async (): Promise<void> => {
  const indices = [PRODUCT_INDEX, RESTAURANT_INDEX];
  
  for (const index of indices) {
    try {
      const exists = await client.indices.exists({ index });
      if (exists) {
        await client.indices.delete({ index });
        logger.info(`Deleted existing index: ${index}`);
      }
    } catch (error) {
      logger.warn(`Error deleting index ${index}:`, error);
    }
  }
  
  await createIndicesIfNotExist();
};

// Eliminar producto del índice
export const deleteProduct = async (productId: string): Promise<void> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    await client.delete({
      index: PRODUCT_INDEX,
      id: productId
    });
    logger.debug(`Deleted product ${productId} from search index`);
  } catch (error) {
    if (error.meta?.statusCode !== 404) {
      logger.error(`Error deleting product ${productId}:`, error);
      throw new Error(`Failed to delete product: ${error.message}`);
    }
    // Ignorar error 404 (producto no encontrado)
  }
};

// Eliminar restaurante del índice
export const deleteRestaurant = async (restaurantId: string): Promise<void> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    await client.delete({
      index: RESTAURANT_INDEX,
      id: restaurantId
    });
    logger.debug(`Deleted restaurant ${restaurantId} from search index`);
  } catch (error) {
    if (error.meta?.statusCode !== 404) {
      logger.error(`Error deleting restaurant ${restaurantId}:`, error);
      throw new Error(`Failed to delete restaurant: ${error.message}`);
    }
    // Ignorar error 404 (restaurante no encontrado)
  }
};

// Verificar salud de ElasticSearch
export const checkHealth = async (): Promise<{
  status: string;
  cluster_name: string;
  number_of_nodes: number;
  indices: { [key: string]: any };
}> => {
  try {
    if (!client) {
      throw new Error('ElasticSearch client not initialized');
    }

    const [health, productStats, restaurantStats] = await Promise.all([
      client.cluster.health(),
      client.indices.stats({ index: PRODUCT_INDEX }).catch(() => null),
      client.indices.stats({ index: RESTAURANT_INDEX }).catch(() => null)
    ]);

    return {
      status: health.status,
      cluster_name: health.cluster_name,
      number_of_nodes: health.number_of_nodes,
      indices: {
        [PRODUCT_INDEX]: productStats ? {
          docs: productStats.indices[PRODUCT_INDEX]?.total?.docs || { count: 0 },
          size: productStats.indices[PRODUCT_INDEX]?.total?.store || { size_in_bytes: 0 }
        } : null,
        [RESTAURANT_INDEX]: restaurantStats ? {
          docs: restaurantStats.indices[RESTAURANT_INDEX]?.total?.docs || { count: 0 },
          size: restaurantStats.indices[RESTAURANT_INDEX]?.total?.store || { size_in_bytes: 0 }
        } : null
      }
    };
  } catch (error) {
    logger.error('Error checking ElasticSearch health:', error);
    throw new Error(`Health check failed: ${error.message}`);
  }
};

// Obtener cliente (para testing y uso externo)
export const getElasticsearchClient = (): Client => {
  if (!client) {
    throw new Error('ElasticSearch client not initialized');
  }
  return client;
};

// Cerrar conexión
export const closeConnection = async (): Promise<void> => {
  if (client) {
    try {
      await client.close();
      logger.info('ElasticSearch connection closed');
    } catch (error) {
      logger.error('Error closing ElasticSearch connection:', error);
    }
  }
};