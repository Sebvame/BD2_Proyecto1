import { MenuItem } from '../models';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { logger } from '../utils/logger';

export class MenuItemService {
  private menuItemRepository = RepositoryFactory.getMenuItemRepository();
  private restaurantRepository = RepositoryFactory.getRestaurantRepository();

  async getAllMenuItems(filters?: {
    restaurantId?: string;
    category?: string;
    featured?: boolean;
    available?: boolean;
  }): Promise<MenuItem[]> {
    try {
      if (filters?.restaurantId && filters.category) {
        return await this.menuItemRepository.findByRestaurantAndCategory(
          filters.restaurantId, 
          filters.category
        );
      }

      if (filters?.restaurantId) {
        if (filters.available) {
          return await this.menuItemRepository.findAvailableByRestaurant(filters.restaurantId);
        }
        return await this.menuItemRepository.findByRestaurantId(filters.restaurantId);
      }

      if (filters?.category) {
        return await this.menuItemRepository.findByCategory(filters.category);
      }

      if (filters?.featured) {
        return await this.menuItemRepository.findFeaturedItems();
      }

      return await this.menuItemRepository.findAll();
    } catch (error) {
      logger.error('Error in MenuItemService.getAllMenuItems:', error);
      throw new Error('Failed to retrieve menu items');
    }
  }

  async getMenuItemById(id: string): Promise<MenuItem | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid menu item ID provided');
      }

      return await this.menuItemRepository.findById(id);
    } catch (error) {
      logger.error(`Error in MenuItemService.getMenuItemById(${id}):`, error);
      throw new Error('Failed to retrieve menu item');
    }
  }

  async getMenuItemsByRestaurant(
    restaurantId: string, 
    filters?: { category?: string; available?: boolean }
  ): Promise<MenuItem[]> {
    try {
      if (!restaurantId || typeof restaurantId !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      // Verificar que el restaurante existe
      const restaurant = await this.restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      if (filters?.category) {
        return await this.menuItemRepository.findByRestaurantAndCategory(
          restaurantId, 
          filters.category
        );
      }

      if (filters?.available) {
        return await this.menuItemRepository.findAvailableByRestaurant(restaurantId);
      }

      return await this.menuItemRepository.findByRestaurantId(restaurantId);
    } catch (error) {
      logger.error(`Error in MenuItemService.getMenuItemsByRestaurant(${restaurantId}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to retrieve menu items by restaurant');
    }
  }

  async getMenuItemsByCategory(category: string): Promise<MenuItem[]> {
    try {
      if (!category || typeof category !== 'string') {
        throw new Error('Invalid category provided');
      }

      return await this.menuItemRepository.findByCategory(category.trim());
    } catch (error) {
      logger.error(`Error in MenuItemService.getMenuItemsByCategory(${category}):`, error);
      throw new Error('Failed to retrieve menu items by category');
    }
  }

  async getFeaturedMenuItems(): Promise<MenuItem[]> {
    try {
      return await this.menuItemRepository.findFeaturedItems();
    } catch (error) {
      logger.error('Error in MenuItemService.getFeaturedMenuItems:', error);
      throw new Error('Failed to retrieve featured menu items');
    }
  }

  async createMenuItem(menuItemData: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    try {
      // Validaciones de negocio
      await this.validateMenuItemData(menuItemData);

      // Normalizar datos
      const normalizedMenuItemData = {
        ...menuItemData,
        name: menuItemData.name.trim(),
        description: menuItemData.description?.trim() || 'Producto sin descripción',
        category: menuItemData.category.trim(),
        featured: menuItemData.featured || false,
        available: menuItemData.available !== undefined ? menuItemData.available : true,
      };

      return await this.menuItemRepository.create(normalizedMenuItemData);
    } catch (error) {
      logger.error('Error in MenuItemService.createMenuItem:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to create menu item');
    }
  }

  async updateMenuItem(id: string, menuItemData: Partial<MenuItem>): Promise<MenuItem | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid menu item ID provided');
      }

      // Verificar que el item del menú existe
      const existingMenuItem = await this.menuItemRepository.findById(id);
      if (!existingMenuItem) {
        throw new Error('Menu item not found');
      }

      // Validar datos de actualización si se proporcionan campos críticos
      if (menuItemData.restaurantId || menuItemData.name || menuItemData.price || menuItemData.category) {
        const dataToValidate = {
          restaurantId: menuItemData.restaurantId || existingMenuItem.restaurantId,
          name: menuItemData.name || existingMenuItem.name,
          description: menuItemData.description || existingMenuItem.description,
          price: menuItemData.price !== undefined ? menuItemData.price : existingMenuItem.price,
          imageUrl: menuItemData.imageUrl || existingMenuItem.imageUrl,
          category: menuItemData.category || existingMenuItem.category,
          featured: menuItemData.featured !== undefined ? menuItemData.featured : existingMenuItem.featured,
          available: menuItemData.available !== undefined ? menuItemData.available : existingMenuItem.available,
        };
        
        await this.validateMenuItemData(dataToValidate);
      }

      // Normalizar datos
      const normalizedUpdateData: Partial<MenuItem> = {};
      
      if (menuItemData.restaurantId) normalizedUpdateData.restaurantId = menuItemData.restaurantId;
      if (menuItemData.name) normalizedUpdateData.name = menuItemData.name.trim();
      if (menuItemData.description !== undefined) {
        normalizedUpdateData.description = menuItemData.description?.trim() || 'Producto sin descripción';
      }
      if (menuItemData.price !== undefined) normalizedUpdateData.price = menuItemData.price;
      if (menuItemData.imageUrl) normalizedUpdateData.imageUrl = menuItemData.imageUrl;
      if (menuItemData.category) normalizedUpdateData.category = menuItemData.category.trim();
      if (menuItemData.featured !== undefined) normalizedUpdateData.featured = menuItemData.featured;
      if (menuItemData.available !== undefined) normalizedUpdateData.available = menuItemData.available;

      return await this.menuItemRepository.update(id, normalizedUpdateData);
    } catch (error) {
      logger.error(`Error in MenuItemService.updateMenuItem(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update menu item');
    }
  }

  async updateMenuItemAvailability(id: string, available: boolean): Promise<MenuItem | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid menu item ID provided');
      }

      if (typeof available !== 'boolean') {
        throw new Error('Availability must be a boolean value');
      }

      // Verificar que el item del menú existe
      const existingMenuItem = await this.menuItemRepository.findById(id);
      if (!existingMenuItem) {
        throw new Error('Menu item not found');
      }

      return await this.menuItemRepository.updateAvailability(id, available);
    } catch (error) {
      logger.error(`Error in MenuItemService.updateMenuItemAvailability(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update menu item availability');
    }
  }

  async deleteMenuItem(id: string): Promise<boolean> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid menu item ID provided');
      }

      // Verificar que el item del menú existe
      const existingMenuItem = await this.menuItemRepository.findById(id);
      if (!existingMenuItem) {
        throw new Error('Menu item not found');
      }

      // Aquí podrías agregar lógica adicional, como:
      // - Verificar que no esté en pedidos activos
      // - Mover a "archived" en lugar de eliminar permanentemente
      // - Notificar cambios al servicio de búsqueda

      return await this.menuItemRepository.delete(id);
    } catch (error) {
      logger.error(`Error in MenuItemService.deleteMenuItem(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to delete menu item');
    }
  }

  async getMenuStats(restaurantId?: string): Promise<{
    totalItems: number;
    availableItems: number;
    featuredItems: number;
    categoryBreakdown: { [category: string]: number };
    averagePrice: number;
    priceRange: { min: number; max: number };
  }> {
    try {
      let menuItems: MenuItem[];
      
      if (restaurantId) {
        menuItems = await this.menuItemRepository.findByRestaurantId(restaurantId);
      } else {
        menuItems = await this.menuItemRepository.findAll();
      }

      const availableItems = menuItems.filter(item => item.available);
      const featuredItems = menuItems.filter(item => item.featured);

      // Desglose por categoría
      const categoryBreakdown: { [category: string]: number } = {};
      menuItems.forEach(item => {
        categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
      });

      // Estadísticas de precios
      const prices = menuItems.map(item => item.price);
      const totalPrice = prices.reduce((sum, price) => sum + price, 0);
      const averagePrice = menuItems.length > 0 ? totalPrice / menuItems.length : 0;
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      return {
        totalItems: menuItems.length,
        availableItems: availableItems.length,
        featuredItems: featuredItems.length,
        categoryBreakdown,
        averagePrice: parseFloat(averagePrice.toFixed(2)),
        priceRange: { min: minPrice, max: maxPrice },
      };
    } catch (error) {
      logger.error(`Error in MenuItemService.getMenuStats(${restaurantId}):`, error);
      throw new Error('Failed to retrieve menu statistics');
    }
  }

  async getMenuItemsForOrder(itemIds: string[]): Promise<{
    items: MenuItem[];
    unavailableItems: string[];
  }> {
    try {
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        throw new Error('Valid item IDs array is required');
      }

      const items: MenuItem[] = [];
      const unavailableItems: string[] = [];

      for (const itemId of itemIds) {
        const menuItem = await this.menuItemRepository.findById(itemId);
        
        if (!menuItem) {
          unavailableItems.push(itemId);
          continue;
        }

        if (!menuItem.available) {
          unavailableItems.push(itemId);
          continue;
        }

        items.push(menuItem);
      }

      return { items, unavailableItems };
    } catch (error) {
      logger.error('Error in MenuItemService.getMenuItemsForOrder:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to retrieve menu items for order');
    }
  }

  async validateMenuItemData(data: Omit<MenuItem, 'id'>): Promise<void> {
    // Validar que el restaurante existe
    if (!data.restaurantId || typeof data.restaurantId !== 'string') {
      throw new Error('Valid restaurant ID is required');
    }

    const restaurant = await this.restaurantRepository.findById(data.restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Validar nombre
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    if (data.name.trim().length > 100) {
      throw new Error('Name cannot exceed 100 characters');
    }

    // Validar descripción
    if (data.description && typeof data.description === 'string' && data.description.trim().length > 500) {
      throw new Error('Description cannot exceed 500 characters');
    }

    // Validar precio
    if (typeof data.price !== 'number' || data.price < 0) {
      throw new Error('Price must be a positive number');
    }

    if (data.price > 1000) {
      throw new Error('Price cannot exceed $1000');
    }

    // Validar URL de imagen
    if (!data.imageUrl || typeof data.imageUrl !== 'string') {
      throw new Error('Image URL is required');
    }

    try {
      new URL(data.imageUrl);
    } catch {
      throw new Error('Invalid image URL format');
    }

    // Validar categoría
    if (!data.category || typeof data.category !== 'string' || data.category.trim().length < 2) {
      throw new Error('Category must be at least 2 characters long');
    }

    if (data.category.trim().length > 50) {
      throw new Error('Category cannot exceed 50 characters');
    }

    // Validar featured
    if (data.featured !== undefined && typeof data.featured !== 'boolean') {
      throw new Error('Featured must be a boolean value');
    }

    // Validar available
    if (data.available !== undefined && typeof data.available !== 'boolean') {
      throw new Error('Available must be a boolean value');
    }
  }
}