import { Pool } from 'pg';
import { User } from '../../models';
import { UserRepository } from '../interfaces';
import { logger } from '../../utils/logger';
import { getPgPool } from '../../utils/db';

export class PostgresUserRepository implements UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPgPool();
  }

  private mapUser(row: any): User {
    return {
      id: row.id.toString(),
      name: row.name,
      email: row.email,
      role: row.role as 'customer' | 'restaurant-admin',
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  async findAll(): Promise<User[]> {
    try {
      const result = await this.pool.query('SELECT * FROM users');
      return result.rows.map(this.mapUser);
    } catch (error) {
      logger.error('Error in PostgresUserRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows.length ? this.mapUser(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresUserRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows.length ? this.mapUser(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresUserRepository.findByEmail(${email}):`, error);
      throw error;
    }
  }

  async findByRole(role: User['role']): Promise<User[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM users WHERE role = $1',
        [role]
      );
      return result.rows.map(this.mapUser);
    } catch (error) {
      logger.error(`Error in PostgresUserRepository.findByRole(${role}):`, error);
      throw error;
    }
  }

  async create(userData: Omit<User, 'id'>): Promise<User> {
    try {
      const result = await this.pool.query(
        `INSERT INTO users (name, email, role) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [userData.name, userData.email, userData.role]
      );
      return this.mapUser(result.rows[0]);
    } catch (error) {
      logger.error('Error in PostgresUserRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, userData: Partial<User>): Promise<User | null> {
    try {
      // Construir la consulta dinámicamente basada en los campos que se están actualizando
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (userData.name) {
        fields.push(`name = $${paramIndex++}`);
        values.push(userData.name);
      }
      if (userData.email) {
        fields.push(`email = $${paramIndex++}`);
        values.push(userData.email);
      }
      if (userData.role) {
        fields.push(`role = $${paramIndex++}`);
        values.push(userData.role);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const query = `
        UPDATE users 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows.length ? this.mapUser(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresUserRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error in PostgresUserRepository.delete(${id}):`, error);
      throw error;
    }
  }
}