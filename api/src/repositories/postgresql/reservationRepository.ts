import { Pool } from 'pg';
import { Reservation } from '../../models';
import { ReservationRepository } from '../interfaces';
import { logger } from '../../utils/logger';
import { getPgPool } from '../../utils/db';

export class PostgresReservationRepository implements ReservationRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPgPool();
  }

  private mapReservation(row: any): Reservation {
    return {
      id: row.id.toString(),
      userId: row.user_id.toString(),
      restaurantId: row.restaurant_id.toString(),
      date: row.date,
      time: row.time,
      partySize: row.party_size,
      status: row.status as 'pending' | 'confirmed' | 'cancelled',
      notes: row.notes
    };
  }

  async findAll(): Promise<Reservation[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM reservations ORDER BY date DESC, time DESC'
      );
      return result.rows.map(this.mapReservation);
    } catch (error) {
      logger.error('Error in PostgresReservationRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Reservation | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM reservations WHERE id = $1',
        [id]
      );
      return result.rows.length ? this.mapReservation(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Reservation[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM reservations WHERE user_id = $1 ORDER BY date DESC, time DESC',
        [userId]
      );
      return result.rows.map(this.mapReservation);
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.findByUserId(${userId}):`, error);
      throw error;
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<Reservation[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM reservations WHERE restaurant_id = $1 ORDER BY date DESC, time DESC',
        [restaurantId]
      );
      return result.rows.map(this.mapReservation);
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.findByRestaurantId(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByDateRange(restaurantId: string, startDate: string, endDate: string): Promise<Reservation[]> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM reservations WHERE restaurant_id = $1 AND date >= $2 AND date <= $3 ORDER BY date, time',
        [restaurantId, startDate, endDate]
      );
      return result.rows.map(this.mapReservation);
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.findByDateRange(${restaurantId}, ${startDate}, ${endDate}):`, error);
      throw error;
    }
  }

  async updateStatus(id: string, status: Reservation['status']): Promise<Reservation | null> {
    try {
      const result = await this.pool.query(
        'UPDATE reservations SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      return result.rows.length ? this.mapReservation(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.updateStatus(${id}):`, error);
      throw error;
    }
  }

  async create(reservationData: Omit<Reservation, 'id'>): Promise<Reservation> {
    try {
      const result = await this.pool.query(`
        INSERT INTO reservations (
          user_id, restaurant_id, date, time, party_size, status, notes
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
      `, [
        reservationData.userId,
        reservationData.restaurantId,
        reservationData.date,
        reservationData.time,
        reservationData.partySize,
        reservationData.status,
        reservationData.notes
      ]);
      
      return this.mapReservation(result.rows[0]);
    } catch (error) {
      logger.error('Error in PostgresReservationRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, reservationData: Partial<Reservation>): Promise<Reservation | null> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (reservationData.userId) {
        fields.push(`user_id = $${paramIndex++}`);
        values.push(reservationData.userId);
      }
      if (reservationData.restaurantId) {
        fields.push(`restaurant_id = $${paramIndex++}`);
        values.push(reservationData.restaurantId);
      }
      if (reservationData.date) {
        fields.push(`date = $${paramIndex++}`);
        values.push(reservationData.date);
      }
      if (reservationData.time) {
        fields.push(`time = $${paramIndex++}`);
        values.push(reservationData.time);
      }
      if (reservationData.partySize !== undefined) {
        fields.push(`party_size = $${paramIndex++}`);
        values.push(reservationData.partySize);
      }
      if (reservationData.status) {
        fields.push(`status = $${paramIndex++}`);
        values.push(reservationData.status);
      }
      if (reservationData.notes !== undefined) {
        fields.push(`notes = $${paramIndex++}`);
        values.push(reservationData.notes);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const query = `
        UPDATE reservations 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex} 
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows.length ? this.mapReservation(result.rows[0]) : null;
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        'DELETE FROM reservations WHERE id = $1 RETURNING id',
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.delete(${id}):`, error);
      throw error;
    }
  }

  async findActiveReservations(restaurantId: string): Promise<Reservation[]> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const result = await this.pool.query(`
        SELECT * FROM reservations 
        WHERE restaurant_id = $1 
        AND date >= $2 
        AND status IN ('pending', 'confirmed')
        ORDER BY date, time
      `, [restaurantId, today]);
      
      return result.rows.map(this.mapReservation);
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.findActiveReservations(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByDateAndTime(restaurantId: string, date: string, time: string): Promise<Reservation[]> {
    try {
      const result = await this.pool.query(`
        SELECT * FROM reservations 
        WHERE restaurant_id = $1 
        AND date = $2 
        AND time = $3
        AND status IN ('pending', 'confirmed')
      `, [restaurantId, date, time]);
      
      return result.rows.map(this.mapReservation);
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.findByDateAndTime(${restaurantId}, ${date}, ${time}):`, error);
      throw error;
    }
  }

  async countReservationsByDate(restaurantId: string, date: string): Promise<number> {
    try {
      const result = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM reservations 
        WHERE restaurant_id = $1 
        AND date = $2 
        AND status IN ('pending', 'confirmed')
      `, [restaurantId, date]);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error in PostgresReservationRepository.countReservationsByDate(${restaurantId}, ${date}):`, error);
      throw error;
    }
  }
}