import { config } from '../config';
import { UserRepository, RestaurantRepository, MenuItemRepository, ReservationRepository, OrderRepository } from './interfaces';
import { MongoUserRepository } from './mongodb/userRepository';
import { PostgresUserRepository } from './postgresql/userRepository';
import { MongoRestaurantRepository } from './mongodb/restaurantRepository';
import { PostgresRestaurantRepository } from './postgresql/restaurantRepository';
import { MongoMenuItemRepository } from './mongodb/menuItemRepository';
import { PostgresMenuItemRepository } from './postgresql/menuItemRepository';
import { MongoReservationRepository } from './mongodb/reservationRepository';
import { PostgresReservationRepository } from './postgresql/reservationRepository';
import { MongoOrderRepository } from './mongodb/orderRepository';
import { PostgresOrderRepository } from './postgresql/orderRepository';


export class RepositoryFactory {

  static getUserRepository(): UserRepository {
    if (config.DB_TYPE === 'mongodb') {
      return new MongoUserRepository();
    } else if (config.DB_TYPE === 'postgresql') {
      return new PostgresUserRepository();
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getRestaurantRepository(): RestaurantRepository {
    if (config.DB_TYPE === 'mongodb') {
      // return new MongoRestaurantRepository();
      throw new Error('MongoDB Restaurant Repository not implemented yet');
    } else if (config.DB_TYPE === 'postgresql') {
      // return new PostgresRestaurantRepository();
      throw new Error('PostgreSQL Restaurant Repository not implemented yet');
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getMenuItemRepository(): MenuItemRepository {
    if (config.DB_TYPE === 'mongodb') {
      // return new MongoMenuItemRepository();
      throw new Error('MongoDB MenuItem Repository not implemented yet');
    } else if (config.DB_TYPE === 'postgresql') {
      // return new PostgresMenuItemRepository();
      throw new Error('PostgreSQL MenuItem Repository not implemented yet');
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getReservationRepository(): ReservationRepository {
    if (config.DB_TYPE === 'mongodb') {
      // return new MongoReservationRepository();
      throw new Error('MongoDB Reservation Repository not implemented yet');
    } else if (config.DB_TYPE === 'postgresql') {
      // return new PostgresReservationRepository();
      throw new Error('PostgreSQL Reservation Repository not implemented yet');
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getOrderRepository(): OrderRepository {
    if (config.DB_TYPE === 'mongodb') {
      // return new MongoOrderRepository();
      throw new Error('MongoDB Order Repository not implemented yet');
    } else if (config.DB_TYPE === 'postgresql') {
      // return new PostgresOrderRepository();
      throw new Error('PostgreSQL Order Repository not implemented yet');
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }
}