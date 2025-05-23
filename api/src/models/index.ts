export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'restaurant-admin';
  createdAt: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  imageUrl: string;
  cuisine: string;
  rating: number;
  priceRange: 1 | 2 | 3; // $ - $$$
  openingHours: {
    opens: string; // e.g. "09:00"
    closes: string; // e.g. "22:00"
  };
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  featured: boolean;
  available: boolean;
}

export interface Reservation {
  id: string;
  userId: string;
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
}

export interface Order {
  id: string;
  userId: string;
  restaurantId: string;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  total: number;
  createdAt: string;
  pickupTime?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  specialInstructions?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}