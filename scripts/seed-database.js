#!/usr/bin/env node

/**
 * Script para poblar la base de datos con datos de prueba
 * Ubicación: restaurant-system/scripts/seed-database.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Datos de ejemplo
const sampleData = {
  restaurants: [
    {
      id: "rest_001",
      name: "La Parrilla Argentina",
      description: "Auténtica parrilla argentina con las mejores carnes y vinos",
      address: "Av. Corrientes 1234, Buenos Aires",
      phone: "+54 11 4567-8900",
      imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5",
      cuisine: "Argentina",
      rating: 4.5,
      priceRange: 3,
      openingHours: {
        opens: "12:00",
        closes: "23:00"
      }
    },
    {
      id: "rest_002", 
      name: "Sushi Zen",
      description: "Sushi fresco y auténtico en ambiente zen y relajado",
      address: "Calle Japón 567, Centro",
      phone: "+54 11 4567-8901",
      imageUrl: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351",
      cuisine: "Japonesa",
      rating: 4.8,
      priceRange: 3,
      openingHours: {
        opens: "18:00",
        closes: "24:00"
      }
    },
    {
      id: "rest_003",
      name: "Pizzería Don Luigi",
      description: "Pizza artesanal italiana con horno a leña tradicional",
      address: "Via Roma 890, Palermo",
      phone: "+54 11 4567-8902", 
      imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b",
      cuisine: "Italiana",
      rating: 4.3,
      priceRange: 2,
      openingHours: {
        opens: "19:00",
        closes: "23:30"
      }
    },
    {
      id: "rest_004",
      name: "Tacos El Mariachi",
      description: "Auténticos tacos mexicanos con ingredientes frescos",
      address: "Calle México 456, Villa Crespo",
      phone: "+54 11 4567-8903",
      imageUrl: "https://images.unsplash.com/photo-1565299507177-b0ac66763828",
      cuisine: "Mexicana", 
      rating: 4.1,
      priceRange: 1,
      openingHours: {
        opens: "11:00",
        closes: "22:00"
      }
    },
    {
      id: "rest_005",
      name: "Café Central",
      description: "Café de especialidad con repostería artesanal",
      address: "Av. Santa Fe 2345, Recoleta",
      phone: "+54 11 4567-8904",
      imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb",
      cuisine: "Café",
      rating: 4.4,
      priceRange: 1,
      openingHours: {
        opens: "07:00",
        closes: "20:00"
      }
    }
  ],

  menuItems: [
    // La Parrilla Argentina
    {
      id: "menu_001",
      restaurantId: "rest_001",
      name: "Bife de Chorizo",
      description: "Jugoso bife de chorizo de 400g con guarnición a elección",
      price: 2500,
      imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d",
      category: "Carnes",
      featured: true,
      available: true
    },
    {
      id: "menu_002", 
      restaurantId: "rest_001",
      name: "Empanadas Argentinas",
      description: "Docena de empanadas caseras de carne, pollo y jamón y queso",
      price: 1200,
      imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950",
      category: "Entradas",
      featured: false,
      available: true
    },
    {
      id: "menu_003",
      restaurantId: "rest_001", 
      name: "Parrillada Completa",
      description: "Parrillada para 2 personas con chorizo, morcilla, vacío y pollo",
      price: 4500,
      imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd",
      category: "Carnes",
      featured: true,
      available: true
    },

    // Sushi Zen
    {
      id: "menu_004",
      restaurantId: "rest_002",
      name: "Combinado Sushi",
      description: "20 piezas de sushi variado con salmón, atún y langostinos",
      price: 3200,
      imageUrl: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351",
      category: "Sushi",
      featured: true,
      available: true
    },
    {
      id: "menu_005",
      restaurantId: "rest_002",
      name: "Ramen Tradicional",
      description: "Ramen con caldo de huesos, chashu, huevo y vegetales",
      price: 1800,
      imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624",
      category: "Sopas",
      featured: false,
      available: true
    },

    // Pizzería Don Luigi
    {
      id: "menu_006",
      restaurantId: "rest_003",
      name: "Pizza Margherita",
      description: "Pizza clásica con salsa de tomate, mozzarella y albahaca fresca",
      price: 1500,
      imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b",
      category: "Pizzas",
      featured: true,
      available: true
    },
    {
      id: "menu_007",
      restaurantId: "rest_003",
      name: "Lasagna della Nonna",
      description: "Lasagna casera con carne, bechamel y quesos gratinados",
      price: 1800,
      imageUrl: "https://images.unsplash.com/photo-1565299585323-38174c5a3bb8",
      category: "Pastas",
      featured: false,
      available: true
    },

    // Tacos El Mariachi  
    {
      id: "menu_008",
      restaurantId: "rest_004",
      name: "Tacos de Carnitas",
      description: "3 tacos de carnitas con cebolla, cilantro y salsa verde",
      price: 800,
      imageUrl: "https://images.unsplash.com/photo-1565299507177-b0ac66763828",
      category: "Tacos",
      featured: true,
      available: true
    },
    {
      id: "menu_009",
      restaurantId: "rest_004",
      name: "Quesadillas de Pollo",
      description: "Quesadillas con pollo, queso y vegetales, servidas con guacamole",
      price: 900,
      imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b",
      category: "Antojitos",
      featured: false,
      available: true
    },

    // Café Central
    {
      id: "menu_010",
      restaurantId: "rest_005",
      name: "Café con Medialunas",
      description: "Café de especialidad con 3 medialunas de manteca",
      price: 600,
      imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb",
      category: "Desayunos",
      featured: true,
      available: true
    }
  ],

  users: [
    {
      id: "user_001",
      name: "Juan Pérez",
      email: "juan.perez@example.com", 
      role: "customer",
      createdAt: new Date().toISOString()
    },
    {
      id: "user_002",
      name: "María García",
      email: "maria.garcia@example.com",
      role: "customer", 
      createdAt: new Date().toISOString()
    },
    {
      id: "user_003",
      name: "Admin Restaurant",
      email: "admin@restaurant.com",
      role: "restaurant-admin",
      createdAt: new Date().toISOString()
    }
  ]
};

// Función para seed con MongoDB
async function seedMongoDB() {
  const mongoose = require('mongoose');
  
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Importar modelos
    const { UserModel, RestaurantModel, MenuItemModel } = require('../api/src/repositories/mongodb/schemas');
    
    // Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    await Promise.all([
      UserModel.deleteMany({}),
      RestaurantModel.deleteMany({}), 
      MenuItemModel.deleteMany({})
    ]);
    
    // Insertar usuarios
    console.log('👥 Insertando usuarios...');
    await UserModel.insertMany(sampleData.users);
    
    // Insertar restaurantes
    console.log('🏪 Insertando restaurantes...');
    await RestaurantModel.insertMany(sampleData.restaurants);
    
    // Insertar items del menú
    console.log('🍽️ Insertando items del menú...');
    await MenuItemModel.insertMany(sampleData.menuItems);
    
    console.log('✅ Seed de MongoDB completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error en seed de MongoDB:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

// Función para seed con PostgreSQL
async function seedPostgreSQL() {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URI
  });
  
  try {
    console.log('🔄 Conectando a PostgreSQL...');
    
    // Limpiar datos existentes (en orden por foreign keys)
    console.log('🧹 Limpiando datos existentes...');
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
    await pool.query('DELETE FROM reservations');
    await pool.query('DELETE FROM menu_items');
    await pool.query('DELETE FROM restaurants');
    await pool.query('DELETE FROM users');
    
    // Insertar usuarios
    console.log('👥 Insertando usuarios...');
    for (const user of sampleData.users) {
      await pool.query(
        'INSERT INTO users (id, name, email, role, created_at) VALUES ($1, $2, $3, $4, $5)',
        [user.id, user.name, user.email, user.role, user.createdAt]
      );
    }
    
    // Insertar restaurantes
    console.log('🏪 Insertando restaurantes...');
    for (const restaurant of sampleData.restaurants) {
      await pool.query(`
        INSERT INTO restaurants (
          id, name, description, address, phone, image_url, cuisine, 
          rating, price_range, opening_hours_opens, opening_hours_closes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        restaurant.id, restaurant.name, restaurant.description, restaurant.address,
        restaurant.phone, restaurant.imageUrl, restaurant.cuisine, restaurant.rating,
        restaurant.priceRange, restaurant.openingHours.opens, restaurant.openingHours.closes
      ]);
    }
    
    // Insertar items del menú
    console.log('🍽️ Insertando items del menú...');
    for (const item of sampleData.menuItems) {
      await pool.query(`
        INSERT INTO menu_items (
          id, restaurant_id, name, description, price, image_url, 
          category, featured, available
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        item.id, item.restaurantId, item.name, item.description, item.price,
        item.imageUrl, item.category, item.featured, item.available
      ]);
    }
    
    console.log('✅ Seed de PostgreSQL completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error en seed de PostgreSQL:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Función para reindexar ElasticSearch
async function reindexElasticSearch() {
  try {
    console.log('🔍 Reindexando ElasticSearch...');
    
    const searchServiceUrl = process.env.SEARCH_SERVICE_URL || 'http://localhost:3001';
    const fetch = require('node-fetch');
    
    const response = await fetch(`${searchServiceUrl}/search/reindex`, {
      method: 'POST'
    });
    
    if (response.ok) {
      console.log('✅ ElasticSearch reindexado exitosamente');
    } else {
      console.log('⚠️ No se pudo reindexar ElasticSearch (servicio no disponible)');
    }
  } catch (error) {
    console.log('⚠️ No se pudo reindexar ElasticSearch:', error.message);
  }
}

// Función principal
async function main() {
  const dbType = process.env.DB_TYPE || 'mongodb';
  
  console.log('🌱 Iniciando seed de la base de datos...');
  console.log(`📊 Tipo de base de datos: ${dbType}`);
  
  try {
    if (dbType === 'mongodb') {
      await seedMongoDB();
    } else if (dbType === 'postgresql') {
      await seedPostgreSQL();
    } else {
      throw new Error(`Tipo de base de datos no soportado: ${dbType}`);
    }
    
    // Intentar reindexar search service
    await reindexElasticSearch();
    
    console.log('🎉 Seed completado exitosamente!');
    console.log('📈 Datos insertados:');
    console.log(`   • ${sampleData.users.length} usuarios`);
    console.log(`   • ${sampleData.restaurants.length} restaurantes`);
    console.log(`   • ${sampleData.menuItems.length} items del menú`);
    
  } catch (error) {
    console.error('💥 Error durante el seed:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { sampleData, seedMongoDB, seedPostgreSQL };