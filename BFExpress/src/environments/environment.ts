export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
  authUrl: 'http://localhost:8082/api',
  trackingUrl: 'http://localhost:8083/api',
  livreursUrl: 'http://localhost:8084/api',  // Utilise le service Spring Boot existant
  iaUrl: 'http://localhost:8001',  // Nouveau microservice IA FastAPI
  iaJavaUrl: 'http://localhost:8085/api/ia', // Ancien service IA Java
  adressesUrl: 'http://localhost:8082/api/adresses',
  vehiclesUrl: 'http://localhost:8086/api',  // Utilise le service Spring Boot existant
  depotsUrl: 'http://localhost:8087/api',
  reclamationsUrl: 'http://localhost:8088/api',
  statsUrl: 'http://localhost:8089/api',
  // WebSocket URLs (sans /api) - Utilise les services Spring Boot existants
  trackingWsUrl: 'http://localhost:8083',
  livreursWsUrl: 'http://localhost:8084',
  vehiclesWsUrl: 'http://localhost:8086',
  // URL du service tracking pour les manifestes
  trackingServiceUrl: 'http://localhost:8083'
};
