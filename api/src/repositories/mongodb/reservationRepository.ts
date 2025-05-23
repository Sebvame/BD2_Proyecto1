import { Reservation } from '../../models';
import { ReservationRepository } from '../interfaces';
import { ReservationModel } from './schemas';
import { logger } from '../../utils/logger';

export class MongoReservationRepository implements ReservationRepository {
  async findAll(): Promise<Reservation[]> {
    try {
      const reservations = await ReservationModel.find().sort({ date: -1, time: -1 });
      return reservations.map(reservation => reservation.toJSON() as Reservation);
    } catch (error) {
      logger.error('Error in MongoReservationRepository.findAll:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Reservation | null> {
    try {
      const reservation = await ReservationModel.findById(id);
      return reservation ? reservation.toJSON() as Reservation : null;
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.findById(${id}):`, error);
      throw error;
    }
  }

  async findByUserId(userId: string): Promise<Reservation[]> {
    try {
      const reservations = await ReservationModel.find({ userId }).sort({ date: -1, time: -1 });
      return reservations.map(reservation => reservation.toJSON() as Reservation);
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.findByUserId(${userId}):`, error);
      throw error;
    }
  }

  async findByRestaurantId(restaurantId: string): Promise<Reservation[]> {
    try {
      const reservations = await ReservationModel.find({ restaurantId }).sort({ date: -1, time: -1 });
      return reservations.map(reservation => reservation.toJSON() as Reservation);
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.findByRestaurantId(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByDateRange(restaurantId: string, startDate: string, endDate: string): Promise<Reservation[]> {
    try {
      const reservations = await ReservationModel.find({
        restaurantId,
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ date: 1, time: 1 });
      
      return reservations.map(reservation => reservation.toJSON() as Reservation);
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.findByDateRange(${restaurantId}, ${startDate}, ${endDate}):`, error);
      throw error;
    }
  }

  async updateStatus(id: string, status: Reservation['status']): Promise<Reservation | null> {
    try {
      const updatedReservation = await ReservationModel.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );
      return updatedReservation ? updatedReservation.toJSON() as Reservation : null;
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.updateStatus(${id}):`, error);
      throw error;
    }
  }

  async create(reservationData: Omit<Reservation, 'id'>): Promise<Reservation> {
    try {
      const newReservation = new ReservationModel(reservationData);
      await newReservation.save();
      return newReservation.toJSON() as Reservation;
    } catch (error) {
      logger.error('Error in MongoReservationRepository.create:', error);
      throw error;
    }
  }

  async update(id: string, reservationData: Partial<Reservation>): Promise<Reservation | null> {
    try {
      const updatedReservation = await ReservationModel.findByIdAndUpdate(
        id,
        reservationData,
        { new: true }
      );
      return updatedReservation ? updatedReservation.toJSON() as Reservation : null;
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.update(${id}):`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await ReservationModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.delete(${id}):`, error);
      throw error;
    }
  }

  async findActiveReservations(restaurantId: string): Promise<Reservation[]> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const reservations = await ReservationModel.find({
        restaurantId,
        date: { $gte: today },
        status: { $in: ['pending', 'confirmed'] }
      }).sort({ date: 1, time: 1 });
      
      return reservations.map(reservation => reservation.toJSON() as Reservation);
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.findActiveReservations(${restaurantId}):`, error);
      throw error;
    }
  }

  async findByDateAndTime(restaurantId: string, date: string, time: string): Promise<Reservation[]> {
    try {
      const reservations = await ReservationModel.find({
        restaurantId,
        date,
        time,
        status: { $in: ['pending', 'confirmed'] }
      });
      
      return reservations.map(reservation => reservation.toJSON() as Reservation);
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.findByDateAndTime(${restaurantId}, ${date}, ${time}):`, error);
      throw error;
    }
  }

  async countReservationsByDate(restaurantId: string, date: string): Promise<number> {
    try {
      const count = await ReservationModel.countDocuments({
        restaurantId,
        date,
        status: { $in: ['pending', 'confirmed'] }
      });
      
      return count;
    } catch (error) {
      logger.error(`Error in MongoReservationRepository.countReservationsByDate(${restaurantId}, ${date}):`, error);
      throw error;
    }
  }
}