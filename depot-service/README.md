# Microservice Dépôts BFExpress

Service de gestion des dépôts pour BFExpress avec allocation automatique des colis selon la localisation géographique.

## 🚀 Fonctionnalités

- **Gestion complète des dépôts** : CRUD, activation/désactivation, gestion du personnel
- **Allocation automatique** : Les colis sont automatiquement assignés au dépôt optimal selon la localisation du client
- **Gestion des retours** : Les colis en échec de livraison sont retournés automatiquement au dépôt du gouvernorat du client
- **Suivi en temps réel** : Occupation des dépôts, statistiques, mouvements de colis
- **Cartographie** : Intégration avec Leaflet pour la visualisation des dépôts

## 📋 Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn

## 🔧 Installation

```bash
cd depot-service
npm install
```

## ▶️ Démarrage

```bash
# Mode développement
npm run dev

# Mode production
npm start
```

Le service démarre sur le port **8087**.

## 🌡️ Health Check

```bash
curl http://localhost:8087/health
```

Réponse attendue :
```json
{
  "status": "healthy",
  "service": "depot-service",
  "timestamp": "2024-08-14T10:30:00.000Z",
  "depotsCount": 5
}
```

## 📡 API Endpoints

### Dépôts

- `GET /api/depots` - Liste tous les dépôts
- `GET /api/depots/:id` - Récupère un dépôt par ID
- `POST /api/depots` - Crée un nouveau dépôt
- `PUT /api/depots/:id` - Met à jour un dépôt
- `DELETE /api/depots/:id` - Supprime un dépôt
- `GET /api/depots/gouvernorat/:gouvernorat` - Dépôts par gouvernorat
- `GET /api/depots/actifs` - Dépôts actifs uniquement
- `GET /api/depots/disponible/:gouvernorat` - Dépôt disponible pour un gouvernorat

### Gestion des colis

- `POST /api/depots/:depotId/colis?colisId=xxx` - Ajoute un colis à un dépôt
- `DELETE /api/depots/:depotId/colis/:colisId` - Retire un colis d'un dépôt
- `POST /api/depots/transferer-colis?colisId=xxx&depotSourceId=yyy&depotDestinationId=zzz` - Transfère un colis entre dépôts

### Allocation automatique

- `POST /api/depots/allouer-colis?colisId=xxx&clientGouvernorat=yyy` - Alloue un colis au dépôt optimal
- `POST /api/depots/allouer-retour?colisId=xxx&clientGouvernorat=yyy` - Alloue un colis de retour au dépôt du client
- `GET /api/depots/optimal/:gouvernorat` - Trouve le dépôt optimal pour un gouvernorat

### Statistiques

- `GET /api/depots/:depotId/stats` - Statistiques d'un dépôt
- `GET /api/depots/stats` - Statistiques de tous les dépôts

### Personnel

- `POST /api/depots/:depotId/personnel?personnelId=xxx` - Assigne du personnel
- `DELETE /api/depots/:depotId/personnel/:personnelId` - Retire du personnel

### Statut

- `PATCH /api/depots/:depotId/statut?statut=ACTIF` - Change le statut d'un dépôt

## 📍 Dépôts initiaux

Le service est préconfiguré avec 5 dépôts en Tunisie :

1. **Dépôt Tunis Centre** - Tunis, Ariana, Ben Arous
2. **Dépôt Sfax Sud** - Sfax, Mahdia, Kairouan
3. **Dépôt Bizerte Nord** - Bizerte, Béja, Jendouba
4. **Dépôt Sousse Centre** - Sousse, Monastir, Mahdia
5. **Dépôt Gabès Est** - Gabès, Médenine, Tataouine

## 🔄 Allocation automatique

### Logique d'allocation

1. **Priorité 1** : Dépôt dans le même gouvernorat que le client
2. **Priorité 2** : Dépôt dont la zone de couverture inclut le gouvernorat du client
3. **Priorité 3** : Dépôt avec le plus de capacité disponible

### Logique de retour

En cas d'échec de livraison, le colis est automatiquement alloué au dépôt situé dans le gouvernorat du client expéditeur.

## 🎯 Intégration Frontend

### Configuration

Dans `src/environments/environment.ts` :

```typescript
export const environment = {
  // ... autres configurations
  depotsUrl: 'http://localhost:8087/api'
};
```

### Exemple d'utilisation

```typescript
// Allouer un colis automatiquement
this.apiService.allouerColisAuDepotOptimal(colisId, clientGouvernorat).subscribe({
  next: (result) => {
    console.log(`Colis alloué au dépôt: ${result.depotNom}`);
  }
});

// Allouer un colis de retour
this.apiService.allouerColisRetourAuDepot(colisId, clientGouvernorat).subscribe({
  next: (result) => {
    console.log(`Colis retourné au dépôt: ${result.depotNom}`);
  }
});
```

## 🗄️ Structure des données

### Depot

```typescript
{
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  gouvernorat: string;
  telephone: string;
  email?: string;
  capacite: number;
  capaciteActuelle: number;
  latitude?: number;
  longitude?: number;
  statut: 'ACTIF' | 'INACTIF' | 'MAINTENANCE';
  responsable?: string;
  horairesOuverture?: string;
  dateCreation: string;
  derniereMiseAJour: string;
  colisIds: string[];
  personnelIds: string[];
  zoneCouverture: string[];
}
```

## 🧪 Tests

```bash
# Tester tous les endpoints
curl http://localhost:8087/api/depots

# Tester l'allocation automatique
curl -X POST "http://localhost:8087/api/depots/allouer-colis?colisId=COL123&clientGouvernorat=Tunis"

# Tester le retour
curl -X POST "http://localhost:8087/api/depots/allouer-retour?colisId=COL123&clientGouvernorat=Sfax"
```

## 📝 Notes

- Les données sont stockées en mémoire pour le développement
- En production, il faut intégrer une vraie base de données (MongoDB, PostgreSQL, etc.)
- Le service gère automatiquement les mouvements de colis (entrées/sorties/transferts)
- Les statistiques sont calculées en temps réel

## 🔐 Sécurité

Pour la production, ajoutez :
- Authentification JWT
- Rate limiting
- Validation des entrées
- HTTPS

## 🚀 Améliorations futures

- [ ] Intégration base de données persistante
- [ ] Authentification et autorisation
- [ ] WebSocket pour mises à jour en temps réel
- [ ] Algorithmes d'optimisation des distances
- [ ] Gestion des stocks par catégorie
- [ ] Rapports et analytics avancés