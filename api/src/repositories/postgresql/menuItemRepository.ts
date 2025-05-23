import { Pool } from 'pg';
import { MenuItem } from '../../models';
import { MenuItemRepository } from '../interfaces';
import { logger } from '../../utils/logger';
import { getPgPool } from '../../utils/db';

export class PostgresMenuItemRepository implements MenuItemRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPgPool();
  }

  private mapMenuItem(row: any): MenuItem {
    return {
      id: row.id.toString(),
      restaurantId: row.restaurant_id.toString(),
      name: row.name,
      description: row.description || 'Producto sin descripción',
      price: parseFloat(row.price),
      imageUrl: row.image_url,
      category: row.category,
      featured: row.featured,
      available: row.available
    };
  }

  async findAll(): Promise<MenuItem[]> {
    try {
      const result = await this.pool.query('SELECT * FROM menu_items ORDER BY name');
      return result.rows.map(this.mapMenuItem);
    } catch (error) {
      logger.error('Error in PostgresMenuItemRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<MenuItem | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM menu_items WHERE id = $1',
        [id]
      );
      return result.rows.length ? this.mapMenuItem(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<MenuItem[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM menu_items WHERE restaurant_id = $1 ORDER BY featured DESC, name',
        [restaurantId]
      );
      return result.rows.map(this.mapMenuItem);
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.findByRestaurantId(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByCategory(category: string): Promise<MenuItem[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM menu_items WHERE category ILIKE $1 ORDER BY name',
        [`%${category}%`]
      );
      return result.rows.map(this.mapMenuItem);
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.findByCategory(${category}):`, error);
      throw error;
    }
  }

  async findFeaturedItems(): Promise<MenuItem[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM menu_items WHERE featured = true AND available = true ORDER BY name'
      );
      return result.rows.map(this.mapMenuItem);
    } catch (error) {
      logger.error('Error in PostgresMenuItemRepository.findFeaturedItems:', error);
      throw error;
    }
  }

  async findByRestaurantAndCategory(restaurantId: string, category: string): Promise<MenuItem[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM menu_items WHERE restaurant_id = $1 AND category ILIKE $2 ORDER BY featured DESC, name',
        [restaurantId, `%${category}%`]
      );
      return result.rows.map(this.mapMenuItem);
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.findByRestaurantAndCategory(${restaurantId}, ${category}):`, error);
      throw error;
    }
  }

  async create(menuItemData: Omit<MenuItem, 'id'>): Promise<MenuItem> {
    try {
      const result = await this.pool.query(`
        INSERT INTO menu_items (
          restaurant_id, name, description, price, image_url, 
          category, featured, available
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `, [
        menuItemData.restaurantId,
        menuItemData.name,
        menuItemData.description || 'Producto sin descripción',
        menuItemData.price,
        menuItemData.imageUrl,
        menuItemData.category,
        menuItemData.featured,
        menuItemData.available
      ]);
      
      return this.mapMenuItem(result.rows[0]);
    } catch (error) {
      logger.error('Error in PostgresMenuItemRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, menuItemData: Partial<MenuItem>): Promise<MenuItem | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (menuItemData.restaurantId) {
        fields.push(`restaurant_id = $${paramIndex++}`);
        values.push(menuItemData.restaurantId);
      }
      if (menuItemData.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(menuItemData.name);
      }
      if (menuItemData.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(menuItemData.description || 'Producto sin descripción');
      }
      if (menuItemData.price !== undefined) {
        fields.push(`price = $${paramIndex++}`);
        values.push(menuItemData.price);
      }
      if (menuItemData.imageUrl) {
        fields.push(`image_url = $${paramIndex++}`);
        values.push(menuItemData.imageUrl);
      }
      if (menuItemData.category) {
        fields.push(`category = $${paramIndex++}`);
        values.push(menuItemData.category);
      }
      if (menuItemData.featured !== undefined) {
        fields.push(`featured = $${paramIndex++}`);
        values.push(menuItemData.featured);
      }
      if (menuItemData.available !== undefined) {
        fields.push(`available = $${paramIndex++}`);
        values.push(menuItemData.available);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const query = `
        UPDATE menu_items 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows.length ? this.mapMenuItem(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM menu_items WHERE id = $1 RETURNING id',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.delete(${id}):`, error);
      throw error;
    }
  }

  async findAvailableByRestaurant(restaurantId: string): Promise<MenuItem[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM menu_items WHERE restaurant_id = $1 AND available = true ORDER BY featured DESC, name',
        [restaurantId]
      );
      return result.rows.map(this.mapMenuItem);
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.findAvailableByRestaurant(${restaurantId}):`, error);
      throw error;
    }
  }

  async updateAvailability(id: string, available: boolean): Promise<MenuItem | null> {
    try {
      const result = await this.pool.query(
        'UPDATE menu_items SET available = $1 WHERE id = $2 RETURNING *',
        [available, id]
      );
      return result.rows.length ? this.mapMenuItem(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresMenuItemRepository.updateAvailability(${id}):`, error);
      throw error;
    }
  }
}