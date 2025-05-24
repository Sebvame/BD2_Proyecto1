import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../index'; // Asegúrate de que la ruta sea correcta
import { config } from '../../config';
import { connectToMongoDB, closeConnections } from '../../utils/db';
import { UserModel } from '../../repositories/mongodb/schemas';
import { Request, Response, NextFunction } from 'express';

describe('API Integration Tests', () => {
  // Token de prueba para Auth0 (mock)
  const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhdXRoMHw2MGQyMWI0NjY3ZDBkODk5MmU2MTBjODUiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJodHRwczovL3Jlc3RhdXJhbnQtYXBpLmNvbS9yb2xlcyI6WyJjdXN0b21lciJdLCJpYXQiOjE1MTYyMzkwMjJ9.2U0T_N2Q2IhdGIDd9FQ1VN1XLXKu0JI-GBTGw1kNoXs';
  
  // Usuario de prueba
  const testUser = {
    _id: new mongoose.Types.ObjectId('60d21b4667d0d8992e610c85'),
    name: 'Test User',
    email: 'test@example.com',
    role: 'customer',
    createdAt: new Date().toISOString(),
  };
  
  beforeAll(async () => {
    // Conectar a la base de datos de prueba
    config.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_test';
    config.DB_TYPE = 'mongodb';
    
    await connectToMongoDB();
    
    // Limpiar la base de datos antes de las pruebas
    await UserModel.deleteMany({});
    
    // Crear usuario de prueba
    await UserModel.create(testUser);
  });
  
  afterAll(async () => {
    // Limpiar la base de datos y cerrar conexiones
    await UserModel.deleteMany({});
    await closeConnections();
  });
  
  // Mock de los middlewares de autenticación para pruebas
  // En un entorno real, estos serían verificados con Auth0
  vi.mock('../../middleware/auth', () => {
    interface AuthRequest extends Request {
      auth?: {
      sub: string;
      'https://restaurant-api.com/roles': string[];
      };
    }

    interface Middleware {
      checkJwt: (req?: AuthRequest, res?: Response, next?: NextFunction) => void;
      checkRole: (role: string) => (req: AuthRequest, res: Response, next: NextFunction) => void;
      handleAuthError: (err: Error, req: Request, res: Response, next: NextFunction) => void;
    }

    const middleware: Middleware = {
      checkJwt: (req?: AuthRequest, res?: Response, next?: NextFunction) => {
      const authHeader = req?.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (token === mockToken) {
        req.auth = {
          sub: 'auth0|60d21b4667d0d8992e610c85',
          'https://restaurant-api.com/roles': ['customer'],
        };
        return next?.();
        }
      }
      return res?.status(401).json({ error: { message: 'Unauthorized' } });
      },
      checkRole: (role: string) => (req: AuthRequest, res: Response, next: NextFunction) => {
      const userRoles = req.auth?.['https://restaurant-api.com/roles'] || [];
      if (userRoles.includes(role)) {
        return next();
      }
      return res.status(403).json({ error: { message: 'Insufficient permissions' } });
      },
      handleAuthError: (err: Error, req: Request, res: Response, next: NextFunction) => {
      if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: { message: 'Invalid token' } });
      }
      next(err);
      },
    };

    return middleware;
  });
  
  describe('Health Check', () => {
    it('should return status 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
  
  describe('User Endpoints', () => {
    it('should get user by ID', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${mockToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testUser._id.toString());
      expect(response.body).toHaveProperty('name', testUser.name);
      expect(response.body).toHaveProperty('email', testUser.email);
      expect(response.body).toHaveProperty('role', testUser.role);
    });
    
    it('should create a new user', async () => {
      const newUser = {
        name: 'New User',
        email: 'new@example.com',
        role: 'customer',
      };
      
      const response = await request(app)
        .post('/api/users')
        .send(newUser);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', newUser.name);
      expect(response.body).toHaveProperty('email', newUser.email);
      expect(response.body).toHaveProperty('role', newUser.role);
      
      // Verificar que el usuario se creó en la base de datos
      const createdUser = await UserModel.findOne({ email: newUser.email });
      expect(createdUser).not.toBeNull();
    });
    
    it('should update user', async () => {
      const updateData = {
        name: 'Updated User',
      };
      
      const response = await request(app)
        .put(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testUser._id.toString());
      expect(response.body).toHaveProperty('name', updateData.name);
      
      // Verificar que el usuario se actualizó en la base de datos
      const updatedUser = await UserModel.findById(testUser._id);
      expect(updatedUser?.name).toBe(updateData.name);
    });
    
    it('should not allow unauthorized access', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser._id}`);
      
      expect(response.status).toBe(401);
    });
  });
});