import { Pool } from 'pg';
import { Order, OrderItem } from '../../models';
import { OrderRepository } from '../interfaces';
import { logger } from '../../utils/logger';
import { getPgPool } from '../../utils/db';

export class PostgresOrderRepository implements OrderRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPgPool();
  }

  private async mapOrder(orderRow: any): Promise<Order> {
    // Obtener los items del pedido
    const itemsResult = await this.pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [orderRow.id]
    );

    const items: OrderItem[] = itemsResult.rows.map(item => ({
      menuItemId: item.menu_item_id.toString(),
      name: item.name,
      price: parseFloat(item.price),
      quantity: item.quantity,
      specialInstructions: item.special_instructions
    }));

    return {
      id: orderRow.id.toString(),
      userId: orderRow.user_id.toString(),
      restaurantId: orderRow.restaurant_id.toString(),
      items,
      status: orderRow.status as Order['status'],
      total: parseFloat(orderRow.total),
      createdAt: new Date(orderRow.created_at).toISOString(),
      pickupTime: orderRow.pickup_time
    };
  }

  async findAll(): Promise<Order[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM orders ORDER BY created_at DESC'
      );
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error('Error in PostgresOrderRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM orders WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return await this.mapOrder(result.rows[0]);
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Order[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findByUserId(${userId}):`, error);
      throw error;
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM orders WHERE restaurant_id = $1 ORDER BY created_at DESC',
        [restaurantId]
      );
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findByRestaurantId(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByStatus(status: Order['status']): Promise<Order[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC',
        [status]
      );
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findByStatus(${status}):`, error);
      throw error;
    }
  }

  async updateStatus(id: string, status: Order['status']): Promise<Order | null> {
    try {
      const result = await this.pool.query(
        'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return await this.mapOrder(result.rows[0]);
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.updateStatus(${id}):`, error);
      throw error;
    }
  }

  async create(orderData: Omit<Order, 'id'>): Promise<Order> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Crear el pedido
      const orderResult = await client.query(`
        INSERT INTO orders (user_id, restaurant_id, status, total, pickup_time) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *
      `, [
        orderData.userId,
        orderData.restaurantId,
        orderData.status,
        orderData.total,
        orderData.pickupTime
      ]);
      
      const orderId = orderResult.rows[0].id;
      
      // Crear los items del pedido
      for (const item of orderData.items) {
        await client.query(`
          INSERT INTO order_items (
            order_id, menu_item_id, name, price, quantity, special_instructions
          ) 
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          orderId,
          item.menuItemId,
          item.name,
          item.price,
          item.quantity,
          item.specialInstructions
        ]);
      }
      
      await client.query('COMMIT');
      
      return await this.mapOrder(orderResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error in PostgresOrderRepository.create:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, orderData: Partial<Order>): Promise<Order | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (orderData.userId) {
        fields.push(`user_id = $${paramIndex++}`);
        values.push(orderData.userId);
      }
      if (orderData.restaurantId) {
        fields.push(`restaurant_id = $${paramIndex++}`);
        values.push(orderData.restaurantId);
      }
      if (orderData.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(orderData.status);
      }
      if (orderData.total !== undefined) {
        fields.push(`total = $${paramIndex++}`);
        values.push(orderData.total);
      }
      if (orderData.pickupTime !== undefined) {
        fields.push(`pickup_time = $${paramIndex++}`);
        values.push(orderData.pickupTime);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const query = `
        UPDATE orders 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return await this.mapOrder(result.rows[0]);
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Eliminar items del pedido (por foreign key cascade esto debería ser automático)
      await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
      
      // Eliminar el pedido
      const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING id', [id]);
      
      await client.query('COMMIT');
      
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error in PostgresOrderRepository.delete(${id}):`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  async findActiveOrders(restaurantId: string): Promise<Order[]> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM orders 
        WHERE restaurant_id = $1 
        AND status IN ('pending', 'preparing', 'ready')
        ORDER BY created_at
      `, [restaurantId]);
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findActiveOrders(${restaurantId}):`, error);
      throw error;
    }
  }

  async findOrdersByDateRange(restaurantId: string, startDate: string, endDate: string): Promise<Order[]> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM orders 
        WHERE restaurant_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
        ORDER BY created_at DESC
      `, [restaurantId, startDate, endDate]);
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findOrdersByDateRange(${restaurantId}, ${startDate}, ${endDate}):`, error);
      throw error;
    }
  }

  async calculateTotalRevenue(restaurantId: string, startDate?: string, endDate?: string): Promise<number> {
    try {
      let query = `
        SELECT COALESCE(SUM(total), 0) as total_revenue 
        FROM orders 
        WHERE restaurant_id = $1 AND status = 'completed'
      `;
      const params = [restaurantId];

      if (startDate && endDate) {
        query += ' AND created_at >= $2 AND created_at <= $3';
        params.push(startDate, endDate);
      }

      const result = await this.pool.query(query, params);
      return parseFloat(result.rows[0].total_revenue);
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.calculateTotalRevenue(${restaurantId}):`, error);
      throw error;
    }
  }

  async updatePickupTime(id: string, pickupTime: string): Promise<Order | null> {
    try {
      const result = await this.pool.query(
        'UPDATE orders SET pickup_time = $1 WHERE id = $2 RETURNING *',
        [pickupTime, id]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return await this.mapOrder(result.rows[0]);
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.updatePickupTime(${id}):`, error);
      throw error;
    }
  }

  async findRecentOrdersByUser(userId: string, limit: number = 10): Promise<Order[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      
      const orders = await Promise.all(
        result.rows.map(row => this.mapOrder(row))
      );
      
      return orders;
    } catch (error) {
      logger.error(`Error in PostgresOrderRepository.findRecentOrdersByUser(${userId}):`, error);
      throw error;
    }
  }
}