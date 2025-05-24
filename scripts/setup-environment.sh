#!/bin/bash

# Script de configuración del entorno del proyecto Restaurant System
# Ubicación: restaurant-system/scripts/setup-environment.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con color
print_message() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para verificar requisitos del sistema
check_requirements() {
    print_message "Verificando requisitos del sistema..."
    
    local missing_requirements=()
    
    # Verificar Node.js
    if command_exists node; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_NODE_VERSION="18.0.0"
        if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE_VERSION" ]; then
            print_success "Node.js $NODE_VERSION está instalado"
        else
            print_error "Node.js $NODE_VERSION es muy antiguo. Se requiere >= $REQUIRED_NODE_VERSION"
            missing_requirements+=("node")
        fi
    else
        print_error "Node.js no está instalado"
        missing_requirements+=("node")
    fi
    
    # Verificar npm
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        print_success "npm $NPM_VERSION está instalado"
    else
        print_error "npm no está instalado"
        missing_requirements+=("npm")
    fi
    
    # Verificar Docker
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        print_success "Docker $DOCKER_VERSION está instalado"
    else
        print_warning "Docker no está instalado (opcional para desarrollo local)"
    fi
    
    # Verificar Docker Compose
    if command_exists docker-compose; then
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
        print_success "Docker Compose $COMPOSE_VERSION está instalado"
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version | cut -d' ' -f3)
        print_success "Docker Compose $COMPOSE_VERSION está instalado"
    else
        print_warning "Docker Compose no está instalado (opcional para desarrollo local)"
    fi
    
    # Verificar Git
    if command_exists git; then
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        print_success "Git $GIT_VERSION está instalado"
    else
        print_error "Git no está instalado"
        missing_requirements+=("git")
    fi
    
    if [ ${#missing_requirements[@]} -ne 0 ]; then
        print_error "Faltan dependencias requeridas: ${missing_requirements[*]}"
        print_message "Por favor instala las dependencias faltantes y ejecuta el script nuevamente"
        exit 1
    fi
    
    print_success "Todos los requisitos están cumplidos"
}

# Función para crear estructura de directorios
create_directories() {
    print_message "Creando estructura de directorios..."
    
    local dirs=(
        "logs"
        "uploads"
        "backups"
        "monitoring/prometheus"
        "monitoring/grafana/provisioning/datasources"
        "monitoring/grafana/provisioning/dashboards"
        "monitoring/fluentd/conf"
        "nginx/ssl"
        "redis"
        "docs"
        "api/src/tests/unit"
        "api/src/tests/integration"
        "search-service/src/tests"
        "auth-service/src/tests"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_success "Directorio creado: $dir"
        else
            print_message "Directorio ya existe: $dir"
        fi
    done
}

# Función para configurar archivos de entorno
setup_environment_files() {
    print_message "Configurando archivos de entorno..."
    
    # Copiar .env.example a .env.development si no existe
    if [ ! -f ".env.development" ] && [ -f ".env.example" ]; then
        cp .env.example .env.development
        print_success "Archivo .env.development creado desde .env.example"
    fi
    
    # Crear .env.staging si no existe
    if [ ! -f ".env.staging" ]; then
        cat > .env.staging << 'EOF'
# Environment
NODE_ENV=staging

# API Configuration
PORT=3000
DB_TYPE=postgresql

# Database Configuration
POSTGRES_URI=postgresql://staging_user:staging_pass@staging-db:5432/restaurant_db_staging
REDIS_URI=redis://staging-redis:6379

# Auth0 Configuration (staging)
AUTH0_DOMAIN=staging-domain.auth0.com
AUTH0_AUDIENCE=https://staging-api.restaurant-app.com
AUTH0_CLIENT_ID=staging_client_id
AUTH0_CLIENT_SECRET=staging_client_secret

# Security
JWT_SECRET=staging-jwt-secret-change-me
SESSION_SECRET=staging-session-secret-change-me

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# CORS
ALLOWED_ORIGINS=https://staging.restaurant-app.com

# Monitoring
SENTRY_DSN=https://staging-sentry-dsn@sentry.io/project-id
EOF
        print_success "Archivo .env.staging creado"
    fi
    
    # Crear archivo .env local si no existe
    if [ ! -f ".env" ]; then
        ln -s .env.development .env
        print_success "Enlace simbólico .env -> .env.development creado"
    fi
}

# Función para instalar dependencias
install_dependencies() {
    print_message "Instalando dependencias del proyecto..."
    
    # Instalar dependencias del proyecto raíz
    print_message "Instalando dependencias del proyecto raíz..."
    npm install
    
    # Instalar dependencias de cada servicio
    local services=("api" "search-service" "auth-service")
    
    for service in "${services[@]}"; do
        if [ -d "$service" ]; then
            print_message "Instalando dependencias de $service..."
            cd "$service"
            npm install
            cd ..
            print_success "Dependencias de $service instaladas"
        else
            print_warning "Directorio $service no encontrado"
        fi
    done
}

# Función para configurar Git hooks
setup_git_hooks() {
    print_message "Configurando Git hooks..."
    
    if [ -d ".git" ]; then
        # Instalar husky
        npx husky install
        
        # Configurar pre-commit hook
        npx husky add .husky/pre-commit "npm run lint-staged"
        
        # Configurar pre-push hook
        npx husky add .husky/pre-push "npm test"
        
        print_success "Git hooks configurados"
    else
        print_warning "No es un repositorio Git. Los hooks no se configuraron"
    fi
}

# Función para generar certificados SSL para desarrollo
generate_ssl_certificates() {
    print_message "Generando certificados SSL para desarrollo..."
    
    local ssl_dir="nginx/ssl"
    
    if [ ! -f "$ssl_dir/localhost.crt" ]; then
        # Generar clave privada
        openssl genrsa -out "$ssl_dir/localhost.key" 2048 2>/dev/null
        
        # Generar certificado autofirmado
        openssl req -new -x509 -key "$ssl_dir/localhost.key" -out "$ssl_dir/localhost.crt" -days 365 -subj "/C=US/ST=Dev/L=Local/O=Restaurant/OU=Dev/CN=localhost" 2>/dev/null
        
        print_success "Certificados SSL generados para desarrollo"
    else
        print_message "Certificados SSL ya existen"
    fi
}

# Función para verificar servicios externos
check_external_services() {
    print_message "Verificando servicios externos..."
    
    # Verificar conexión a internet
    if ping -c 1 google.com >/dev/null 2>&1; then
        print_success "Conexión a internet disponible"
    else
        print_warning "No hay conexión a internet. Algunos servicios podrían no funcionar"
    fi
    
    # Verificar si hay servicios corriendo en puertos requeridos
    local ports=(3000 3001 3002 5432 27017 6379 9200)
    local occupied_ports=()
    
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            occupied_ports+=($port)
        fi
    done
    
    if [ ${#occupied_ports[@]} -ne 0 ]; then
        print_warning "Los siguientes puertos están ocupados: ${occupied_ports[*]}"
        print_warning "Esto podría causar conflictos al ejecutar los servicios"
    else
        print_success "Todos los puertos requeridos están disponibles"
    fi
}

# Función para crear archivos de configuración adicionales
create_config_files() {
    print_message "Creando archivos de configuración adicionales..."
    
    # Crear configuración de Redis
    if [ ! -f "redis/redis.conf" ]; then
        cat > redis/redis.conf << 'EOF'
# Redis configuration for Restaurant System
save 900 1
save 300 10
save 60 10000
maxmemory-policy allkeys-lru
maxmemory 256mb
timeout 300
EOF
        print_success "Configuración de Redis creada"
    fi
    
    # Crear configuración de Nginx para desarrollo
    if [ ! -f "nginx/nginx.dev.conf" ]; then
        cat > nginx/nginx.dev.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:3000;
    }
    
    upstream search {
        server search-service:3001;
    }
    
    upstream auth {
        server auth-service:3002;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        location /api/ {
            proxy_pass http://api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        location /search/ {
            proxy_pass http://search/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        location /auth/ {
            proxy_pass http://auth/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
        
        location /health {
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
        print_success "Configuración de Nginx para desarrollo creada"
    fi
}

# Función para mostrar resumen final
show_summary() {
    print_success "¡Configuración del entorno completada!"
    echo
    print_message "Resumen de configuración:"
    echo "  📁 Estructura de directorios creada"
    echo "  📄 Archivos de entorno configurados"
    echo "  📦 Dependencias instaladas"
    echo "  🔧 Git hooks configurados"
    echo "  🔒 Certificados SSL generados"
    echo "  ⚙️  Archivos de configuración creados"
    echo
    print_message "Próximos pasos:"
    echo "  1. Revisar y actualizar archivos .env con tus configuraciones"
    echo "  2. Configurar Auth0 con tus credenciales"
    echo "  3. Ejecutar 'npm run dev' para desarrollo local"
    echo "  4. Ejecutar 'npm run docker:dev' para desarrollo con Docker"
    echo
    print_message "Comandos útiles:"
    echo "  • npm run dev          - Ejecutar en modo desarrollo"
    echo "  • npm run docker:dev   - Ejecutar con Docker"
    echo "  • npm run test         - Ejecutar pruebas"
    echo "  • npm run health       - Verificar estado de servicios"
}

# Función principal
main() {
    echo "🚀 Configurando entorno del Restaurant System..."
    echo
    
    check_requirements
    create_directories
    setup_environment_files
    install_dependencies
    setup_git_hooks
    
    if command_exists openssl; then
        generate_ssl_certificates
    else
        print_warning "OpenSSL no disponible. Los certificados SSL no se generaron"
    fi
    
    check_external_services
    create_config_files
    show_summary
}

# Verificar si el script se está ejecutando desde el directorio correcto
if [ ! -f "package.json" ] || [ ! -d "api" ]; then
    print_error "Este script debe ejecutarse desde el directorio raíz del proyecto"
    exit 1
fi

# Ejecutar función principal
main "$@"