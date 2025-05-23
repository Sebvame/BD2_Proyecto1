import { Order, OrderItem } from '../models';
import { RepositoryFactory } from '../repositories/repositoryFactory';
import { logger } from '../utils/logger';

export interface OrderValidation {
  isValid: boolean;
  errors: string[];
  calculatedTotal: number;
  unavailableItems: string[];
}

export interface OrderStatusTransition {
  canTransition: boolean;
  validNextStates: Order['status'][];
  reason?: string;
}

export class OrderService {
  private orderRepository = RepositoryFactory.getOrderRepository();
  private restaurantRepository = RepositoryFactory.getRestaurantRepository();
  private menuItemRepository = RepositoryFactory.getMenuItemRepository();
  private userRepository = RepositoryFactory.getUserRepository();

  // Configuración de tiempos estimados (en minutos)
  private readonly PREPARATION_TIMES = {
    pending: 0,
    preparing: 20,
    ready: 0,
    completed: 0,
    cancelled: 0
  };

  async getAllOrders(filters?: {
    restaurantId?: string;
    userId?: string;
    status?: Order['status'];
    startDate?: string;
    endDate?: string;
  }): Promise<Order[]> {
    try {
      if (filters?.restaurantId && filters.startDate && filters.endDate) {
        return await this.orderRepository.findOrdersByDateRange(
          filters.restaurantId, 
          filters.startDate, 
          filters.endDate
        );
      }

      if (filters?.restaurantId) {
        return await this.orderRepository.findByRestaurantId(filters.restaurantId);
      }

      if (filters?.userId) {
        return await this.orderRepository.findByUserId(filters.userId);
      }

      if (filters?.status) {
        return await this.orderRepository.findByStatus(filters.status);
      }

      return await this.orderRepository.findAll();
    } catch (error) {
      logger.error('Error in OrderService.getAllOrders:', error);
      throw new Error('Failed to retrieve orders');
    }
  }

  async getOrderById(id: string): Promise<Order | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid order ID provided');
      }

      return await this.orderRepository.findById(id);
    } catch (error) {
      logger.error(`Error in OrderService.getOrderById(${id}):`, error);
      throw new Error('Failed to retrieve order');
    }
  }

  async getOrdersByUser(userId: string, limit?: number): Promise<Order[]> {
    try {
      if (!userId || typeof userId !== 'string') {
        throw new Error('Invalid user ID provided');
      }

      // Verificar que el usuario existe
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (limit) {
        return await this.orderRepository.findRecentOrdersByUser(userId, limit);
      }

      return await this.orderRepository.findByUserId(userId);
    } catch (error) {
      logger.error(`Error in OrderService.getOrdersByUser(${userId}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to retrieve user orders');
    }
  }

  async getOrdersByRestaurant(
    restaurantId: string, 
    filters?: { 
      status?: Order['status']; 
      startDate?: string; 
      endDate?: string;
      activeOnly?: boolean;
    }
  ): Promise<Order[]> {
    try {
      if (!restaurantId || typeof restaurantId !== 'string') {
        throw new Error('Invalid restaurant ID provided');
      }

      // Verificar que el restaurante existe
      const restaurant = await this.restaurantRepository.findById(restaurantId);
      if (!restaurant) {
        throw new Error('Restaurant not found');
      }

      let orders: Order[];

      if (filters?.activeOnly) {
        orders = await this.orderRepository.findActiveOrders(restaurantId);
      } else if (filters?.startDate && filters?.endDate) {
        orders = await this.orderRepository.findOrdersByDateRange(
          restaurantId, 
          filters.startDate, 
          filters.endDate
        );
      } else {
        orders = await this.orderRepository.findByRestaurantId(restaurantId);
      }

      // Filtrar por estado si se especifica
      if (filters?.status) {
        orders = orders.filter(order => order.status === filters.status);
      }

      return orders;
    } catch (error) {
      logger.error(`Error in OrderService.getOrdersByRestaurant(${restaurantId}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to retrieve restaurant orders');
    }
  }

  async validateOrderData(orderData: Omit<Order, 'id'>): Promise<OrderValidation> {
    const errors: string[] = [];
    const unavailableItems: string[] = [];
    let calculatedTotal = 0;

    try {
      // Verificar que el usuario existe
      if (!orderData.userId || typeof orderData.userId !== 'string') {
        errors.push('Valid user ID is required');
      } else {
        const user = await this.userRepository.findById(orderData.userId);
        if (!user) {
          errors.push('User not found');
        }
      }

      // Verificar que el restaurante existe
      if (!orderData.restaurantId || typeof orderData.restaurantId !== 'string') {
        errors.push('Valid restaurant ID is required');
      } else {
        const restaurant = await this.restaurantRepository.findById(orderData.restaurantId);
        if (!restaurant) {
          errors.push('Restaurant not found');
        }
      }

      // Validar items
      if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
        errors.push('Order must contain at least one item');
      } else {
        for (const item of orderData.items) {
          // Verificar que el menu item existe
          const menuItem = await this.menuItemRepository.findById(item.menuItemId);
          
          if (!menuItem) {
            unavailableItems.push(item.menuItemId);
            errors.push(`Menu item not found: ${item.menuItemId}`);
            continue;
          }

          // Verificar que está disponible
          if (!menuItem.available) {
            unavailableItems.push(item.menuItemId);
            errors.push(`Menu item is not available: ${menuItem.name}`);
            continue;
          }

          // Verificar que pertenece al restaurante correcto
          if (menuItem.restaurantId !== orderData.restaurantId) {
            errors.push(`Menu item ${menuItem.name} does not belong to this restaurant`);
            continue;
          }

          // Verificar que el precio coincide con el precio actual del menú
          if (Math.abs(item.price - menuItem.price) > 0.01) {
            errors.push(`Price mismatch for ${menuItem.name}. Expected: ${menuItem.price}, received: ${item.price}`);
            continue;
          }

          // Validar cantidad
          if (!Number.isInteger(item.quantity) || item.quantity < 1) {
            errors.push(`Invalid quantity for ${menuItem.name}`);
            continue;
          }

          // Validar instrucciones especiales
          if (item.specialInstructions && item.specialInstructions.length > 200) {
            errors.push(`Special instructions too long for ${menuItem.name}`);
            continue;
          }

          // Acumular total
          calculatedTotal += item.price * item.quantity;
        }
      }

      // Verificar que el total coincide
      if (Math.abs(orderData.total - calculatedTotal) > 0.01) {
        errors.push(`Total mismatch. Expected: ${calculatedTotal.toFixed(2)}, received: ${orderData.total}`);
      }

      // Validar total mínimo y máximo
      if (calculatedTotal < 1) {
        errors.push('Order total must be at least $1.00');
      }

      if (calculatedTotal > 500) {
        errors.push('Order total cannot exceed $500.00');
      }

      // Validar estado
      if (orderData.status && !['pending', 'preparing', 'ready', 'completed', 'cancelled'].includes(orderData.status)) {
        errors.push('Invalid order status');
      }

      // Validar tiempo de recogida
      if (orderData.pickupTime) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(orderData.pickupTime)) {
          errors.push('Pickup time must be in HH:MM format');
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        calculatedTotal: parseFloat(calculatedTotal.toFixed(2)),
        unavailableItems
      };

    } catch (error) {
      logger.error('Error in OrderService.validateOrderData:', error);
      return {
        isValid: false,
        errors: ['Failed to validate order data'],
        calculatedTotal: 0,
        unavailableItems: []
      };
    }
  }

  async createOrder(orderData: Omit<Order, 'id'>): Promise<Order> {
    try {
      // Validar datos del pedido
      const validation = await this.validateOrderData(orderData);
      
      if (!validation.isValid) {
        throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
      }

      // Calcular tiempo estimado de preparación
      const estimatedTime = this.calculateEstimatedPreparationTime(orderData.items);

      // Normalizar datos
      const normalizedOrderData = {
        ...orderData,
        status: 'pending' as const,
        total: validation.calculatedTotal,
        createdAt: new Date().toISOString(),
        pickupTime: orderData.pickupTime || this.generateEstimatedPickupTime(estimatedTime),
      };

      const newOrder = await this.orderRepository.create(normalizedOrderData);
      
      // Aquí podrías agregar lógica adicional como:
      // - Notificar al restaurante
      // - Actualizar inventario
      // - Enviar confirmación al cliente
      // - Programar recordatorios

      logger.info(`Order created: ${newOrder.id} for user ${newOrder.userId} at restaurant ${newOrder.restaurantId}`);
      
      return newOrder;
    } catch (error) {
      logger.error('Error in OrderService.createOrder:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to create order');
    }
  }

  async updateOrder(id: string, orderData: Partial<Order>): Promise<Order | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid order ID provided');
      }

      // Verificar que el pedido existe
      const existingOrder = await this.orderRepository.findById(id);
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // No permitir actualización de pedidos completados o cancelados
      if (['completed', 'cancelled'].includes(existingOrder.status)) {
        throw new Error('Cannot update completed or cancelled orders');
      }

      // Si se están actualizando items, revalidar todo el pedido
      if (orderData.items) {
        const fullOrderData = {
          userId: orderData.userId || existingOrder.userId,
          restaurantId: orderData.restaurantId || existingOrder.restaurantId,
          items: orderData.items,
          status: orderData.status || existingOrder.status,
          total: orderData.total || existingOrder.total,
          createdAt: existingOrder.createdAt,
          pickupTime: orderData.pickupTime || existingOrder.pickupTime,
        };

        const validation = await this.validateOrderData(fullOrderData);
        if (!validation.isValid) {
          throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
        }

        orderData.total = validation.calculatedTotal;
      }

      return await this.orderRepository.update(id, orderData);
    } catch (error) {
      logger.error(`Error in OrderService.updateOrder(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update order');
    }
  }

  async updateOrderStatus(
    id: string, 
    status: Order['status'], 
    userRole?: string[]
  ): Promise<Order | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid order ID provided');
      }

      const existingOrder = await this.orderRepository.findById(id);
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // Verificar si la transición de estado es válida
      const transition = this.validateStatusTransition(existingOrder.status, status, userRole);
      if (!transition.canTransition) {
        throw new Error(transition.reason || `Invalid status transition from ${existingOrder.status} to ${status}`);
      }

      const updatedOrder = await this.orderRepository.updateStatus(id, status);

      // Lógica adicional basada en el nuevo estado
      if (updatedOrder) {
        await this.handleStatusChange(updatedOrder, existingOrder.status);
      }

      logger.info(`Order status updated: ${id} from ${existingOrder.status} to ${status}`);
      
      return updatedOrder;
    } catch (error) {
      logger.error(`Error in OrderService.updateOrderStatus(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update order status');
    }
  }

  async updatePickupTime(id: string, pickupTime: string): Promise<Order | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid order ID provided');
      }

      // Validar formato de hora
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(pickupTime)) {
        throw new Error('Pickup time must be in HH:MM format');
      }

      const existingOrder = await this.orderRepository.findById(id);
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // No se puede actualizar el tiempo de recogida de pedidos completados o cancelados
      if (['completed', 'cancelled'].includes(existingOrder.status)) {
        throw new Error('Cannot update pickup time for completed or cancelled orders');
      }

      return await this.orderRepository.updatePickupTime(id, pickupTime);
    } catch (error) {
      logger.error(`Error in OrderService.updatePickupTime(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to update pickup time');
    }
  }

  async cancelOrder(id: string, userId?: string, userRole?: string[]): Promise<Order | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid order ID provided');
      }

      const existingOrder = await this.orderRepository.findById(id);
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      // Verificar permisos
      if (userId && !userRole?.includes('restaurant-admin') && existingOrder.userId !== userId) {
        throw new Error('Cannot cancel other user\'s order');
      }

      // Los clientes solo pueden cancelar pedidos en estado "pending"
      if (userId && !userRole?.includes('restaurant-admin') && existingOrder.status !== 'pending') {
        throw new Error('Customers can only cancel pending orders');
      }

      // No se puede cancelar un pedido ya completado
      if (existingOrder.status === 'completed') {
        throw new Error('Cannot cancel completed order');
      }

      if (existingOrder.status === 'cancelled') {
        throw new Error('Order is already cancelled');
      }

      return await this.updateOrderStatus(id, 'cancelled', userRole);
    } catch (error) {
      logger.error(`Error in OrderService.cancelOrder(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to cancel order');
    }
  }

  async deleteOrder(id: string): Promise<boolean> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid order ID provided');
      }

      const existingOrder = await this.orderRepository.findById(id);
      if (!existingOrder) {
        throw new Error('Order not found');
      }

      return await this.orderRepository.delete(id);
    } catch (error) {
      logger.error(`Error in OrderService.deleteOrder(${id}):`, error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to delete order');
    }
  }

  async getOrderStats(restaurantId?: string): Promise<{
    totalOrders: number;
    ordersByStatus: { [status: string]: number };
    totalRevenue: number;
    averageOrderValue: number;
    topItems: { name: string; quantity: number; revenue: number }[];
    orderTrends: { date: string; orders: number; revenue: number }[];
  }> {
    try {
      let orders: Order[];
      
      if (restaurantId) {
        orders = await this.orderRepository.findByRestaurantId(restaurantId);
      } else {
        orders = await this.orderRepository.findAll();
      }

      // Estadísticas por estado
      const ordersByStatus: { [status: string]: number } = {
        pending: 0,
        preparing: 0,
        ready: 0,
        completed: 0,
        cancelled: 0
      };

      orders.forEach(order => {
        ordersByStatus[order.status]++;
      });

      // Revenue total
      const completedOrders = orders.filter(o => o.status === 'completed');
      const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total, 0);
      const averageOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      // Top items (items más pedidos)
      const itemStats: { [itemId: string]: { name: string; quantity: number; revenue: number } } = {};
      
      completedOrders.forEach(order => {
        order.items.forEach(item => {
          if (!itemStats[item.menuItemId]) {
            itemStats[item.menuItemId] = {
              name: item.name,
              quantity: 0,
              revenue: 0
            };
          }
          itemStats[item.menuItemId].quantity += item.quantity;
          itemStats[item.menuItemId].revenue += item.price * item.quantity;
        });
      });

      const topItems = Object.values(itemStats)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Tendencias por día (últimos 30 días)
      const orderTrends: { date: string; orders: number; revenue: number }[] = [];
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      last30Days.forEach(date => {
        const dayOrders = completedOrders.filter(order => 
          order.createdAt.startsWith(date)
        );
        
        orderTrends.push({
          date,
          orders: dayOrders.length,
          revenue: dayOrders.reduce((sum, order) => sum + order.total, 0)
        });
      });

      return {
        totalOrders: orders.length,
        ordersByStatus,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        topItems,
        orderTrends
      };
    } catch (error) {
      logger.error(`Error in OrderService.getOrderStats(${restaurantId}):`, error);
      throw new Error('Failed to retrieve order statistics');
    }
  }

  private validateStatusTransition(
    currentStatus: Order['status'], 
    newStatus: Order['status'], 
    userRole?: string[]
  ): OrderStatusTransition {
    const transitions: Record<Order['status'], Order['status'][]> = {
      pending: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    };

    const validNextStates = transitions[currentStatus];

    // Los clientes solo pueden cancelar pedidos pendientes
    if (newStatus === 'cancelled' && validNextStates.includes('cancelled')) {
      return { canTransition: true, validNextStates };
    }

    // Solo admins pueden cambiar a estados que no sean "cancelled"
    if (newStatus !== 'cancelled' && (!userRole || !userRole.includes('restaurant-admin'))) {
      return {
        canTransition: false,
        validNextStates,
        reason: 'Only restaurant administrators can change order status to preparing, ready, or completed'
      };
    }

    return {
      canTransition: validNextStates.includes(newStatus),
      validNextStates,
      reason: validNextStates.includes(newStatus) ? undefined : `Invalid status transition from ${currentStatus} to ${newStatus}`
    };
  }

  private calculateEstimatedPreparationTime(items: OrderItem[]): number {
    // Tiempo base: 10 minutos
    let baseTime = 10;
    
    // Tiempo adicional por item: 2 minutos por item
    const itemTime = items.reduce((sum, item) => sum + (item.quantity * 2), 0);
    
    // Tiempo adicional por complejidad (instrucciones especiales)
    const complexityTime = items.filter(item => item.specialInstructions).length * 3;
    
    return baseTime + itemTime + complexityTime;
  }

  private generateEstimatedPickupTime(estimatedMinutes: number): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + estimatedMinutes);
    
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  private async handleStatusChange(updatedOrder: Order, previousStatus: Order['status']): Promise<void> {
    try {
      // Lógica específica para cada cambio de estado
      switch (updatedOrder.status) {
        case 'preparing':
          // Notificar al cliente que el pedido está siendo preparado
          logger.info(`Order ${updatedOrder.id} started preparation`);
          break;
          
        case 'ready':
          // Notificar al cliente que el pedido está listo para recoger
          logger.info(`Order ${updatedOrder.id} is ready for pickup`);
          break;
          
        case 'completed':
          // Marcar como completado, actualizar estadísticas
          logger.info(`Order ${updatedOrder.id} completed`);
          break;
          
        case 'cancelled':
          // Procesar cancelación, posibles reembolsos
          logger.info(`Order ${updatedOrder.id} cancelled`);
          break;
      }
      
      // Aquí podrías agregar:
      // - Envío de notificaciones push/email
      // - Actualización de inventario
      // - Logging para auditoría
      // - Integración con sistemas de pago
      
    } catch (error) {
      logger.error(`Error handling status change for order ${updatedOrder.id}:`, error);
      // No lanzar error para no afectar la transacción principal
    }
  }
}