import { Order } from '../../models';
import { OrderRepository } from '../interfaces';
import { OrderModel } from './schemas';
import { logger } from '../../utils/logger';

export class MongoOrderRepository implements OrderRepository {
  async findAll(): Promise<Order[]> {
    try {
      const orders = await OrderModel.find().sort({ createdAt: -1 });
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error('Error in MongoOrderRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Order | null> {
    try {
      const order = await OrderModel.findById(id);
      return order ? order.toJSON() as Order : null;
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Order[]> {
    try {
      const orders = await OrderModel.find({ userId }).sort({ createdAt: -1 });
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findByUserId(${userId}):`, error);
      throw error;
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<Order[]> {
    try {
      const orders = await OrderModel.find({ restaurantId }).sort({ createdAt: -1 });
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findByRestaurantId(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByStatus(status: Order['status']): Promise<Order[]> {
    try {
      const orders = await OrderModel.find({ status }).sort({ createdAt: -1 });
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findByStatus(${status}):`, error);
      throw error;
    }
  }

  async updateStatus(id: string, status: Order['status']): Promise<Order | null> {
    try {
      const updatedOrder = await OrderModel.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );
      return updatedOrder ? updatedOrder.toJSON() as Order : null;
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.updateStatus(${id}):`, error);
      throw error;
    }
  }

  async create(orderData: Omit<Order, 'id'>): Promise<Order> {
    try {
      const newOrder = new OrderModel(orderData);
      await newOrder.save();
      return newOrder.toJSON() as Order;
    } catch (error) {
      logger.error('Error in MongoOrderRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, orderData: Partial<Order>): Promise<Order | null> {
    try {
      const updatedOrder = await OrderModel.findByIdAndUpdate(
        id,
        orderData,
        { new: true }
      );
      return updatedOrder ? updatedOrder.toJSON() as Order : null;
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await OrderModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.delete(${id}):`, error);
      throw error;
    }
  }

  async findActiveOrders(restaurantId: string): Promise<Order[]> {
    try {
      const orders = await OrderModel.find({
        restaurantId,
        status: { $in: ['pending', 'preparing', 'ready'] }
      }).sort({ createdAt: 1 });
      
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findActiveOrders(${restaurantId}):`, error);
      throw error;
    }
  }

  async findOrdersByDateRange(restaurantId: string, startDate: string, endDate: string): Promise<Order[]> {
    try {
      const orders = await OrderModel.find({
        restaurantId,
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ createdAt: -1 });
      
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findOrdersByDateRange(${restaurantId}, ${startDate}, ${endDate}):`, error);
      throw error;
    }
  }

  async calculateTotalRevenue(restaurantId: string, startDate?: string, endDate?: string): Promise<number> {
    try {
      const match: any = {
        restaurantId,
        status: { $in: ['completed'] }
      };

      if (startDate && endDate) {
        match.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }

      const result = await OrderModel.aggregate([
        { $match: match },
        { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
      ]);
      
      return result.length > 0 ? result[0].totalRevenue : 0;
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.calculateTotalRevenue(${restaurantId}):`, error);
      throw error;
    }
  }

  async updatePickupTime(id: string, pickupTime: string): Promise<Order | null> {
    try {
      const updatedOrder = await OrderModel.findByIdAndUpdate(
        id,
        { pickupTime },
        { new: true }
      );
      return updatedOrder ? updatedOrder.toJSON() as Order : null;
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.updatePickupTime(${id}):`, error);
      throw error;
    }
  }

  async findRecentOrdersByUser(userId: string, limit: number = 10): Promise<Order[]> {
    try {
      const orders = await OrderModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return orders.map(order => order.toJSON() as Order);
    } catch (error) {
      logger.error(`Error in MongoOrderRepository.findRecentOrdersByUser(${userId}):`, error);
      throw error;
    }
  }
}