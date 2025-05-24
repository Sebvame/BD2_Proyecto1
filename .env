#!/bin/sh

# Script para ejecutar pruebas de integración

echo "Waiting for services to be ready..."

# Esperar a que los servicios estén disponibles
echo "Checking API service..."
while ! wget -q -O - "http://api-test:3000/health" | grep -q "ok"; do
  echo "API service not ready yet. Waiting..."
  sleep 5
done
echo "API service is ready."

echo "Checking Search service..."
while ! wget -q -O - "http://search-test:3001/health" | grep -q "ok"; do
  echo "Search service not ready yet. Waiting..."
  sleep 5
done
echo "Search service is ready."

echo "All services are ready. Starting tests..."

# Ejecutar pruebas de integración de la API
echo "Running API integration tests..."
npx vitest run ./integration-tests/api --reporter=json --outputFile=./test-results/api-results.json

# Ejecutar pruebas de integración del servicio de búsqueda
echo "Running Search service integration tests..."
npx vitest run ./integration-tests/search --reporter=json --outputFile=./test-results/search-results.json

# Combinar resultados
echo "Combining test results..."
jq -s 'add' ./test-results/api-results.json ./test-results/search-results.json > ./test-results/combined-results.json

# Verificar resultado
if jq -e '.numFailedTests == 0' ./test-results/combined-results.json > /dev/null; then
  echo "All tests passed successfully!"
  exit 0
else
  FAILED=$(jq '.numFailedTests' ./test-results/combined-results.json)
  echo "Tests completed with $FAILED failures"
  exit 1
fi