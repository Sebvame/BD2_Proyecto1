import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MongoUserRepository } from '../../../repositories/mongodb/userRepository';
import { UserModel } from '../../../repositories/mongodb/schemas';

// Mock del modelo de mongoose
vi.mock('../../../repositories/mongodb/schemas', () => {
  return {
    UserModel: {
      find: vi.fn(),
      findById: vi.fn(),
      findOne: vi.fn(),
      prototype: {
        save: vi.fn(),
      },
      findByIdAndUpdate: vi.fn(),
      findByIdAndDelete: vi.fn(),
    },
  };
});

// Mock del logger
vi.mock('../../../utils/logger', () => {
  return {
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  };
});

describe('MongoUserRepository', () => {
  let repository: MongoUserRepository;
  
  const mockUser = {
    _id: '60d21b4667d0d8992e610c85',
    name: 'Test User',
    email: 'test@example.com',
    role: 'customer',
    createdAt: '2023-01-01T00:00:00.000Z',
    toJSON: () => ({
      id: '60d21b4667d0d8992e610c85',
      name: 'Test User',
      email: 'test@example.com',
      role: 'customer',
      createdAt: '2023-01-01T00:00:00.000Z',
    }),
  };
  
  beforeEach(() => {
    repository = new MongoUserRepository();
    vi.clearAllMocks();
  });
  
  describe('findAll', () => {
    it('should return all users', async () => {
      // Configurar mock
      (UserModel.find as any).mockResolvedValue([mockUser]);
      
      // Ejecutar método
      const result = await repository.findAll();
      
      // Verificaciones
      expect(UserModel.find).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '60d21b4667d0d8992e610c85',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });
    
    it('should handle errors', async () => {
      // Configurar mock para lanzar error
      const error = new Error('Database error');
      (UserModel.find as any).mockRejectedValue(error);
      
      // Verificar que se lanza el error
      await expect(repository.findAll()).rejects.toThrow('Database error');
    });
  });
  
  describe('findById', () => {
    it('should return user by id', async () => {
      // Configurar mock
      (UserModel.findById as any).mockResolvedValue(mockUser);
      
      // Ejecutar método
      const result = await repository.findById('60d21b4667d0d8992e610c85');
      
      // Verificaciones
      expect(UserModel.findById).toHaveBeenCalledWith('60d21b4667d0d8992e610c85');
      expect(result).toEqual({
        id: '60d21b4667d0d8992e610c85',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });
    
    it('should return null if user not found', async () => {
      // Configurar mock
      (UserModel.findById as any).mockResolvedValue(null);
      
      // Ejecutar método
      const result = await repository.findById('60d21b4667d0d8992e610c85');
      
      // Verificaciones
      expect(result).toBeNull();
    });
  });
  
  describe('findByEmail', () => {
    it('should return user by email', async () => {
      // Configurar mock
      (UserModel.findOne as any).mockResolvedValue(mockUser);
      
      // Ejecutar método
      const result = await repository.findByEmail('test@example.com');
      
      // Verificaciones
      expect(UserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(result).toEqual({
        id: '60d21b4667d0d8992e610c85',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });
  });
  
  describe('create', () => {
    it('should create a new user', async () => {
      // Configurar mock
      const saveMethod = vi.fn().mockResolvedValue(mockUser);
      (UserModel as any).mockImplementation(() => ({
        save: saveMethod,
        toJSON: mockUser.toJSON,
      }));
      
      // Ejecutar método
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer' as const,
        createdAt: '2023-01-01T00:00:00.000Z',
      };
      
      const result = await repository.create(userData);
      
      // Verificaciones
      expect(result).toEqual({
        id: '60d21b4667d0d8992e610c85',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });
  });
  
  describe('update', () => {
    it('should update an existing user', async () => {
      // Configurar mock
      (UserModel.findByIdAndUpdate as any).mockResolvedValue(mockUser);
      
      // Ejecutar método
      const userData = {
        name: 'Updated User',
      };
      
      const result = await repository.update('60d21b4667d0d8992e610c85', userData);
      
      // Verificaciones
      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '60d21b4667d0d8992e610c85',
        userData,
        { new: true }
      );
      expect(result).toEqual({
        id: '60d21b4667d0d8992e610c85',
        name: 'Test User',
        email: 'test@example.com',
        role: 'customer',
        createdAt: '2023-01-01T00:00:00.000Z',
      });
    });
    
    it('should return null if user to update is not found', async () => {
      // Configurar mock
      (UserModel.findByIdAndUpdate as any).mockResolvedValue(null);
      
      // Ejecutar método
      const userData = {
        name: 'Updated User',
      };
      
      const result = await repository.update('60d21b4667d0d8992e610c85', userData);
      
      // Verificaciones
      expect(result).toBeNull();
    });
  });
  
  describe('delete', () => {
    it('should delete an existing user', async () => {
      // Configurar mock
      (UserModel.findByIdAndDelete as any).mockResolvedValue(mockUser);
      
      // Ejecutar método
      const result = await repository.delete('60d21b4667d0d8992e610c85');
      
      // Verificaciones
      expect(UserModel.findByIdAndDelete).toHaveBeenCalledWith('60d21b4667d0d8992e610c85');
      expect(result).toBe(true);
    });
    
    it('should return false if user to delete is not found', async () => {
      // Configurar mock
      (UserModel.findByIdAndDelete as any).mockResolvedValue(null);
      
      // Ejecutar método
      const result = await repository.delete('60d21b4667d0d8992e610c85');
      
      // Verificaciones
      expect(result).toBe(false);
    });
  });
});