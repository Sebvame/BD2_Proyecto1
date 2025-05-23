import mongoose, { Schema } from 'mongoose';
import { User, Restaurant, MenuItem, Reservation, Order } from '../../models';

// User Schema
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['customer', 'restaurant-admin'], default: 'customer' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Restaurant Schema
const restaurantSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  imageUrl: { type: String, required: true },
  cuisine: { type: String, required: true },
  rating: { type: Number, default: 0 },
  priceRange: { type: Number, enum: [1, 2, 3], required: true },
  openingHours: {
    opens: { type: String, required: true },
    closes: { type: String, required: true }
  }
}, {
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// MenuItem Schema
const menuItemSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  name: { type: String, required: true },
  description: { type: String, default: 'Producto sin descripción' },
  price: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  category: { type: String, required: true },
  featured: { type: Boolean, default: false },
  available: { type: Boolean, default: true }
}, {
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      ret.restaurantId = ret.restaurantId.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Reservation Schema
const reservationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  partySize: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  notes: { type: String }
}, {
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      ret.userId = ret.userId.toString();
      ret.restaurantId = ret.restaurantId.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// OrderItem Schema (embedded)
const orderItemSchema = new Schema({
  menuItemId: { type: Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  specialInstructions: { type: String }
}, {
  _id: false,
  toJSON: {
    transform: (_, ret) => {
      ret.menuItemId = ret.menuItemId.toString();
      return ret;
    }
  }
});

// Order Schema
const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  items: [orderItemSchema],
  status: { 
    type: String, 
    enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  total: { type: Number, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  pickupTime: { type: String }
}, {
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      ret.userId = ret.userId.toString();
      ret.restaurantId = ret.restaurantId.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Crear índices
menuItemSchema.index({ name: 'text', description: 'text', category: 'text' });
restaurantSchema.index({ name: 'text', cuisine: 'text', description: 'text' });

// Exportar modelos
export const UserModel = mongoose.model<User & mongoose.Document>('User', userSchema);
export const RestaurantModel = mongoose.model<Restaurant & mongoose.Document>('Restaurant', restaurantSchema);
export const MenuItemModel = mongoose.model<MenuItem & mongoose.Document>('MenuItem', menuItemSchema);
export const ReservationModel = mongoose.model<Reservation & mongoose.Document>('Reservation', reservationSchema);
export const OrderModel = mongoose.model<Order & mongoose.Document>('Order', orderSchema);