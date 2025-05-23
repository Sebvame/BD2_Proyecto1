import { Restaurant } from '../../models';
import { RestaurantRepository } from '../interfaces';
import { RestaurantModel } from './schemas';
import { logger } from '../../utils/logger';

export class MongoRestaurantRepository implements RestaurantRepository {
  async findAll(): Promise<Restaurant[]> {
    try {
      const restaurants = await RestaurantModel.find();
      return restaurants.map(restaurant => restaurant.toJSON() as Restaurant);
    } catch (error) {
      logger.error('Error in MongoRestaurantRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Restaurant | null> {
    try {
      const restaurant = await RestaurantModel.findById(id);
      return restaurant ? restaurant.toJSON() as Restaurant : null;
    } catch (error) {
      logger.error(`Error in MongoRestaurantRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByCuisine(cuisine: string): Promise<Restaurant[]> {
    try {
      const restaurants = await RestaurantModel.find({ 
        cuisine: { $regex: cuisine, $options: 'i' } 
      });
      return restaurants.map(restaurant => restaurant.toJSON() as Restaurant);
    } catch (error) {
      logger.error(`Error in MongoRestaurantRepository.findByCuisine(${cuisine}):`, error);
      throw error;
    }
  }

  async findByPriceRange(priceRange: Restaurant['priceRange']): Promise<Restaurant[]> {
    try {
      const restaurants = await RestaurantModel.find({ priceRange });
      return restaurants.map(restaurant => restaurant.toJSON() as Restaurant);
    } catch (error) {
      logger.error(`Error in MongoRestaurantRepository.findByPriceRange(${priceRange}):`, error);
      throw error;
    }
  }

  async searchRestaurants(query: string): Promise<Restaurant[]> {
    try {
      const restaurants = await RestaurantModel.find({
        $text: { $search: query }
      }).sort({ score: { $meta: 'textScore' } });
      
      return restaurants.map(restaurant => restaurant.toJSON() as Restaurant);
    } catch (error) {
      logger.error(`Error in MongoRestaurantRepository.searchRestaurants(${query}):`, error);
      throw error;
    }
  }

  async create(restaurantData: Omit<Restaurant, 'id'>): Promise<Restaurant> {
    try {
      const newRestaurant = new RestaurantModel(restaurantData);
      await newRestaurant.save();
      return newRestaurant.toJSON() as Restaurant;
    } catch (error) {
      logger.error('Error in MongoRestaurantRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, restaurantData: Partial<Restaurant>): Promise<Restaurant | null> {
    try {
      const updatedRestaurant = await RestaurantModel.findByIdAndUpdate(
        id,
        restaurantData,
        { new: true }
      );
      return updatedRestaurant ? updatedRestaurant.toJSON() as Restaurant : null;
    } catch (error) {
      logger.error(`Error in MongoRestaurantRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await RestaurantModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      logger.error(`Error in MongoRestaurantRepository.delete(${id}):`, error);
      throw error;
    }
  }
}