# BD2_Proyecto1# 🍽️ Restaurant System

Sistema completo de gestión de restaurantes construido con microservicios, TypeScript y tecnologías modernas.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Uso](#uso)
- [API Documentation](#api-documentation)
- [Desarrollo](#desarrollo)
- [Deployment](#deployment)
- [Contribución](#contribución)
- [Licencia](#licencia)

## ✨ Características

### 🏪 Gestión de Restaurantes
- ✅ CRUD completo de restaurantes
- 🔍 Búsqueda por cocina, precio y ubicación
- ⭐ Sistema de calificaciones
- 📸 Gestión de imágenes

### 🍽️ Menús y Productos
- ✅ Gestión de ítems del menú
- 🏷️ Categorización de productos
- 💰 Gestión de precios
- 🔄 Control de disponibilidad

### 📅 Reservas
- ✅ Sistema de reservas en tiempo real
- 📊 Verificación de disponibilidad
- ⏰ Gestión de horarios
- 📧 Notificaciones automáticas

### 🛒 Órdenes y Pedidos
- ✅ Sistema de pedidos para takeaway
- 📋 Estados de orden (pendiente, preparando, listo)
- 💳 Cálculo automático de totales
- 📱 Seguimiento en tiempo real

### 🔐 Autenticación y Autorización
- ✅ Auth0 integration
- 👥 Roles de usuario (cliente, admin)
- 🔒 JWT tokens
- 🛡️ Rate limiting y seguridad

### 🔍 Búsqueda Avanzada
- ✅ ElasticSearch para búsquedas rápidas
- 🎯 Autocompletado
- 🏷️ Filtros múltiples
- 📊 Resultados relevantes

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │      Nginx      │    │   Monitoring    │
│                 │    │  Load Balancer  │    │   & Logging     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   API Service   │ │  Search Service │ │  Auth Service   │
    │     :3000       │ │      :3001      │ │     :3002       │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
                │               │               │
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ MongoDB/        │ │  ElasticSearch  │ │     Redis       │
    │ PostgreSQL      │ │                 │ │   (Cache)       │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Servicios

#### 🚀 API Principal (Port 3000)
- Lógica de negocio principal
- Gestión de restaurantes, menús, reservas y órdenes
- Integración con Auth0
- Soporte para MongoDB y PostgreSQL

#### 🔍 Search Service (Port 3001)  
- Búsquedas con ElasticSearch
- Indexación automática
- Autocompletado y sugerencias
- Cache con Redis

#### 🔐 Auth Service (Port 3002)
- Autenticación con Auth0
- Gestión de sesiones
- Rate limiting
- Seguridad y validación

## 🛠️ Tecnologías

### Backend
- **Node.js** + **TypeScript**
- **Express.js** para APIs REST
- **MongoDB** con Mongoose
- **PostgreSQL** con pg
- **Redis** para caché y sesiones
- **ElasticSearch** para búsquedas

### Autenticación
- **Auth0** para autenticación
- **JWT** para tokens
- **Express-JWT** para middleware

### DevOps & Deployment
- **Docker** + **Docker Compose**
- **Nginx** como reverse proxy
- **GitHub Actions** para CI/CD
- **Prometheus** + **Grafana** para monitoring

### Desarrollo
- **ESLint** + **Prettier** para code quality
- **Husky** para Git hooks
- **Vitest** para testing
- **Concurrently** para development

## 🚀 Instalación

### Prerequisitos

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** + **Docker Compose** (opcional)
- **Git**

### Setup Rápido

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/restaurant-system.git
cd restaurant-system

# Ejecutar setup automático
chmod +x scripts/setup-environment.sh
./scripts/setup-environment.sh

# Configurar variables de entorno
cp .env.example .env.development
# Editar .env.development con tus configuraciones

# Instalar dependencias
npm run setup

# Ejecutar en modo desarrollo
npm run dev
```

### Setup Manual

```bash
# Instalar dependencias del proyecto raíz
npm install

# Instalar dependencias de cada servicio
cd api && npm install && cd ..
cd search-service && npm install && cd ..
cd auth-service && npm install && cd ..

# Configurar base de datos
npm run db:seed

# Ejecutar servicios
npm run dev
```

## 🎯 Uso

### Desarrollo Local

```bash
# Ejecutar todos los servicios
npm run dev

# Ejecutar servicios individuales
npm run dev:api        # Solo API principal
npm run dev:search     # Solo servicio de búsqueda
npm run dev:auth       # Solo servicio de auth

# Verificar salud de servicios
npm run health
```

### Con Docker

```bash
# Desarrollo con Docker
npm run docker:dev

# Ver logs
npm run docker:dev:logs

# Parar servicios
npm run docker:dev:down
```

### URLs de Desarrollo

- **API Principal**: http://localhost:3000
- **Search Service**: http://localhost:3001  
- **Auth Service**: http://localhost:3002
- **Nginx**: http://localhost
- **MongoDB Express**: http://localhost:8082
- **Redis Commander**: http://localhost:8081

## 📚 API Documentation

### Endpoints Principales

#### 🏪 Restaurantes
```
GET    /api/restaurants              # Listar restaurantes
GET    /api/restaurants/:id          # Obtener restaurante
POST   /api/restaurants              # Crear restaurante (admin)
PUT    /api/restaurants/:id          # Actualizar restaurante (admin)
DELETE /api/restaurants/:id          # Eliminar restaurante (admin)
GET    /api/restaurants/search?q=    # Buscar restaurantes
```

#### 🍽️ Menús
```
GET    /api/menu-items               # Listar items
GET    /api/menu-items/:id           # Obtener item
POST   /api/menu-items               # Crear item (admin)
PUT    /api/menu-items/:id           # Actualizar item (admin)
DELETE /api/menu-items/:id           # Eliminar item (admin)
GET    /api/menu-items/featured      # Items destacados
```

#### 📅 Reservas
```
GET    /api/reservations             # Listar reservas
POST   /api/reservations             # Crear reserva
PUT    /api/reservations/:id         # Actualizar reserva
DELETE /api/reservations/:id         # Cancelar reserva
GET    /api/reservations/availability/:restaurantId/:date  # Verificar disponibilidad
```

#### 🛒 Órdenes
```
GET    /api/orders                   # Listar órdenes
POST   /api/orders                   # Crear orden
PUT    /api/orders/:id               # Actualizar orden
PATCH  /api/orders/:id/status        # Cambiar estado
GET    /api/orders/restaurant/:id/active  # Órdenes activas
```

### Autenticación

Todos los endpoints protegidos requieren header de autorización:

```bash
Authorization: Bearer <jwt_token>
```

### Ejemplos de Uso

```bash
# Obtener lista de restaurantes
curl http://localhost:3000/api/restaurants

# Buscar productos
curl http://localhost:3001/search/products?q=pizza

# Crear reserva (requiere auth)
curl -X POST http://localhost:3000/api/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "rest_001",
    "date": "2024-12-25",
    "time": "20:00",
    "partySize": 4
  }'
```

## 👨‍💻 Desarrollo

### Estructura del Proyecto

```
restaurant-system/
├── api/                    # API principal
│   ├── src/
│   │   ├── controllers/    # Controladores REST
│   │   ├── services/       # Lógica de negocio
│   │   ├── repositories/   # Acceso a datos
│   │   ├── middleware/     # Middleware personalizado
│   │   ├── models/         # Tipos e interfaces
│   │   └── utils/          # Utilidades
├── search-service/         # Servicio de búsqueda
├── auth-service/          # Servicio de autenticación
├── docker/                # Dockerfiles
├── nginx/                 # Configuración Nginx
└── scripts/               # Scripts de utilidad
```

### Scripts Disponibles

```bash
# Desarrollo
npm run dev                # Ejecutar en desarrollo
npm run build              # Compilar proyectos
npm run start              # Ejecutar en producción

# Testing
npm test                   # Ejecutar todas las pruebas
npm run test:integration   # Pruebas de integración
npm run test:api           # Pruebas del API

# Code Quality
npm run lint               # Linter
npm run format             # Formatear código
npm run type-check         # Verificar tipos

# Base de datos
npm run db:seed            # Poblar con datos de prueba
npm run db:migrate         # Ejecutar migraciones

# Docker
npm run docker:build       # Construir imágenes
npm run docker:up          # Levantar servicios
npm run docker:down        # Parar servicios

# Utilidades
npm run health             # Health check
npm run logs               # Ver logs
npm run clean              # Limpiar archivos generados
```

### Variables de Entorno

Crear archivo `.env.development` basado en `.env.example`:

```bash
# Base de datos
DB_TYPE=mongodb                    # o 'postgresql'
MONGODB_URI=mongodb://localhost:27017/restaurant_db
POSTGRES_URI=postgresql://user:pass@localhost:5432/restaurant_db

# Auth0
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret

# Redis
REDIS_URI=redis://localhost:6379

# Seguridad
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
```

## 🚀 Deployment

### Production

```bash
# Construir para producción
npm run build

# Desplegar con Docker
npm run docker:prod

# Verificar deployment
npm run health
```

### Staging

```bash
# Usar configuración de staging
cp .env.staging .env

# Desplegar en staging
docker-compose -f docker-compose.staging.yml up -d
```

### CI/CD

El proyecto incluye GitHub Actions para:

- ✅ Linting y formateo
- ✅ Pruebas unitarias e integración
- ✅ Build de imágenes Docker
- ✅ Deployment automático
- ✅ Health checks

---

