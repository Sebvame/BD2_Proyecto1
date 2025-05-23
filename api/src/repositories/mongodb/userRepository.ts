import { User } from '../../models';
import { UserRepository } from '../interfaces';
import { UserModel } from './schemas';
import { logger } from '../../utils/logger';

export class MongoUserRepository implements UserRepository {
  async findAll(): Promise<User[]> {
    try {
      const users = await UserModel.find();
      return users.map(user => user.toJSON() as User);
    } catch (error) {
      logger.error('Error in MongoUserRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const user = await UserModel.findById(id);
      return user ? user.toJSON() as User : null;
    } catch (error) {
      logger.error(`Error in MongoUserRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await UserModel.findOne({ email });
      return user ? user.toJSON() as User : null;
    } catch (error) {
      logger.error(`Error in MongoUserRepository.findByEmail(${email}):`, error);
      throw error;
    }
  }

  async findByRole(role: User['role']): Promise<User[]> {
    try {
      const users = await UserModel.find({ role });
      return users.map(user => user.toJSON() as User);
    } catch (error) {
      logger.error(`Error in MongoUserRepository.findByRole(${role}):`, error);
      throw error;
    }
  }

  async create(userData: Omit<User, 'id'>): Promise<User> {
    try {
      const newUser = new UserModel(userData);
      await newUser.save();
      return newUser.toJSON() as User;
    } catch (error) {
      logger.error('Error in MongoUserRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    try {
      const updatedUser = await UserModel.findByIdAndUpdate(
        id,
        userData,
        { new: true }
      );
      return updatedUser ? updatedUser.toJSON() as User : null;
    } catch (error) {
      logger.error(`Error in MongoUserRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await UserModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      logger.error(`Error in MongoUserRepository.delete(${id}):`, error);
      throw error;
    }
  }
}