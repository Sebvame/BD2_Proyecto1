// Script para inicializar MongoDB en producción

// Crear base de datos
db = db.getSiblingDB('restaurant_db');

// Crear colecciones con validación de esquema
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'role'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        email: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        role: {
          enum: ['customer', 'restaurant-admin'],
          description: 'debe ser customer o restaurant-admin y es requerido'
        },
        createdAt: {
          bsonType: 'string',
          description: 'debe ser una cadena ISO date'
        }
      }
    }
  }
});

db.createCollection('restaurants', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'description', 'address', 'phone', 'imageUrl', 'cuisine', 'priceRange', 'openingHours'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        description: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        address: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        phone: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        imageUrl: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        cuisine: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        rating: {
          bsonType: 'number',
          description: 'debe ser un número'
        },
        priceRange: {
          enum: [1, 2, 3],
          description: 'debe ser 1, 2 o 3 y es requerido'
        },
        openingHours: {
          bsonType: 'object',
          required: ['opens', 'closes'],
          properties: {
            opens: {
              bsonType: 'string',
              description: 'debe ser una cadena en formato HH:MM y es requerido'
            },
            closes: {
              bsonType: 'string',
              description: 'debe ser una cadena en formato HH:MM y es requerido'
            }
          }
        }
      }
    }
  }
});

db.createCollection('menuitems', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['restaurantId', 'name', 'price', 'imageUrl', 'category'],
      properties: {
        restaurantId: {
          bsonType: 'objectId',
          description: 'debe ser un ObjectId y es requerido'
        },
        name: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        description: {
          bsonType: 'string',
          description: 'debe ser una cadena'
        },
        price: {
          bsonType: 'number',
          description: 'debe ser un número y es requerido'
        },
        imageUrl: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        category: {
          bsonType: 'string',
          description: 'debe ser una cadena y es requerido'
        },
        featured: {
          bsonType: 'bool',
          description: 'debe ser un booleano'
        },
        available: {
          bsonType: 'bool',
          description: 'debe ser un booleano'
        }
      }
    }
  }
});

db.createCollection('reservations', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'restaurantId', 'date', 'time', 'partySize', 'status'],
      properties: {
        userId: {
          bsonType: 'objectId',
          description: 'debe ser un ObjectId y es requerido'
        },
        restaurantId: {
          bsonType: 'objectId',
          description: 'debe ser un ObjectId y es requerido'
        },
        date: {
          bsonType: 'string',
          description: 'debe ser una cadena en formato YYYY-MM-DD y es requerido'
        },
        time: {
          bsonType: 'string',
          description: 'debe ser una cadena en formato HH:MM y es requerido'
        },
        partySize: {
          bsonType: 'int',
          description: 'debe ser un entero y es requerido'
        },
        status: {
          enum: ['pending', 'confirmed', 'cancelled'],
          description: 'debe ser pending, confirmed o cancelled y es requerido'
        },
        notes: {
          bsonType: 'string',
          description: 'debe ser una cadena'
        }
      }
    }
  }
});

db.createCollection('orders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'restaurantId', 'items', 'status', 'total', 'createdAt'],
      properties: {
        userId: {
          bsonType: 'objectId',
          description: 'debe ser un ObjectId y es requerido'
        },
        restaurantId: {
          bsonType: 'objectId',
          description: 'debe ser un ObjectId y es requerido'
        },
        items: {
          bsonType: 'array',
          description: 'debe ser un array y es requerido',
          items: {
            bsonType: 'object',
            required: ['menuItemId', 'name', 'price', 'quantity'],
            properties: {
              menuItemId: {
                bsonType: 'objectId',
                description: 'debe ser un ObjectId y es requerido'
              },
              name: {
                bsonType: 'string',
                description: 'debe ser una cadena y es requerido'
              },
              price: {
                bsonType: 'number',
                description: 'debe ser un número y es requerido'
              },
              quantity: {
                bsonType: 'int',
                minimum: 1,
                description: 'debe ser un entero mayor que 0 y es requerido'
              },
              specialInstructions: {
                bsonType: 'string',
                description: 'debe ser una cadena'
              }
            }
          }
        },
        status: {
          enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
          description: 'debe ser pending, preparing, ready, completed o cancelled y es requerido'
        },
        total: {
          bsonType: 'number',
          description: 'debe ser un número y es requerido'
        },
        createdAt: {
          bsonType: 'string',
          description: 'debe ser una cadena ISO date y es requerido'
        },
        pickupTime: {
          bsonType: 'string',
          description: 'debe ser una cadena en formato HH:MM'
        }
      }
    }
  }
});

// Crear índices
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

db.restaurants.createIndex({ name: 'text', cuisine: 'text', description: 'text' });
db.restaurants.createIndex({ cuisine: 1 });
db.restaurants.createIndex({ priceRange: 1 });

db.menuitems.createIndex({ restaurantId: 1 });
db.menuitems.createIndex({ category: 1 });
db.menuitems.createIndex({ name: 'text', description: 'text', category: 'text' });
db.menuitems.createIndex({ featured: 1 });

db.reservations.createIndex({ userId: 1 });
db.reservations.createIndex({ restaurantId: 1 });
db.reservations.createIndex({ date: 1 });
db.reservations.createIndex({ status: 1 });

db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ restaurantId: 1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ createdAt: 1 });

// Configurar sharding
// La configuración de sharding se hace desde el script mongo-init en docker-compose.yml