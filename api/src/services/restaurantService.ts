import { Restaurant } from '../models';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { logger } from '../utils/logger';

export class RestaurantService {
  private restaurantRepository = RepositoryFactory.getRestaurantRepository();

  async getAllRestaurants(): Promise<Restaurant[]> {
    try {
      return await this.restaurantRepository.findAll();
    } catch (error) {
      logger.error('Error in RestaurantService.getAllRestaurants:', error);
      throw new Error('Failed to retrieve restaurants');
    }
  }

  async getRestaurantById(id: string): Promise<Restaurant | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      return await this.restaurantRepository.findById(id);
    } catch (error) {
      logger.error(`Error in RestaurantService.getRestaurantById(${id}):`, error);
      throw new Error('Failed to retrieve restaurant');
    }
  }

  async getRestaurantsByCuisine(cuisine: string): Promise<Restaurant[]> {
    try {
      if (!cuisine || typeof cuisine !== 'string') {
        throw new Error('Invalid cuisine provided');
      }

      return await this.restaurantRepository.findByCuisine(cuisine.trim());
    } catch (error) {
      logger.error(`Error in RestaurantService.getRestaurantsByCuisine(${cuisine}):`, error);
      throw new Error('Failed to retrieve restaurants by cuisine');
    }
  }

  async getRestaurantsByPriceRange(priceRange: Restaurant['priceRange']): Promise<Restaurant[]> {
    try {
      if (!priceRange || ![1, 2, 3].includes(priceRange)) {
        throw new Error('Invalid price range provided');
      }

      return await this.restaurantRepository.findByPriceRange(priceRange);
    } catch (error) {
      logger.error(`Error in RestaurantService.getRestaurantsByPriceRange(${priceRange}):`, error);
      throw new Error('Failed to retrieve restaurants by price range');
    }
  }

  async searchRestaurants(query: string, filters?: {
    cuisine?: string;
    priceRange?: Restaurant['priceRange'];
    minRating?: number;
  }): Promise<Restaurant[]> {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error('Invalid search query provided');
      }

      let restaurants = await this.restaurantRepository.searchRestaurants(query.trim());

      // Aplicar filtros adicionales
      if (filters) {
        if (filters.cuisine) {
          restaurants = restaurants.filter(restaurant => 
            restaurant.cuisine.toLowerCase().includes(filters.cuisine!.toLowerCase())
          );
        }

        if (filters.priceRange) {
          restaurants = restaurants.filter(restaurant => 
            restaurant.priceRange === filters.priceRange
          );
        }

        if (filters.minRating) {
          restaurants = restaurants.filter(restaurant => 
            restaurant.rating >= filters.minRating!
          );
        }
      }

      return restaurants;
    } catch (error) {
      logger.error(`Error in RestaurantService.searchRestaurants(${query}):`, error);
      throw new Error('Failed to search restaurants');
    }
  }

  async createRestaurant(restaurantData: Omit<Restaurant, 'id'>): Promise<Restaurant> {
    try {
      // Validaciones de negocio
      this.validateRestaurantData(restaurantData);

      // Validar horarios de apertura
      this.validateOpeningHours(restaurantData.openingHours);

      // Normalizar datos
      const normalizedRestaurantData = {
        ...restaurantData,
        name: restaurantData.name.trim(),
        description: restaurantData.description.trim(),
        address: restaurantData.address.trim(),
        phone: restaurantData.phone.trim(),
        cuisine: restaurantData.cuisine.trim(),
        rating: restaurantData.rating || 0,
      };

      return await this.restaurantRepository.create(normalizedRestaurantData);
    } catch (error) {
      logger.error('Error in RestaurantService.createRestaurant:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to create restaurant');
    }
  }

  async updateRestaurant(id: string, restaurantData: Partial<Restaurant>): Promise<Restaurant | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      // Verificar que el restaurante existe
      const existingRestaurant = await this.restaurantRepository.findById(id);
      if (!existingRestaurant) {
        throw new Error('Restaurant not found');
      }

      // Validar datos de actualización
      if (Object.keys(restaurantData).length > 0) {
        const dataToValidate = {
          name: restaurantData.name || existingRestaurant.name,
          description: restaurantData.description || existingRestaurant.description,
          address: restaurantData.address || existingRestaurant.address,
          phone: restaurantData.phone || existingRestaurant.phone,
          imageUrl: restaurantData.imageUrl || existingRestaurant.imageUrl,
          cuisine: restaurantData.cuisine || existingRestaurant.cuisine,
          rating: restaurantData.rating !== undefined ? restaurantData.rating : existingRestaurant.rating,
          priceRange: restaurantData.priceRange || existingRestaurant.priceRange,
          openingHours: restaurantData.openingHours || existingRestaurant.openingHours,
        };
        
        this.validateRestaurantData(dataToValidate);
      }

      // Validar horarios si se están actualizando
      if (restaurantData.openingHours) {
        this.validateOpeningHours(restaurantData.openingHours);
      }

      // Normalizar datos
      const normalizedUpdateData: Partial<Restaurant> = {};
      
      if (restaurantData.name) normalizedUpdateData.name = restaurantData.name.trim();
      if (restaurantData.description) normalizedUpdateData.description = restaurantData.description.trim();
      if (restaurantData.address) normalizedUpdateData.address = restaurantData.address.trim();
      if (restaurantData.phone) normalizedUpdateData.phone = restaurantData.phone.trim();
      if (restaurantData.imageUrl) normalizedUpdateData.imageUrl = restaurantData.imageUrl;
      if (restaurantData.cuisine) normalizedUpdateData.cuisine = restaurantData.cuisine.trim();
      if (restaurantData.rating !== undefined) normalizedUpdateData.rating = restaurantData.rating;
      if (restaurantData.priceRange) normalizedUpdateData.priceRange = restaurantData.priceRange;
      if (restaurantData.openingHours) normalizedUpdateData.openingHours = restaurantData.openingHours;

      return await this.restaurantRepository.update(id, normalizedUpdateData);
    } catch (error) {
      logger.error(`Error in RestaurantService.updateRestaurant(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update restaurant');
    }
  }

  async deleteRestaurant(id: string): Promise<boolean> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      // Verificar que el restaurante existe
      const existingRestaurant = await this.restaurantRepository.findById(id);
      if (!existingRestaurant) {
        throw new Error('Restaurant not found');
      }

      // Aquí podrías agregar lógica adicional, como:
      // - Verificar que no tenga reservas o pedidos activos
      // - Notificar a usuarios con reservas futuras
      // - Limpiar datos relacionados (menús, reservas, etc.)

      return await this.restaurantRepository.delete(id);
    } catch (error) {
      logger.error(`Error in RestaurantService.deleteRestaurant(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to delete restaurant');
    }
  }

  async updateRestaurantRating(id: string, rating: number): Promise<Restaurant | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      if (typeof rating !== 'number' || rating < 0 || rating > 5) {
        throw new Error('Rating must be a number between 0 and 5');
      }

      // Aquí podrías implementar lógica más compleja para calcular ratings
      // basado en reseñas de usuarios, etc.

      return await this.restaurantRepository.update(id, { rating });
    } catch (error) {
      logger.error(`Error in RestaurantService.updateRestaurantRating(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update restaurant rating');
    }
  }

  async getRestaurantStats(): Promise<{
    totalRestaurants: number;
    cuisineBreakdown: { [cuisine: string]: number };
    priceRangeBreakdown: { [range: string]: number };
    averageRating: number;
    topRatedRestaurants: Restaurant[];
  }> {
    try {
      const allRestaurants = await this.restaurantRepository.findAll();
      
      // Desglose por cocina
      const cuisineBreakdown: { [cuisine: string]: number } = {};
      allRestaurants.forEach(restaurant => {
        cuisineBreakdown[restaurant.cuisine] = (cuisineBreakdown[restaurant.cuisine] || 0) + 1;
      });

      // Desglose por rango de precios
      const priceRangeBreakdown: { [range: string]: number } = {
        '1': 0,
        '2': 0,
        '3': 0
      };
      allRestaurants.forEach(restaurant => {
        priceRangeBreakdown[restaurant.priceRange.toString()]++;
      });

      // Rating promedio
      const totalRating = allRestaurants.reduce((sum, restaurant) => sum + restaurant.rating, 0);
      const averageRating = allRestaurants.length > 0 ? totalRating / allRestaurants.length : 0;

      // Top rated restaurants (5 mejores)
      const topRatedRestaurants = allRestaurants
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5);

      return {
        totalRestaurants: allRestaurants.length,
        cuisineBreakdown,
        priceRangeBreakdown,
        averageRating: parseFloat(averageRating.toFixed(2)),
        topRatedRestaurants,
      };
    } catch (error) {
      logger.error('Error in RestaurantService.getRestaurantStats:', error);
      throw new Error('Failed to retrieve restaurant statistics');
    }
  }

  async isRestaurantOpen(restaurantId: string, date?: Date): Promise<{
    isOpen: boolean;
    nextOpenTime?: string;
    nextCloseTime?: string;
  }> {
    try {
      const restaurant = await this.restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      const checkDate = date || new Date();
      const currentTime = `${checkDate.getHours().toString().padStart(2, '0')}:${checkDate.getMinutes().toString().padStart(2, '0')}`;
      
      const { opens, closes } = restaurant.openingHours;
      
      // Comparar horarios (asumiendo que no cruzan medianoche)
      const isOpen = currentTime >= opens && currentTime <= closes;
      
      return {
        isOpen,
        nextOpenTime: isOpen ? undefined : opens,
        nextCloseTime: isOpen ? closes : undefined,
      };
    } catch (error) {
      logger.error(`Error in RestaurantService.isRestaurantOpen(${restaurantId}):`, error);
      throw new Error('Failed to check restaurant status');
    }
  }

  private validateRestaurantData(restaurantData: Omit<Restaurant, 'id'>): void {
    // Validar nombre
    if (!restaurantData.name || typeof restaurantData.name !== 'string' || restaurantData.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    if (restaurantData.name.trim().length > 100) {
      throw new Error('Name cannot exceed 100 characters');
    }

    // Validar descripción
    if (!restaurantData.description || typeof restaurantData.description !== 'string' || restaurantData.description.trim().length < 10) {
      throw new Error('Description must be at least 10 characters long');
    }

    if (restaurantData.description.trim().length > 1000) {
      throw new Error('Description cannot exceed 1000 characters');
    }

    // Validar dirección
    if (!restaurantData.address || typeof restaurantData.address !== 'string' || restaurantData.address.trim().length < 5) {
      throw new Error('Address must be at least 5 characters long');
    }

    // Validar teléfono
    if (!restaurantData.phone || typeof restaurantData.phone !== 'string') {
      throw new Error('Phone is required');
    }

    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(restaurantData.phone.trim())) {
      throw new Error('Invalid phone format');
    }

    // Validar URL de imagen
    if (!restaurantData.imageUrl || typeof restaurantData.imageUrl !== 'string') {
      throw new Error('Image URL is required');
    }

    try {
      new URL(restaurantData.imageUrl);
    } catch {
      throw new Error('Invalid image URL format');
    }

    // Validar cocina
    if (!restaurantData.cuisine || typeof restaurantData.cuisine !== 'string' || restaurantData.cuisine.trim().length < 2) {
      throw new Error('Cuisine must be at least 2 characters long');
    }

    // Validar rating
    if (restaurantData.rating !== undefined && (typeof restaurantData.rating !== 'number' || restaurantData.rating < 0 || restaurantData.rating > 5)) {
      throw new Error('Rating must be a number between 0 and 5');
    }

    // Validar rango de precios
    if (!restaurantData.priceRange || ![1, 2, 3].includes(restaurantData.priceRange)) {
      throw new Error('Price range must be 1, 2, or 3');
    }
  }

  private validateOpeningHours(openingHours: Restaurant['openingHours']): void {
    if (!openingHours || typeof openingHours !== 'object') {
      throw new Error('Opening hours are required');
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!openingHours.opens || !timeRegex.test(openingHours.opens)) {
      throw new Error('Opening time must be in HH:MM format');
    }

    if (!openingHours.closes || !timeRegex.test(openingHours.closes)) {
      throw new Error('Closing time must be in HH:MM format');
    }

    // Validar que la hora de cierre sea después de la apertura
    const [openHour, openMin] = openingHours.opens.split(':').map(Number);
    const [closeHour, closeMin] = openingHours.closes.split(':').map(Number);
    
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;
    
    if (closeTime <= openTime) {
      throw new Error('Closing time must be after opening time');
    }
  }
}