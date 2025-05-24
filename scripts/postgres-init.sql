-- Script para inicializar PostgreSQL en producción

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Crear tablas
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'restaurant-admin')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  image_url TEXT NOT NULL,
  cuisine VARCHAR(100) NOT NULL,
  rating NUMERIC(2,1) DEFAULT 0,
  price_range INTEGER NOT NULL CHECK (price_range IN (1, 2, 3)),
  opening_hours_opens VARCHAR(5) NOT NULL,
  opening_hours_closes VARCHAR(5) NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT 'Producto sin descripción',
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  featured BOOLEAN DEFAULT FALSE,
  available BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date VARCHAR(10) NOT NULL, -- YYYY-MM-DD
  time VARCHAR(5) NOT NULL, -- HH:MM
  party_size INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')
  ),
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pickup_time VARCHAR(5)
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  special_instructions TEXT
);

-- Crear índices
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_restaurants_cuisine ON restaurants(cuisine);
CREATE INDEX idx_restaurants_price_range ON restaurants(price_range);
CREATE INDEX idx_restaurants_name_trgm ON restaurants USING GIN (name gin_trgm_ops);
CREATE INDEX idx_restaurants_cuisine_trgm ON restaurants USING GIN (cuisine gin_trgm_ops);

CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_featured ON menu_items(featured);
CREATE INDEX idx_menu_items_name_trgm ON menu_items USING GIN (name gin_trgm_ops);
CREATE INDEX idx_menu_items_category_trgm ON menu_items USING GIN (category gin_trgm_ops);

CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_restaurant_id ON reservations(restaurant_id);
CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_status ON reservations(status);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item_id ON order_items(menu_item_id);