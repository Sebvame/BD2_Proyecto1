import { Pool } from 'pg';
import { Restaurant } from '../../models';
import { RestaurantRepository } from '../interfaces';
import { logger } from '../../utils/logger';
import { getPgPool } from '../../utils/db';

export class PostgresRestaurantRepository implements RestaurantRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPgPool();
  }

  private mapRestaurant(row: any): Restaurant {
    return {
      id: row.id.toString(),
      name: row.name,
      description: row.description,
      address: row.address,
      phone: row.phone,
      imageUrl: row.image_url,
      cuisine: row.cuisine,
      rating: parseFloat(row.rating) || 0,
      priceRange: row.price_range as 1 | 2 | 3,
      openingHours: {
        opens: row.opening_hours_opens,
        closes: row.opening_hours_closes
      }
    };
  }

  async findAll(): Promise<Restaurant[]> {
    try {
      const result = await this.pool.query('SELECT * FROM restaurants ORDER BY name');
      return result.rows.map(this.mapRestaurant);
    } catch (error) {
      logger.error('Error in PostgresRestaurantRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Restaurant | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM restaurants WHERE id = $1',
        [id]
      );
      return result.rows.length ? this.mapRestaurant(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresRestaurantRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByCuisine(cuisine: string): Promise<Restaurant[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM restaurants WHERE cuisine ILIKE $1 ORDER BY name',
        [`%${cuisine}%`]
      );
      return result.rows.map(this.mapRestaurant);
    } catch (error) {
      logger.error(`Error in PostgresRestaurantRepository.findByCuisine(${cuisine}):`, error);
      throw error;
    }
  }

  async findByPriceRange(priceRange: Restaurant['priceRange']): Promise<Restaurant[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM restaurants WHERE price_range = $1 ORDER BY rating DESC',
        [priceRange]
      );
      return result.rows.map(this.mapRestaurant);
    } catch (error) {
      logger.error(`Error in PostgresRestaurantRepository.findByPriceRange(${priceRange}):`, error);
      throw error;
    }
  }

  async searchRestaurants(query: string): Promise<Restaurant[]> {
    try {
      const result = await this.pool.query(`
        SELECT *, 
               similarity(name, $1) + similarity(cuisine, $1) + similarity(description, $1) as relevance
        FROM restaurants 
        WHERE name ILIKE $2 OR cuisine ILIKE $2 OR description ILIKE $2
        ORDER BY relevance DESC, rating DESC
      `, [query, `%${query}%`]);
      
      return result.rows.map(this.mapRestaurant);
    } catch (error) {
      logger.error(`Error in PostgresRestaurantRepository.searchRestaurants(${query}):`, error);
      throw error;
    }
  }

  async create(restaurantData: Omit<Restaurant, 'id'>): Promise<Restaurant> {
    try {
      const result = await this.pool.query(`
        INSERT INTO restaurants (
          name, description, address, phone, image_url, cuisine, 
          rating, price_range, opening_hours_opens, opening_hours_closes
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING *
      `, [
        restaurantData.name,
        restaurantData.description,
        restaurantData.address,
        restaurantData.phone,
        restaurantData.imageUrl,
        restaurantData.cuisine,
        restaurantData.rating,
        restaurantData.priceRange,
        restaurantData.openingHours.opens,
        restaurantData.openingHours.closes
      ]);
      
      return this.mapRestaurant(result.rows[0]);
    } catch (error) {
      logger.error('Error in PostgresRestaurantRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, restaurantData: Partial<Restaurant>): Promise<Restaurant | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (restaurantData.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(restaurantData.name);
      }
      if (restaurantData.description) {
        fields.push(`description = $${paramIndex++}`);
        values.push(restaurantData.description);
      }
      if (restaurantData.address) {
        fields.push(`address = $${paramIndex++}`);
        values.push(restaurantData.address);
      }
      if (restaurantData.phone) {
        fields.push(`phone = $${paramIndex++}`);
        values.push(restaurantData.phone);
      }
      if (restaurantData.imageUrl) {
        fields.push(`image_url = $${paramIndex++}`);
        values.push(restaurantData.imageUrl);
      }
      if (restaurantData.cuisine) {
        fields.push(`cuisine = $${paramIndex++}`);
        values.push(restaurantData.cuisine);
      }
      if (restaurantData.rating !== undefined) {
        fields.push(`rating = $${paramIndex++}`);
        values.push(restaurantData.rating);
      }
      if (restaurantData.priceRange) {
        fields.push(`price_range = $${paramIndex++}`);
        values.push(restaurantData.priceRange);
      }
      if (restaurantData.openingHours?.opens) {
        fields.push(`opening_hours_opens = $${paramIndex++}`);
        values.push(restaurantData.openingHours.opens);
      }
      if (restaurantData.openingHours?.closes) {
        fields.push(`opening_hours_closes = $${paramIndex++}`);
        values.push(restaurantData.openingHours.closes);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const query = `
        UPDATE restaurants 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows.length ? this.mapRestaurant(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresRestaurantRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM restaurants WHERE id = $1 RETURNING id',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error in PostgresRestaurantRepository.delete(${id}):`, error);
      throw error;
    }
  }
}