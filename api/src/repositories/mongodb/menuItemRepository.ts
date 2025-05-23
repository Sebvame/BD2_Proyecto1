import { MenuItem } from '../../models';
import { MenuItemRepository } from '../interfaces';
import { MenuItemModel } from './schemas';
import { logger } from '../../utils/logger';

export class MongoMenuItemRepository implements MenuItemRepository {
  async findAll(): Promise<MenuItem[]> {
    try {
      const menuItems = await MenuItemModel.find();
      return menuItems.map(item => item.toJSON() as MenuItem);
    } catch (error) {
      logger.error('Error in MongoMenuItemRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<MenuItem | null> {
    try {
      const menuItem = await MenuItemModel.findById(id);
      return menuItem ? menuItem.toJSON() as MenuItem : null;
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<MenuItem[]> {
    try {
      const menuItems = await MenuItemModel.find({ restaurantId });
      return menuItems.map(item => item.toJSON() as MenuItem);
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.findByRestaurantId(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByCategory(category: string): Promise<MenuItem[]> {
    try {
      const menuItems = await MenuItemModel.find({ 
        category: { $regex: category, $options: 'i' } 
      });
      return menuItems.map(item => item.toJSON() as MenuItem);
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.findByCategory(${category}):`, error);
      throw error;
    }
  }

  async findFeaturedItems(): Promise<MenuItem[]> {
    try {
      const menuItems = await MenuItemModel.find({ featured: true, available: true });
      return menuItems.map(item => item.toJSON() as MenuItem);
    } catch (error) {
      logger.error('Error in MongoMenuItemRepository.findFeaturedItems:', error);
      throw error;
    }
  }

  async findByRestaurantAndCategory(restaurantId: string, category: string): Promise<MenuItem[]> {
    try {
      const menuItems = await MenuItemModel.find({ 
        restaurantId,
        category: { $regex: category, $options: 'i' }
      });
      return menuItems.map(item => item.toJSON() as MenuItem);
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.findByRestaurantAndCategory(${restaurantId}, ${category}):`, error);
      throw error;
    }
  }

  async create(menuItemData: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    try {
      // Asegurar que tenga descripción por defecto
      const itemWithDefaults = {
        ...menuItemData,
        description: menuItemData.description || 'Producto sin descripción'
      };
      
      const newMenuItem = new MenuItemModel(itemWithDefaults);
      await newMenuItem.save();
      return newMenuItem.toJSON() as MenuItem;
    } catch (error) {
      logger.error('Error in MongoMenuItemRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, menuItemData: Partial<MenuItem>): Promise<MenuItem | null> {
    try {
      const updatedMenuItem = await MenuItemModel.findByIdAndUpdate(
        id,
        menuItemData,
        { new: true }
      );
      return updatedMenuItem ? updatedMenuItem.toJSON() as MenuItem : null;
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await MenuItemModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.delete(${id}):`, error);
      throw error;
    }
  }

  async findAvailableByRestaurant(restaurantId: string): Promise<MenuItem[]> {
    try {
      const menuItems = await MenuItemModel.find({ 
        restaurantId, 
        available: true 
      }).sort({ featured: -1, name: 1 });
      return menuItems.map(item => item.toJSON() as MenuItem);
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.findAvailableByRestaurant(${restaurantId}):`, error);
      throw error;
    }
  }

  async updateAvailability(id: string, available: boolean): Promise<MenuItem | null> {
    try {
      const updatedMenuItem = await MenuItemModel.findByIdAndUpdate(
        id,
        { available },
        { new: true }
      );
      return updatedMenuItem ? updatedMenuItem.toJSON() as MenuItem : null;
    } catch (error) {
      logger.error(`Error in MongoMenuItemRepository.updateAvailability(${id}):`, error);
      throw error;
    }
  }
}