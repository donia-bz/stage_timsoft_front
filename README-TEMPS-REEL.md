# BFExpress - Synchronisation Temps Réel

## 🚀 Architecture Temps Réel Implémentée

J'ai créé une véritable synchronisation temps réel entre votre frontend Angular et vos services backend avec MongoDB.

### 📋 Services Backend Créés

#### 1. **Service Livreurs** (`livreurs-service/`)
- **Port**: 8084
- **Base de données**: MongoDB (`bfexpress-livreurs`)
- **WebSocket**: Temps réel pour les mises à jour de livreurs
- **Fonctionnalités**:
  - CRUD complet pour les livreurs
  - Mise à jour de statut en temps réel
  - Assignation de gouvernorat
  - Suivi de position GPS
  - **Assignation de véhicules** avec synchronisation automatique vers le service véhicules
  - **Désassignation de véhicules** avec synchronisation automatique

#### 2. **Service Véhicules** (`vehicles-service/`)
- **Port**: 8086
- **Base de données**: MongoDB (`bfexpress-vehicles`)
- **WebSocket**: Temps réel pour les mises à jour de véhicules
- **Fonctionnalités**:
  - CRUD complet pour les véhicules
  - Assignation aux livreurs
  - Suivi de statut (DISPONIBLE, EN_SERVICE, MAINTENANCE)
  - Notifications temps réel aux livreurs assignés
  - **Mise à jour automatique** lors de l'assignation depuis le service livreurs

### 🔌 Services WebSocket Frontend

#### **WebsocketSyncService** (`BFExpress/src/app/services/websocket-sync.service.ts`)
Service Angular unifié qui gère toutes les connexions WebSocket:
- Connexion automatique aux services livreurs, véhicules et tracking
- Abonnement aux mises à jour en temps réel
- Gestion de la reconnexion automatique
- Notification des changements aux composants

### 📡 Événements Temps Réel

#### Événements Livreurs:
- `livreur-updated`: Mise à jour d'un livreur (statut, position, etc.)
- `initial-livreurs`: Chargement initial des livreurs

#### Événements Véhicules:
- `vehicule-updated`: Mise à jour d'un véhicule (assignation, statut, etc.)
- `initial-vehicules`: Chargement initial des véhicules

### 🎯 Composants Frontend Modifiés

#### **DashboardAdminComponent**
- Intégration du service WebSocket
- Mise à jour automatique de la liste des livreurs
- Mise à jour automatique de la flotte de véhicules
- Synchronisation des changements de statut

#### **DashboardLivreurComponent**
- S'abonne aux véhicules qui lui sont assignés
- Mise à jour automatique de "Mes véhicules"
- Notification d'assignation/désassignation de véhicules

## 🛠️ Installation et Démarrage

### 1. **Installer les dépendances des nouveaux services**

```bash
cd livreurs-service
npm install

cd ../vehicles-service
npm install
```

### 2. **Démarrer MongoDB**

Assurez-vous que MongoDB est en cours d'exécution:
```bash
mongod
```

### 3. **Démarrer tous les services**

Utilisez le script de démarrage automatique:
```bash
start-all-services.bat
```

Ou démarrez chaque service individuellement:
```bash
cd depot-service
node server.js

cd tracking-service
node server.js

cd livreurs-service
node server.js

cd vehicles-service
node server.js
```

### 4. **Démarrer le frontend Angular**

```bash
cd BFExpress
ng serve
```

## 🔌 Ports Utilisés

| Service | Port | URL API | URL WebSocket |
|---------|------|---------|---------------|
| Depot Service | 8087 | http://localhost:8087/api | - |
| Tracking Service | 8083 | http://localhost:8083/api | http://localhost:8083 |
| Livreurs Service | 8084 | http://localhost:8084/api | http://localhost:8084 |
| Vehicles Service | 8086 | http://localhost:8086/api | http://localhost:8086 |
| Frontend Angular | 4200 | http://localhost:4200 | - |

## 📊 Base de Données MongoDB

### Base de données créées:
- `bfexpress-livreurs`: Stocke les informations des livreurs
- `bfexpress-vehicles`: Stocke la flotte de véhicules
- `bfexpress-tracking`: Existe déjà pour le tracking GPS

### Collections:
- **livreurs**: Documents des livreurs avec positions, statuts, véhicules assignés
- **vehicules**: Documents des véhicules avec statuts et assignations

## 🔄 Fonctionnement Temps Réel

### Scénario 1: Admin modifie le statut d'un livreur
1. Admin change le statut via l'interface
2. Frontend envoie la requête API au service livreurs
3. Service met à jour MongoDB
4. Service WebSocket notifie tous les clients connectés
5. Dashboard admin se met à jour automatiquement
6. Si le livreur est connecté, il reçoit aussi la notification

### Scénario 2: Admin assigne un véhicule à un livreur
1. Admin assigne le véhicule via l'interface flotte
2. Frontend envoie la requête API au service livreurs
3. **Service livreurs met à jour** le document livreur (vehiculeId) dans MongoDB
4. **Service livreurs appelle automatiquement** le service véhicules pour mettre à jour le véhicule (livreurId)
5. **Service véhicules met à jour** le document véhicule dans MongoDB
6. **Services WebSocket notifient**:
   - Les admins (mise à jour de la flotte)
   - Le livreur spécifique (apparait dans "Mes véhicules")
7. Les interfaces se mettent à jour automatiquement

**Important**: L'assignation est maintenant bidirectionnelle - elle met à jour à la fois le livreur et le véhicule dans leurs bases de données respectives.

## 🧪 Tests

### Tester la synchronisation temps réel:

1. **Ouvrez deux navigateurs** sur http://localhost:4200
2. **Connectez-vous en admin** sur les deux
3. **Modifiez le statut d'un livreur** sur un navigateur
4. **Observez** que l'autre navigateur se met à jour automatiquement

### Tester l'assignation de véhicules:

1. **Admin**: Assignez un véhicule à un livreur
2. **Livreur**: Connectez-vous avec le compte du livreur
3. **Allez dans "Mes véhicules"** - le véhicule apparaît automatiquement
4. **Admin**: Désassignez le véhicule
5. **Livreur**: Le véhicule disparaît automatiquement de "Mes véhicules"

## 📝 API Endpoints Principaux

### Service Livreurs:
- `GET /api/livreurs` - Liste tous les livreurs
- `GET /api/livreurs/:id` - Détails d'un livreur
- `POST /api/livreurs` - Créer un livreur
- `PUT /api/livreurs/:id` - Mettre à jour un livreur
- `PATCH /api/livreurs/:id/statut` - Changer le statut
- `POST /api/livreurs/:livreurId/vehicule` - Assigner un véhicule

### Service Véhicules:
- `GET /api/vehicules` - Liste tous les véhicules
- `GET /api/vehicules/:id` - Détails d'un véhicule
- `GET /api/vehicules/livreur/:livreurId` - Véhicules d'un livreur
- `POST /api/vehicules` - Créer un véhicule
- `PUT /api/vehicules/:id` - Mettre à jour un véhicule
- `POST /api/vehicules/:vehiculeId/assigner` - Assigner à un livreur

## � Correction Importante - Assignation de Véhicules

### Problème résolu :
L'assignation de véhicules n'était pas permanente car :
- L'admin mettait à jour seulement le service livreurs
- Le service véhicules ne recevait pas l'information
- Le livreur ne voyait pas ses véhicules assignés

### Solution implémentée :
- Le service livreurs appelle maintenant automatiquement le service véhicules lors de l'assignation
- Les deux bases de données sont synchronisées (livreur.vehiculeId ET véhicule.livreurId)
- L'assignation est maintenant permanente et visible des deux côtés

### Dépendances ajoutées :
- `node-fetch` dans `livreurs-service/package.json` pour les appels inter-services
- Variable d'environnement `VEHICLES_SERVICE_URL` dans `.env`

## �🐛 Dépannage

### Si les services ne se connectent pas:
1. Vérifiez que MongoDB est en cours d'exécution
2. Vérifiez que les ports ne sont pas déjà utilisés
3. Consultez les logs des services dans les fenêtres de commande

### Si le frontend ne reçoit pas les mises à jour:
1. Ouvrez la console du navigateur (F12)
2. Vérifiez les messages de connexion WebSocket
3. Assurez-vous que les services backend sont démarrés

### Si vous voyez des erreurs de connexion MongoDB:
1. Vérifiez que MongoDB est démarré avec `mongod`
2. Vérifiez les chaînes de connexion dans les fichiers `.env`

## 🎉 Résultat

Vous avez maintenant une **vraie synchronisation temps réel**:
- ✅ Backend connecté à MongoDB
- ✅ WebSocket pour notifications instantanées
- ✅ Frontend Angular avec service de synchronisation
- ✅ Mises à jour automatiques sur tous les clients connectés
- ✅ Aucune donnée locale - tout persiste dans MongoDB

Les modifications que vous ferez via l'interface admin seront immédiatement visibles sur tous les autres clients connectés !