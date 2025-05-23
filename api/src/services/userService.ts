import { User } from '../models';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { logger } from '../utils/logger';

export class UserService {
  private userRepository = RepositoryFactory.getUserRepository();

  async getAllUsers(): Promise<User[]> {
    try {
      return await this.userRepository.findAll();
    } catch (error) {
      logger.error('Error in UserService.getAllUsers:', error);
      throw new Error('Failed to retrieve users');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid user ID provided');
      }

      return await this.userRepository.findById(id);
    } catch (error) {
      logger.error(`Error in UserService.getUserById(${id}):`, error);
      throw new Error('Failed to retrieve user');
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      if (!email || typeof email !== 'string') {
        throw new Error('Invalid email provided');
      }

      // Validar formato de email básico
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      return await this.userRepository.findByEmail(email);
    } catch (error) {
      logger.error(`Error in UserService.getUserByEmail(${email}):`, error);
      throw new Error('Failed to retrieve user by email');
    }
  }

  async getUsersByRole(role: User['role']): Promise<User[]> {
    try {
      if (!role || !['customer', 'restaurant-admin'].includes(role)) {
        throw new Error('Invalid role provided');
      }

      return await this.userRepository.findByRole(role);
    } catch (error) {
      logger.error(`Error in UserService.getUsersByRole(${role}):`, error);
      throw new Error('Failed to retrieve users by role');
    }
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    try {
      // Validaciones de negocio
      this.validateUserData(userData);

      // Verificar que el email no esté en uso
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('Email is already registered');
      }

      // Normalizar datos
      const normalizedUserData = {
        ...userData,
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        role: userData.role || 'customer' as const,
        createdAt: userData.createdAt || new Date().toISOString(),
      };

      return await this.userRepository.create(normalizedUserData);
    } catch (error) {
      logger.error('Error in UserService.createUser:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid user ID provided');
      }

      // Verificar que el usuario existe
      const existingUser = await this.userRepository.findById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Validar datos de actualización
      if (userData.email || userData.name || userData.role) {
        this.validateUserData({
          name: userData.name || existingUser.name,
          email: userData.email || existingUser.email,
          role: userData.role || existingUser.role,
          createdAt: existingUser.createdAt,
        });
      }

      // Si se está actualizando el email, verificar que no esté en uso
      if (userData.email && userData.email !== existingUser.email) {
        const userWithEmail = await this.userRepository.findByEmail(userData.email);
        if (userWithEmail) {
          throw new Error('Email is already in use');
        }
      }

      // Normalizar datos
      const normalizedUpdateData: Partial<User> = {};
      
      if (userData.name) {
        normalizedUpdateData.name = userData.name.trim();
      }
      
      if (userData.email) {
        normalizedUpdateData.email = userData.email.toLowerCase().trim();
      }
      
      if (userData.role) {
        normalizedUpdateData.role = userData.role;
      }

      return await this.userRepository.update(id, normalizedUpdateData);
    } catch (error) {
      logger.error(`Error in UserService.updateUser(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid user ID provided');
      }

      // Verificar que el usuario existe
      const existingUser = await this.userRepository.findById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Aquí podrías agregar lógica adicional, como:
      // - Verificar que no tenga reservas o pedidos activos
      // - Enviar notificación de eliminación
      // - Limpiar datos relacionados

      return await this.userRepository.delete(id);
    } catch (error) {
      logger.error(`Error in UserService.deleteUser(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to delete user');
    }
  }

  async validateUserAccess(currentUserId: string, targetUserId: string, userRole: string[]): Promise<boolean> {
    try {
      // Los admins pueden acceder a cualquier usuario
      if (userRole.includes('restaurant-admin')) {
        return true;
      }

      // Los usuarios solo pueden acceder a su propia información
      return currentUserId === targetUserId;
    } catch (error) {
      logger.error('Error in UserService.validateUserAccess:', error);
      return false;
    }
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    customerCount: number;
    adminCount: number;
    recentRegistrations: number;
  }> {
    try {
      const allUsers = await this.userRepository.findAll();
      const customers = await this.userRepository.findByRole('customer');
      const admins = await this.userRepository.findByRole('restaurant-admin');
      
      // Calcular registros recientes (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentRegistrations = allUsers.filter(user => 
        new Date(user.createdAt) >= thirtyDaysAgo
      ).length;

      return {
        totalUsers: allUsers.length,
        customerCount: customers.length,
        adminCount: admins.length,
        recentRegistrations,
      };
    } catch (error) {
      logger.error('Error in UserService.getUserStats:', error);
      throw new Error('Failed to retrieve user statistics');
    }
  }

  private validateUserData(userData: Pick<User, 'name' | 'email' | 'role' | 'createdAt'>): void {
    // Validar nombre
    if (!userData.name || typeof userData.name !== 'string' || userData.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }

    if (userData.name.trim().length > 100) {
      throw new Error('Name cannot exceed 100 characters');
    }

    // Validar email
    if (!userData.email || typeof userData.email !== 'string') {
      throw new Error('Valid email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validar rol
    if (!userData.role || !['customer', 'restaurant-admin'].includes(userData.role)) {
      throw new Error('Role must be either customer or restaurant-admin');
    }

    // Validar fecha de creación si se proporciona
    if (userData.createdAt && typeof userData.createdAt === 'string') {
      const createdAtDate = new Date(userData.createdAt);
      if (isNaN(createdAtDate.getTime())) {
        throw new Error('Invalid creation date format');
      }
      
      // No permitir fechas futuras
      if (createdAtDate > new Date()) {
        throw new Error('Creation date cannot be in the future');
      }
    }
  }
}