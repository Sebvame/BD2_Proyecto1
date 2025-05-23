import { User, Restaurant, MenuItem, Reservation, Order } from '../../models';

export interface Repository<T> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(item: Omit<T, 'id'>): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export interface UserRepository extends Repository<User> {
  findByEmail(email: string): Promise<User | null>;
  findByRole(role: User['role']): Promise<User[]>;
}

export interface RestaurantRepository extends Repository<Restaurant> {
  findByCuisine(cuisine: string): Promise<Restaurant[]>;
  findByPriceRange(priceRange: Restaurant['priceRange']): Promise<Restaurant[]>;
  searchRestaurants(query: string): Promise<Restaurant[]>;
}

export interface MenuItemRepository extends Repository<MenuItem> {
  findByRestaurantId(restaurantId: string): Promise<MenuItem[]>;
  findByCategory(category: string): Promise<MenuItem[]>;
  findFeaturedItems(): Promise<MenuItem[]>;
  findByRestaurantAndCategory(restaurantId: string, category: string): Promise<MenuItem[]>;
  findAvailableByRestaurant(restaurantId: string): Promise<MenuItem[]>;
  updateAvailability(id: string, available: boolean): Promise<MenuItem | null>;
}

export interface ReservationRepository extends Repository<Reservation> {
  findByUserId(userId: string): Promise<Reservation[]>;
  findByRestaurantId(restaurantId: string): Promise<Reservation[]>;
  findByDateRange(restaurantId: string, startDate: string, endDate: string): Promise<Reservation[]>;
  updateStatus(id: string, status: Reservation['status']): Promise<Reservation | null>;
  findActiveReservations(restaurantId: string): Promise<Reservation[]>;
  findByDateAndTime(restaurantId: string, date: string, time: string): Promise<Reservation[]>;
  countReservationsByDate(restaurantId: string, date: string): Promise<number>;
}

export interface OrderRepository extends Repository<Order> {
  findByUserId(userId: string): Promise<Order[]>;
  findByRestaurantId(restaurantId: string): Promise<Order[]>;
  findByStatus(status: Order['status']): Promise<Order[]>;
  updateStatus(id: string, status: Order['status']): Promise<Order | null>;
  findActiveOrders(restaurantId: string): Promise<Order[]>;
  findOrdersByDateRange(restaurantId: string, startDate: string, endDate: string): Promise<Order[]>;
  calculateTotalRevenue(restaurantId: string, startDate?: string, endDate?: string): Promise<number>;
  updatePickupTime(id: string, pickupTime: string): Promise<Order | null>;
  findRecentOrdersByUser(userId: string, limit?: number): Promise<Order[]>;
}