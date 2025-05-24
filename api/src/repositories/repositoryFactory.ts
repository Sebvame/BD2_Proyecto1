import { config } from '../config';
import { UserRepository, RestaurantRepository, MenuItemRepository, ReservationRepository, OrderRepository } from './interfaces';

// MongoDB Repositories
import { MongoUserRepository } from './mongodb/userRepository';
import { MongoRestaurantRepository } from './mongodb/restaurantRepository';
import { MongoMenuItemRepository } from './mongodb/menuItemRepository';
import { MongoReservationRepository } from './mongodb/reservationRepository';
import { MongoOrderRepository } from './mongodb/orderRepository';

// PostgreSQL Repositories  
import { PostgresUserRepository } from './postgresql/userRepository';
import { PostgresRestaurantRepository } from './postgresql/restaurantRepository';
import { PostgresMenuItemRepository } from './postgresql/menuItemRepository';
import { PostgresReservationRepository } from './postgresql/reservationRepository';
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
      return new MongoRestaurantRepository();
    } else if (config.DB_TYPE === 'postgresql') {
      return new PostgresRestaurantRepository();
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getMenuItemRepository(): MenuItemRepository {
    if (config.DB_TYPE === 'mongodb') {
      return new MongoMenuItemRepository();
    } else if (config.DB_TYPE === 'postgresql') {
      return new PostgresMenuItemRepository();
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getReservationRepository(): ReservationRepository {
    if (config.DB_TYPE === 'mongodb') {
      return new MongoReservationRepository();
    } else if (config.DB_TYPE === 'postgresql') {
      return new PostgresReservationRepository();
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  static getOrderRepository(): OrderRepository {
    if (config.DB_TYPE === 'mongodb') {
      return new MongoOrderRepository();
    } else if (config.DB_TYPE === 'postgresql') {
      return new PostgresOrderRepository();
    } else {
      throw new Error(`Unsupported database type: ${config.DB_TYPE}`);
    }
  }

  // Método para obtener todos los repositorios de una vez
  static getAllRepositories() {
    return {
      user: this.getUserRepository(),
      restaurant: this.getRestaurantRepository(),
      menuItem: this.getMenuItemRepository(),
      reservation: this.getReservationRepository(),
      order: this.getOrderRepository()
    };
  }

  // Método para verificar la configuración de la base de datos
  static validateConfiguration() {
    const supportedDatabases = ['mongodb', 'postgresql'];
    
    if (!config.DB_TYPE || !supportedDatabases.includes(config.DB_TYPE)) {
      throw new Error(`DB_TYPE must be one of: ${supportedDatabases.join(', ')}`);
    }

    // Verificar que las URIs estén configuradas
    if (config.DB_TYPE === 'mongodb' && !config.MONGODB_URI) {
      throw new Error('MONGODB_URI is required when DB_TYPE is mongodb');
    }

    if (config.DB_TYPE === 'postgresql' && !config.POSTGRES_URI) {
      throw new Error('POSTGRES_URI is required when DB_TYPE is postgresql');
    }
  }
}