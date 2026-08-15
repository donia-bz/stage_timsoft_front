# BFExpress Tracking Service

Service de tracking temps réel pour la géolocalisation des livreurs BFExpress avec MongoDB et WebSocket.

## 🚀 Fonctionnalités

- **Tracking temps réel** : Positions des livreurs mises à jour en temps réel
- **WebSocket** : Communication bidirectionnelle pour updates instantanés
- **MongoDB** : Stockage persistant des positions et historique
- **API REST** : Endpoints pour la gestion des positions
- **Géolocalisation** : Recherche de livreurs dans un rayon
- **Statistiques** : KPIs en temps réel (disponibilité, activité)
- **Dépôts** : Gestion des dépôts avec positions géographiques

## 📦 Installation

```bash
cd tracking-service
npm install
```

## 🔧 Configuration

Copier `.env.example` vers `.env` et configurer les variables :

```env
MONGODB_URI=mongodb://localhost:27017/bfexpress-tracking
PORT=8088
FRONTEND_URL=http://localhost:4200
```

## 🚀 Démarrage

```bash
npm start          # Production
npm run dev        # Développement avec nodemon
```

## 📡 API Endpoints

### Positions
- `GET /api/positions` - Liste de toutes les positions
- `GET /api/positions/:livreurId` - Position d'un livreur spécifique
- `POST /api/positions` - Mettre à jour une position
- `PUT /api/positions/:livreurId/statut` - Changer le statut d'un livreur
- `GET /api/positions/nearby?lat=...&lng=...&radius=5` - Livreurs dans un rayon

### Dépôts
- `GET /api/depots` - Liste des dépôts actifs
- `POST /api/depots` - Créer un nouveau dépôt

### Statistiques
- `GET /api/stats` - Statistiques globales

## 🔌 WebSocket Events

### Client → Serveur
- `subscribe-positions` - S'abonner aux mises à jour de positions
- `subscribe-admin-notifications` - S'abonner aux notifications admin

### Serveur → Client
- `initial-positions` - Positions initiales au connexion
- `position-update` - Mise à jour d'une position
- `status-update` - Changement de statut
- `admin-alert` - Notifications pour l'admin
- `depot-added` - Nouveau dépôt ajouté

## 🗄️ Schéma MongoDB

### DriverPosition
```javascript
{
  livreurId: String (unique),
  nom: String,
  prenom: String,
  telephone: String,
  gouvernorat: String,
  statut: String ('DISPONIBLE', 'EN_COURSE', 'EN_PAUSE', 'HORS_SERVICE'),
  position: {
    latitude: Number,
    longitude: Number,
    altitude: Number,
    accuracy: Number,
    speed: Number,
    heading: Number
  },
  vehicule: {
    immatriculation: String,
    type: String,
    modele: String
  },
  derniereMiseAJour: Date,
  historique: [{
    position: { latitude, longitude },
    timestamp: Date,
    statut: String
  }]
}
```

### Depot
```javascript
{
  id: String (unique),
  nom: String,
  adresse: String,
  ville: String,
  gouvernorat: String,
  position: { latitude, longitude },
  capacite: Number,
  capaciteActuelle: Number,
  statut: String ('ACTIF', 'INACTIF')
}
```

## 📱 Intégration Frontend

### Installation Socket.io Client
```bash
cd BFExpress
npm install socket.io-client
```

### Exemple d'utilisation
```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8088');

// S'abonner aux positions
socket.emit('subscribe-positions');

// Écouter les mises à jour
socket.on('position-update', (data) => {
  console.log('Position mise à jour:', data);
  // Mettre à jour la carte
});
```

## 🧪 Données de test

Le service initialise automatiquement des données de test :
- 3 livreurs avec positions dans différentes villes tunisiennes
- 3 dépôts avec positions géographiques

## 🔍 Exemples de requêtes

### Obtenir les livreurs disponibles
```bash
curl http://localhost:8088/api/positions?statut=DISPONIBLE
```

### Mettre à jour une position
```bash
curl -X POST http://localhost:8088/api/positions \
  -H "Content-Type: application/json" \
  -d '{
    "livreurId": "DRV001",
    "nom": "Ben Ali",
    "prenom": "Ahmed",
    "position": {
      "latitude": 36.8100,
      "longitude": 10.1850,
      "speed": 25
    },
    "statut": "EN_COURSE"
  }'
```

### Livreurs dans un rayon de 10km
```bash
curl "http://localhost:8088/api/positions/nearby?lat=36.8065&lng=10.1815&radius=10"
```