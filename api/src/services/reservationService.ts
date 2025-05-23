import { Reservation } from '../models';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { logger } from '../utils/logger';

export interface AvailabilityCheck {
  isAvailable: boolean;
  conflictingReservations: number;
  maxCapacity: number;
  remainingSlots: number;
  suggestedTimes?: string[];
}

export class ReservationService {
  private reservationRepository = RepositoryFactory.getReservationRepository();
  private restaurantRepository = RepositoryFactory.getRestaurantRepository();
  private userRepository = RepositoryFactory.getUserRepository();

  // Configuración de capacidad (debería venir de configuración del restaurante)
  private readonly MAX_HOURLY_RESERVATIONS = 10;
  private readonly MAX_DAILY_RESERVATIONS = 100;
  private readonly ADVANCE_BOOKING_DAYS = 30;

  async getAllReservations(filters?: {
    restaurantId?: string;
    userId?: string;
    status?: Reservation['status'];
    startDate?: string;
    endDate?: string;
  }): Promise<Reservation[]> {
    try {
      if (filters?.restaurantId && filters.startDate && filters.endDate) {
        return await this.reservationRepository.findByDateRange(
          filters.restaurantId, 
          filters.startDate, 
          filters.endDate
        );
      }

      if (filters?.restaurantId) {
        return await this.reservationRepository.findByRestaurantId(filters.restaurantId);
      }

      if (filters?.userId) {
        return await this.reservationRepository.findByUserId(filters.userId);
      }

      return await this.reservationRepository.findAll();
    } catch (error) {
      logger.error('Error in ReservationService.getAllReservations:', error);
      throw new Error('Failed to retrieve reservations');
    }
  }

  async getReservationById(id: string): Promise<Reservation | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid reservation ID provided');
      }

      return await this.reservationRepository.findById(id);
    } catch (error) {
      logger.error(`Error in ReservationService.getReservationById(${id}):`, error);
      throw new Error('Failed to retrieve reservation');
    }
  }

  async getReservationsByUser(userId: string): Promise<Reservation[]> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID provided');
      }

      // Verificar que el usuario existe
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return await this.reservationRepository.findByUserId(userId);
    } catch (error) {
      logger.error(`Error in ReservationService.getReservationsByUser(${userId}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to retrieve user reservations');
    }
  }

  async getReservationsByRestaurant(
    restaurantId: string, 
    filters?: { startDate?: string; endDate?: string; status?: Reservation['status'] }
  ): Promise<Reservation[]> {
    try {
      if (!restaurantId || typeof restaurantId !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      // Verificar que el restaurante existe
      const restaurant = await this.restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      let reservations: Reservation[];

      if (filters?.startDate && filters?.endDate) {
        reservations = await this.reservationRepository.findByDateRange(
          restaurantId, 
          filters.startDate, 
          filters.endDate
        );
      } else {
        reservations = await this.reservationRepository.findByRestaurantId(restaurantId);
      }

      // Filtrar por estado si se especifica
      if (filters?.status) {
        reservations = reservations.filter(reservation => reservation.status === filters.status);
      }

      return reservations;
    } catch (error) {
      logger.error(`Error in ReservationService.getReservationsByRestaurant(${restaurantId}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to retrieve restaurant reservations');
    }
  }

  async checkAvailability(
    restaurantId: string, 
    date: string, 
    time: string, 
    partySize: number
  ): Promise<AvailabilityCheck> {
    try {
      if (!restaurantId || !date || !time) {
        throw new Error('Restaurant ID, date, and time are required');
      }

      // Verificar que el restaurante existe
      const restaurant = await this.restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      // Validar formato de fecha y hora
      this.validateDateTimeFormat(date, time);

      // Verificar que la fecha no sea en el pasado
      this.validateFutureDateTime(date, time);

      // Obtener reservas existentes para esa fecha y hora
      const existingReservations = await this.reservationRepository.findByDateAndTime(
        restaurantId, 
        date, 
        time
      );

      const conflictingReservations = existingReservations.length;
      const remainingSlots = Math.max(0, this.MAX_HOURLY_RESERVATIONS - conflictingReservations);
      const isAvailable = remainingSlots > 0;

      // Si no hay disponibilidad, sugerir horarios alternativos
      let suggestedTimes: string[] = [];
      if (!isAvailable) {
        suggestedTimes = await this.getSuggestedTimes(restaurantId, date, time);
      }

      return {
        isAvailable,
        conflictingReservations,
        maxCapacity: this.MAX_HOURLY_RESERVATIONS,
        remainingSlots,
        suggestedTimes: suggestedTimes.length > 0 ? suggestedTimes : undefined,
      };
    } catch (error) {
      logger.error(`Error in ReservationService.checkAvailability:`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to check availability');
    }
  }

  async createReservation(reservationData: Omit<Reservation, 'id'>): Promise<Reservation> {
    try {
      // Validaciones de negocio
      await this.validateReservationData(reservationData);

      // Verificar disponibilidad
      const availability = await this.checkAvailability(
        reservationData.restaurantId,
        reservationData.date,
        reservationData.time,
        reservationData.partySize
      );

      if (!availability.isAvailable) {
        throw new Error(`No availability for the selected date and time. Remaining slots: ${availability.remainingSlots}`);
      }

      // Normalizar datos
      const normalizedReservationData = {
        ...reservationData,
        status: 'pending' as const,
        notes: reservationData.notes?.trim() || undefined,
      };

      const newReservation = await this.reservationRepository.create(normalizedReservationData);
      
      // Aquí podrías agregar lógica adicional como:
      // - Enviar confirmación por email
      // - Notificar al restaurante
      // - Crear recordatorio automático

      return newReservation;
    } catch (error) {
      logger.error('Error in ReservationService.createReservation:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to create reservation');
    }
  }

  async updateReservation(id: string, reservationData: Partial<Reservation>): Promise<Reservation | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid reservation ID provided');
      }

      // Verificar que la reserva existe
      const existingReservation = await this.reservationRepository.findById(id);
      if (!existingReservation) {
        throw new Error('Reservation not found');
      }

      // No permitir actualización de reservas canceladas o en el pasado
      if (existingReservation.status === 'cancelled') {
        throw new Error('Cannot update cancelled reservation');
      }

      const reservationDateTime = new Date(`${existingReservation.date}T${existingReservation.time}:00`);
      if (reservationDateTime <= new Date()) {
        throw new Error('Cannot update past reservation');
      }

      // Si se está cambiando fecha/hora, verificar disponibilidad
      if (reservationData.date || reservationData.time) {
        const newDate = reservationData.date || existingReservation.date;
        const newTime = reservationData.time || existingReservation.time;
        const partySize = reservationData.partySize || existingReservation.partySize;

        this.validateDateTimeFormat(newDate, newTime);
        this.validateFutureDateTime(newDate, newTime);

        const availability = await this.checkAvailability(
          existingReservation.restaurantId,
          newDate,
          newTime,
          partySize
        );

        if (!availability.isAvailable) {
          throw new Error(`No availability for the new date and time. Remaining slots: ${availability.remainingSlots}`);
        }
      }

      // Validar datos parciales
      if (Object.keys(reservationData).length > 0) {
        const dataToValidate = {
          userId: reservationData.userId || existingReservation.userId,
          restaurantId: reservationData.restaurantId || existingReservation.restaurantId,
          date: reservationData.date || existingReservation.date,
          time: reservationData.time || existingReservation.time,
          partySize: reservationData.partySize || existingReservation.partySize,
          status: reservationData.status || existingReservation.status,
          notes: reservationData.notes || existingReservation.notes,
        };
        
        await this.validateReservationData(dataToValidate);
      }

      // Normalizar datos
      const normalizedUpdateData: Partial<Reservation> = {};
      
      if (reservationData.userId) normalizedUpdateData.userId = reservationData.userId;
      if (reservationData.restaurantId) normalizedUpdateData.restaurantId = reservationData.restaurantId;
      if (reservationData.date) normalizedUpdateData.date = reservationData.date;
      if (reservationData.time) normalizedUpdateData.time = reservationData.time;
      if (reservationData.partySize) normalizedUpdateData.partySize = reservationData.partySize;
      if (reservationData.status) normalizedUpdateData.status = reservationData.status;
      if (reservationData.notes !== undefined) {
        normalizedUpdateData.notes = reservationData.notes?.trim() || undefined;
      }

      return await this.reservationRepository.update(id, normalizedUpdateData);
    } catch (error) {
      logger.error(`Error in ReservationService.updateReservation(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update reservation');
    }
  }

  async updateReservationStatus(
    id: string, 
    status: Reservation['status'], 
    userRole?: string[]
  ): Promise<Reservation | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid reservation ID provided');
      }

      if (!status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
        throw new Error('Invalid status provided');
      }

      // Verificar que la reserva existe
      const existingReservation = await this.reservationRepository.findById(id);
      if (!existingReservation) {
        throw new Error('Reservation not found');
      }

      // Validar transiciones de estado
      const validTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['cancelled'],
        cancelled: []
      };

      if (!validTransitions[existingReservation.status].includes(status)) {
        throw new Error(`Invalid status transition from ${existingReservation.status} to ${status}`);
      }

      // Solo admins pueden confirmar reservas
      if (status === 'confirmed' && (!userRole || !userRole.includes('restaurant-admin'))) {
        throw new Error('Only restaurant administrators can confirm reservations');
      }

      const updatedReservation = await this.reservationRepository.updateStatus(id, status);

      // Aquí podrías agregar lógica adicional como:
      // - Enviar notificaciones por email
      // - Actualizar disponibilidad en tiempo real
      // - Registrar el cambio en logs de auditoría

      return updatedReservation;
    } catch (error) {
      logger.error(`Error in ReservationService.updateReservationStatus(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update reservation status');
    }
  }

  async cancelReservation(id: string, userId?: string, userRole?: string[]): Promise<Reservation | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid reservation ID provided');
      }

      const existingReservation = await this.reservationRepository.findById(id);
      if (!existingReservation) {
        throw new Error('Reservation not found');
      }

      // Verificar permisos: el usuario debe ser el propietario o admin
      if (userId && !userRole?.includes('restaurant-admin') && existingReservation.userId !== userId) {
        throw new Error('Cannot cancel other user\'s reservation');
      }

      // No se puede cancelar una reserva ya cancelada
      if (existingReservation.status === 'cancelled') {
        throw new Error('Reservation is already cancelled');
      }

      return await this.reservationRepository.updateStatus(id, 'cancelled');
    } catch (error) {
      logger.error(`Error in ReservationService.cancelReservation(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to cancel reservation');
    }
  }

  async deleteReservation(id: string): Promise<boolean> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid reservation ID provided');
      }

      const existingReservation = await this.reservationRepository.findById(id);
      if (!existingReservation) {
        throw new Error('Reservation not found');
      }

      return await this.reservationRepository.delete(id);
    } catch (error) {
      logger.error(`Error in ReservationService.deleteReservation(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to delete reservation');
    }
  }

  async getReservationStats(restaurantId?: string): Promise<{
    totalReservations: number;
    pendingReservations: number;
    confirmedReservations: number;
    cancelledReservations: number;
    upcomingReservations: number;
    averagePartySize: number;
    peakHours: { [hour: string]: number };
  }> {
    try {
      let reservations: Reservation[];
      
      if (restaurantId) {
        reservations = await this.reservationRepository.findByRestaurantId(restaurantId);
      } else {
        reservations = await this.reservationRepository.findAll();
      }

      const today = new Date().toISOString().split('T')[0];
      const upcomingReservations = reservations.filter(r => 
        r.date >= today && ['pending', 'confirmed'].includes(r.status)
      );

      // Estadísticas por estado
      const pending = reservations.filter(r => r.status === 'pending').length;
      const confirmed = reservations.filter(r => r.status === 'confirmed').length;
      const cancelled = reservations.filter(r => r.status === 'cancelled').length;

      // Tamaño promedio de grupo
      const totalPartySize = reservations.reduce((sum, r) => sum + r.partySize, 0);
      const averagePartySize = reservations.length > 0 ? totalPartySize / reservations.length : 0;

      // Horas pico
      const peakHours: { [hour: string]: number } = {};
      reservations.forEach(reservation => {
        const hour = reservation.time.split(':')[0];
        peakHours[hour] = (peakHours[hour] || 0) + 1;
      });

      return {
        totalReservations: reservations.length,
        pendingReservations: pending,
        confirmedReservations: confirmed,
        cancelledReservations: cancelled,
        upcomingReservations: upcomingReservations.length,
        averagePartySize: parseFloat(averagePartySize.toFixed(1)),
        peakHours,
      };
    } catch (error) {
      logger.error(`Error in ReservationService.getReservationStats(${restaurantId}):`, error);
      throw new Error('Failed to retrieve reservation statistics');
    }
  }

  private async validateReservationData(data: Omit<Reservation, 'id'>): Promise<void> {
    // Verificar que el usuario existe
    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('Valid user ID is required');
    }

    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verificar que el restaurante existe
    if (!data.restaurantId || typeof data.restaurantId !== 'string') {
      throw new Error('Valid restaurant ID is required');
    }

    const restaurant = await this.restaurantRepository.findById(data.restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Validar fecha y hora
    this.validateDateTimeFormat(data.date, data.time);
    this.validateFutureDateTime(data.date, data.time);

    // Validar tamaño del grupo
    if (typeof data.partySize !== 'number' || data.partySize < 1 || data.partySize > 20) {
      throw new Error('Party size must be between 1 and 20');
    }

    // Validar estado
    if (data.status && !['pending', 'confirmed', 'cancelled'].includes(data.status)) {
      throw new Error('Invalid status');
    }

    // Validar notas
    if (data.notes && typeof data.notes === 'string' && data.notes.trim().length > 500) {
      throw new Error('Notes cannot exceed 500 characters');
    }
  }

  private validateDateTimeFormat(date: string, time: string): void {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!dateRegex.test(date)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }

    if (!timeRegex.test(time)) {
      throw new Error('Time must be in HH:MM format');
    }

    // Validar que la fecha sea válida
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime()) || dateObj.toISOString().split('T')[0] !== date) {
      throw new Error('Invalid date provided');
    }
  }

  private validateFutureDateTime(date: string, time: string): void {
    const reservationDateTime = new Date(`${date}T${time}:00`);
    const now = new Date();

    if (reservationDateTime <= now) {
      throw new Error('Reservation date and time must be in the future');
    }

    // Validar que no sea demasiado lejos en el futuro
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + this.ADVANCE_BOOKING_DAYS);

    if (reservationDateTime > maxDate) {
      throw new Error(`Reservations can only be made up to ${this.ADVANCE_BOOKING_DAYS} days in advance`);
    }
  }

  private async getSuggestedTimes(restaurantId: string, date: string, requestedTime: string): Promise<string[]> {
    try {
      const suggestions: string[] = [];
      const requestedHour = parseInt(requestedTime.split(':')[0]);
      
      // Buscar horarios alternativos 2 horas antes y después
      for (let hourOffset = -2; hourOffset <= 2; hourOffset++) {
        if (hourOffset === 0) continue; // Skip the requested time
        
        const suggestedHour = requestedHour + hourOffset;
        if (suggestedHour < 12 || suggestedHour > 22) continue; // Horario de restaurante
        
        const suggestedTime = `${suggestedHour.toString().padStart(2, '0')}:00`;
        
        const availability = await this.checkAvailability(restaurantId, date, suggestedTime, 1);
        if (availability.isAvailable) {
          suggestions.push(suggestedTime);
        }
      }
      
      return suggestions.slice(0, 3); // Máximo 3 sugerencias
    } catch (error) {
      logger.error('Error getting suggested times:', error);
      return [];
    }
  }
}