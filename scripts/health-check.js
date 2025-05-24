#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Configuración de servicios
const services = [
  {
    name: 'API Principal',
    url: process.env.API_URL || 'http://localhost:3000/health',
    timeout: 5000
  },
  {
    name: 'Search Service',
    url: process.env.SEARCH_URL || 'http://localhost:3001/health',
    timeout: 5000
  },
  {
    name: 'Auth Service',
    url: process.env.AUTH_URL || 'http://localhost:3002/auth/health',
    timeout: 5000
  }
];

// Función para hacer request HTTP
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'GET',
      timeout: timeout,
      headers: {
        'User-Agent': 'HealthCheck/1.0'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: parsed,
            responseTime: Date.now() - startTime
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            responseTime: Date.now() - startTime,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    const startTime = Date.now();
    req.end();
  });
}

// Función para verificar salud de un servicio
async function checkServiceHealth(service) {
  const startTime = Date.now();
  
  try {
    const result = await makeRequest(service.url, service.timeout);
    const responseTime = Date.now() - startTime;
    
    const isHealthy = result.statusCode >= 200 && result.statusCode < 300;
    
    return {
      name: service.name,
      url: service.url,
      status: isHealthy ? 'healthy' : 'unhealthy',
      statusCode: result.statusCode,
      responseTime: responseTime,
      data: result.data,
      error: result.error
    };
  } catch (error) {
    return {
      name: service.name,
      url: service.url,
      status: 'error',
      statusCode: null,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

// Función para verificar salud de bases de datos
async function checkDatabaseHealth() {
  const results = [];
  
  // Verificar MongoDB
  if (process.env.MONGODB_URI) {
    try {
      const mongoose = require('mongoose');
      const startTime = Date.now();
      
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      
      const responseTime = Date.now() - startTime;
      await mongoose.disconnect();
      
      results.push({
        name: 'MongoDB',
        status: 'healthy',
        responseTime: responseTime
      });
    } catch (error) {
      results.push({
        name: 'MongoDB',
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Verificar PostgreSQL
  if (process.env.POSTGRES_URI) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.POSTGRES_URI,
        connectionTimeoutMillis: 5000
      });
      
      const startTime = Date.now();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      
      const responseTime = Date.now() - startTime;
      
      results.push({
        name: 'PostgreSQL',
        status: 'healthy',
        responseTime: responseTime
      });
    } catch (error) {
      results.push({
        name: 'PostgreSQL',
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Verificar Redis
  if (process.env.REDIS_URI) {
    try {
      const redis = require('redis');
      const client = redis.createClient({ url: process.env.REDIS_URI });
      
      const startTime = Date.now();
      await client.connect();
      await client.ping();
      await client.quit();
      
      const responseTime = Date.now() - startTime;
      
      results.push({
        name: 'Redis',
        status: 'healthy',
        responseTime: responseTime
      });
    } catch (error) {
      results.push({
        name: 'Redis',
        status: 'error', 
        error: error.message
      });
    }
  }
  
  return results;
}

// Función principal
async function main() {
  console.log('🏥 Verificando salud de los servicios...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    overall: 'unknown',
    services: [],
    databases: [],
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      errors: 0
    }
  };

  // Verificar servicios
  console.log('🔍 Verificando servicios web...');
  for (const service of services) {
    const result = await checkServiceHealth(service);
    results.services.push(result);
    
    const icon = result.status === 'healthy' ? '✅' : 
                 result.status === 'unhealthy' ? '⚠️' : '❌';
    
    console.log(`${icon} ${result.name}: ${result.status} (${result.responseTime}ms)`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  // Verificar bases de datos
  console.log('\n📊 Verificando bases de datos...');
  const dbResults = await checkDatabaseHealth();
  results.databases = dbResults;
  
  for (const db of dbResults) {
    const icon = db.status === 'healthy' ? '✅' : '❌';
    console.log(`${icon} ${db.name}: ${db.status}${db.responseTime ? ` (${db.responseTime}ms)` : ''}`);
    if (db.error) {
      console.log(`   Error: ${db.error}`);
    }
  }

  // Calcular estadísticas
  const allChecks = [...results.services, ...results.databases];
  results.summary.total = allChecks.length;
  results.summary.healthy = allChecks.filter(c => c.status === 'healthy').length;
  results.summary.unhealthy = allChecks.filter(c => c.status === 'unhealthy').length;
  results.summary.errors = allChecks.filter(c => c.status === 'error').length;

  // Determinar estado general
  if (results.summary.errors === 0 && results.summary.unhealthy === 0) {
    results.overall = 'healthy';
  } else if (results.summary.healthy > results.summary.errors + results.summary.unhealthy) {
    results.overall = 'degraded';
  } else {
    results.overall = 'unhealthy';
  }

  // Mostrar resumen
  console.log('\n📋 Resumen:');
  console.log(`   Estado general: ${results.overall.toUpperCase()}`);
  console.log(`   Servicios saludables: ${results.summary.healthy}/${results.summary.total}`);
  console.log(`   Servicios con problemas: ${results.summary.unhealthy}`);
  console.log(`   Servicios con errores: ${results.summary.errors}`);

  // Guardar resultados en archivo
  const fs = require('fs');
  const path = require('path');
  
  try {
    const outputDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, 'health-check.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Resultados guardados en: ${outputFile}`);
  } catch (error) {
    console.log(`\n⚠️ No se pudieron guardar los resultados: ${error.message}`);
  }

  // Determinar código de salida
  const exitCode = results.overall === 'healthy' ? 0 : 1;
  
  console.log(`\n${results.overall === 'healthy' ? '🎉' : '💥'} Health check completado\n`);
  
  // En modo CI/CD, salir con código de error si hay problemas
  if (process.env.CI) {
    process.exit(exitCode);
  }
  
  return results;
}

// Función para mostrar ayuda
function showHelp() {
  console.log(`
🏥 Health Check Script para Restaurant System

Uso:
  node scripts/health-check.js [opciones]

Opciones:
  --help, -h          Mostrar esta ayuda
  --json              Mostrar solo salida JSON
  --services-only     Verificar solo servicios web
  --databases-only    Verificar solo bases de datos
  --timeout <ms>      Timeout para requests (default: 5000ms)

Variables de entorno:
  API_URL            URL del API principal
  SEARCH_URL         URL del servicio de búsqueda  
  AUTH_URL           URL del servicio de auth
  MONGODB_URI        URI de MongoDB
  POSTGRES_URI       URI de PostgreSQL
  REDIS_URI          URI de Redis

Ejemplos:
  npm run health
  node scripts/health-check.js --json
  node scripts/health-check.js --services-only
`);
}

// Procesar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Configurar timeout si se especifica
const timeoutIndex = args.indexOf('--timeout');
if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
  const customTimeout = parseInt(args[timeoutIndex + 1]);
  if (!isNaN(customTimeout)) {
    services.forEach(service => service.timeout = customTimeout);
  }
}

// Ejecutar verificación
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Error durante health check:', error);
    process.exit(1);
  });
}

module.exports = {
  checkServiceHealth,
  checkDatabaseHealth,
  makeRequest
};