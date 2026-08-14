const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 8087;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Données en mémoire (remplacer par une vraie base de données en production)
let depots = [];
let depotMouvements = [];
let depotPersonnel = [];

// Charger les données initiales depuis localStorage si disponible
function loadInitialData() {
  // Données par défaut pour la Tunisie
  const defaultDepots = [
    {
      id: 'DEP001',
      nom: 'Dépôt Tunis Centre',
      adresse: '123 Avenue Habib Bourguiba',
      ville: 'Tunis',
      gouvernorat: 'Tunis',
      telephone: '+216 71 123 456',
      email: 'tunis.centre@bfexpress.tn',
      capacite: 500,
      capaciteActuelle: 0,
      latitude: 36.8065,
      longitude: 10.1815,
      statut: 'ACTIF',
      responsable: 'Ahmed Ben Ali',
      horairesOuverture: '08:00-18:00',
      dateCreation: new Date().toISOString(),
      derniereMiseAJour: new Date().toISOString(),
      colisIds: [],
      personnelIds: [],
      zoneCouverture: ['Tunis', 'Ariana', 'Ben Arous']
    },
    {
      id: 'DEP002',
      nom: 'Dépôt Sfax Sud',
      adresse: '45 Route de Gabès',
      ville: 'Sfax',
      gouvernorat: 'Sfax',
      telephone: '+216 74 234 567',
      email: 'sfax.sud@bfexpress.tn',
      capacite: 300,
      capaciteActuelle: 0,
      latitude: 34.7406,
      longitude: 10.7603,
      statut: 'ACTIF',
      responsable: 'Fatma Trabelsi',
      horairesOuverture: '08:00-17:00',
      dateCreation: new Date().toISOString(),
      derniereMiseAJour: new Date().toISOString(),
      colisIds: [],
      personnelIds: [],
      zoneCouverture: ['Sfax', 'Mahdia', 'Kairouan']
    },
    {
      id: 'DEP003',
      nom: 'Dépôt Bizerte Nord',
      adresse: '78 Rue du Port',
      ville: 'Bizerte',
      gouvernorat: 'Bizerte',
      telephone: '+216 72 345 678',
      email: 'bizerte.nord@bfexpress.tn',
      capacite: 250,
      capaciteActuelle: 0,
      latitude: 37.2744,
      longitude: 9.8739,
      statut: 'ACTIF',
      responsable: 'Mohamed Gharbi',
      horairesOuverture: '08:00-18:00',
      dateCreation: new Date().toISOString(),
      derniereMiseAJour: new Date().toISOString(),
      colisIds: [],
      personnelIds: [],
      zoneCouverture: ['Bizerte', 'Béja', 'Jendouba']
    },
    {
      id: 'DEP004',
      nom: 'Dépôt Sousse Centre',
      adresse: '12 Avenue du 2 Mars',
      ville: 'Sousse',
      gouvernorat: 'Sousse',
      telephone: '+216 73 456 789',
      email: 'sousse.centre@bfexpress.tn',
      capacite: 350,
      capaciteActuelle: 0,
      latitude: 35.8256,
      longitude: 10.6084,
      statut: 'ACTIF',
      responsable: 'Samia Masmoudi',
      horairesOuverture: '08:00-18:00',
      dateCreation: new Date().toISOString(),
      derniereMiseAJour: new Date().toISOString(),
      colisIds: [],
      personnelIds: [],
      zoneCouverture: ['Sousse', 'Monastir', 'Mahdia']
    },
    {
      id: 'DEP005',
      nom: 'Dépôt Gabès Est',
      adresse: '56 Route de Medenine',
      ville: 'Gabès',
      gouvernorat: 'Gabès',
      telephone: '+216 75 567 890',
      email: 'gabes.est@bfexpress.tn',
      capacite: 200,
      capaciteActuelle: 0,
      latitude: 33.8815,
      longitude: 10.0982,
      statut: 'ACTIF',
      responsable: 'Khaled Hammami',
      horairesOuverture: '08:00-17:00',
      dateCreation: new Date().toISOString(),
      derniereMiseAJour: new Date().toISOString(),
      colisIds: [],
      personnelIds: [],
      zoneCouverture: ['Gabès', 'Médenine', 'Tataouine']
    }
  ];

  depots = defaultDepots;
  console.log('✅ Données initiales des dépôts chargées');
}

// Initialiser les données
loadInitialData();

// ==================== ROUTES API ====================

// GET tous les dépôts
app.get('/api/depots', (req, res) => {
  res.json(depots);
});

// GET un dépôt par ID
app.get('/api/depots/:id', (req, res) => {
  const depot = depots.find(d => d.id === req.params.id);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }
  res.json(depot);
});

// POST créer un nouveau dépôt
app.post('/api/depots', (req, res) => {
  const nouveauDepot = {
    id: 'DEP' + uuidv4().substring(0, 8),
    ...req.body,
    dateCreation: new Date().toISOString(),
    derniereMiseAJour: new Date().toISOString(),
    colisIds: [],
    personnelIds: [],
    capaciteActuelle: 0
  };

  depots.push(nouveauDepot);
  res.status(201).json(nouveauDepot);
});

// PUT mettre à jour un dépôt
app.put('/api/depots/:id', (req, res) => {
  const index = depots.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  depots[index] = {
    ...depots[index],
    ...req.body,
    id: req.params.id,
    derniereMiseAJour: new Date().toISOString()
  };

  res.json(depots[index]);
});

// DELETE supprimer un dépôt
app.delete('/api/depots/:id', (req, res) => {
  const index = depots.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  depots.splice(index, 1);
  res.status(204).send();
});

// GET dépôts par gouvernorat
app.get('/api/depots/gouvernorat/:gouvernorat', (req, res) => {
  const depotsGouvernorat = depots.filter(d =>
    d.gouvernorat.toLowerCase() === req.params.gouvernorat.toLowerCase()
  );
  res.json(depotsGouvernorat);
});

// GET dépôts actifs
app.get('/api/depots/actifs', (req, res) => {
  const depotsActifs = depots.filter(d => d.statut === 'ACTIF');
  res.json(depotsActifs);
});

// GET dépôt disponible pour un gouvernorat (avec capacité)
app.get('/api/depots/disponible/:gouvernorat', (req, res) => {
  const depotDisponible = depots.find(d =>
    d.statut === 'ACTIF' &&
    d.gouvernorat.toLowerCase() === req.params.gouvernorat.toLowerCase() &&
    d.capaciteActuelle < d.capacite
  );

  if (!depotDisponible) {
    return res.status(404).json({ error: 'Aucun dépôt disponible' });
  }

  res.json(depotDisponible);
});

// POST ajouter un colis à un dépôt
app.post('/api/depots/:depotId/colis', (req, res) => {
  const depot = depots.find(d => d.id === req.params.depotId);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  const colisId = req.query.colisId;
  if (!colisId) {
    return res.status(400).json({ error: 'ID du colis requis' });
  }

  if (depot.capaciteActuelle >= depot.capacite) {
    return res.status(400).json({ error: 'Dépôt à capacité maximale' });
  }

  if (!depot.colisIds.includes(colisId)) {
    depot.colisIds.push(colisId);
    depot.capaciteActuelle++;
    depot.derniereMiseAJour = new Date().toISOString();

    // Enregistrer le mouvement
    depotMouvements.push({
      id: uuidv4(),
      depotId: depot.id,
      colisId: colisId,
      type: 'ENTREE',
      date: new Date().toISOString()
    });
  }

  res.json(depot);
});

// DELETE retirer un colis d'un dépôt
app.delete('/api/depots/:depotId/colis/:colisId', (req, res) => {
  const depot = depots.find(d => d.id === req.params.depotId);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  const colisIndex = depot.colisIds.indexOf(req.params.colisId);
  if (colisIndex === -1) {
    return res.status(404).json({ error: 'Colis non trouvé dans ce dépôt' });
  }

  depot.colisIds.splice(colisIndex, 1);
  depot.capaciteActuelle = Math.max(0, depot.capaciteActuelle - 1);
  depot.derniereMiseAJour = new Date().toISOString();

  // Enregistrer le mouvement
  depotMouvements.push({
    id: uuidv4(),
    depotId: depot.id,
    colisId: req.params.colisId,
    type: 'SORTIE',
    date: new Date().toISOString()
  });

  res.json(depot);
});

// POST transférer un colis entre dépôts
app.post('/api/depots/transferer-colis', (req, res) => {
  const { colisId, depotSourceId, depotDestinationId } = req.query;

  const depotSource = depots.find(d => d.id === depotSourceId);
  const depotDestination = depots.find(d => d.id === depotDestinationId);

  if (!depotSource || !depotDestination) {
    return res.status(404).json({ error: 'Dépôt source ou destination non trouvé' });
  }

  if (depotDestination.capaciteActuelle >= depotDestination.capacite) {
    return res.status(400).json({ error: 'Dépôt destination à capacité maximale' });
  }

  const colisIndex = depotSource.colisIds.indexOf(colisId);
  if (colisIndex === -1) {
    return res.status(404).json({ error: 'Colis non trouvé dans le dépôt source' });
  }

  // Retirer du source
  depotSource.colisIds.splice(colisIndex, 1);
  depotSource.capaciteActuelle = Math.max(0, depotSource.capaciteActuelle - 1);

  // Ajouter à la destination
  depotDestination.colisIds.push(colisId);
  depotDestination.capaciteActuelle++;

  // Enregistrer les mouvements
  const mouvementId = uuidv4();
  depotMouvements.push({
    id: mouvementId,
    depotId: depotSource.id,
    colisId: colisId,
    type: 'SORTIE',
    date: new Date().toISOString(),
    transfertVers: depotDestination.id
  });

  depotMouvements.push({
    id: uuidv4(),
    depotId: depotDestination.id,
    colisId: colisId,
    type: 'ENTREE',
    date: new Date().toISOString(),
    transfertDe: depotSource.id
  });

  depotSource.derniereMiseAJour = new Date().toISOString();
  depotDestination.derniereMiseAJour = new Date().toISOString();

  res.json({
    message: 'Colis transféré avec succès',
    depotSource,
    depotDestination
  });
});

// GET statistiques d'un dépôt
app.get('/api/depots/:depotId/stats', (req, res) => {
  const depot = depots.find(d => d.id === req.params.depotId);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  const mouvementsDepot = depotMouvements.filter(m => m.depotId === depot.id);
  const entrees = mouvementsDepot.filter(m => m.type === 'ENTREE').length;
  const sorties = mouvementsDepot.filter(m => m.type === 'SORTIE').length;

  res.json({
    depotId: depot.id,
    nom: depot.nom,
    capacite: depot.capacite,
    capaciteActuelle: depot.capaciteActuelle,
    tauxOccupation: (depot.capaciteActuelle / depot.capacite * 100).toFixed(2),
    totalEntrees: entrees,
    totalSorties: sorties,
    totalMouvements: mouvementsDepot.length,
    statut: depot.statut
  });
});

// GET statistiques de tous les dépôts
app.get('/api/depots/stats', (req, res) => {
  const stats = depots.map(depot => {
    const mouvementsDepot = depotMouvements.filter(m => m.depotId === depot.id);
    const entrees = mouvementsDepot.filter(m => m.type === 'ENTREE').length;
    const sorties = mouvementsDepot.filter(m => m.type === 'SORTIE').length;

    return {
      depotId: depot.id,
      nom: depot.nom,
      gouvernorat: depot.gouvernorat,
      capacite: depot.capacite,
      capaciteActuelle: depot.capaciteActuelle,
      tauxOccupation: (depot.capaciteActuelle / depot.capacite * 100).toFixed(2),
      totalEntrees: entrees,
      totalSorties: sorties,
      totalMouvements: mouvementsDepot.length,
      statut: depot.statut
    };
  });

  res.json(stats);
});

// POST assigner personnel à un dépôt
app.post('/api/depots/:depotId/personnel', (req, res) => {
  const depot = depots.find(d => d.id === req.params.depotId);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  const personnelId = req.query.personnelId;
  if (!personnelId) {
    return res.status(400).json({ error: 'ID du personnel requis' });
  }

  if (!depot.personnelIds.includes(personnelId)) {
    depot.personnelIds.push(personnelId);
    depot.derniereMiseAJour = new Date().toISOString();
  }

  res.json(depot);
});

// DELETE retirer personnel d'un dépôt
app.delete('/api/depots/:depotId/personnel/:personnelId', (req, res) => {
  const depot = depots.find(d => d.id === req.params.depotId);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  const personnelIndex = depot.personnelIds.indexOf(req.params.personnelId);
  if (personnelIndex === -1) {
    return res.status(404).json({ error: 'Personnel non trouvé dans ce dépôt' });
  }

  depot.personnelIds.splice(personnelIndex, 1);
  depot.derniereMiseAJour = new Date().toISOString();

  res.json(depot);
});

// PATCH changer statut d'un dépôt
app.patch('/api/depots/:depotId/statut', (req, res) => {
  const depot = depots.find(d => d.id === req.params.depotId);
  if (!depot) {
    return res.status(404).json({ error: 'Dépôt non trouvé' });
  }

  const nouveauStatut = req.query.statut;
  if (!['ACTIF', 'INACTIF', 'MAINTENANCE'].includes(nouveauStatut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }

  depot.statut = nouveauStatut;
  depot.derniereMiseAJour = new Date().toISOString();

  res.json(depot);
});

// ==================== ALLOCATION AUTOMATIQUE ====================

// POST allouer un colis au dépôt optimal selon la localisation du client
app.post('/api/depots/allouer-colis', (req, res) => {
  const { colisId, clientGouvernorat } = req.query;

  if (!colisId || !clientGouvernorat) {
    return res.status(400).json({ error: 'colisId et clientGouvernorat requis' });
  }

  // Trouver le dépôt optimal dans le même gouvernorat
  let depotOptimal = depots.find(d =>
    d.statut === 'ACTIF' &&
    d.gouvernorat.toLowerCase() === clientGouvernorat.toLowerCase() &&
    d.capaciteActuelle < d.capacite
  );

  // Si pas de dépôt dans le même gouvernorat, chercher dans les zones couvertes
  if (!depotOptimal) {
    depotOptimal = depots.find(d =>
      d.statut === 'ACTIF' &&
      d.zoneCouverture &&
      d.zoneCouverture.some(zone => zone.toLowerCase() === clientGouvernorat.toLowerCase()) &&
      d.capaciteActuelle < d.capacite
    );
  }

  // Si toujours pas, prendre le dépôt le plus proche avec capacité
  if (!depotOptimal) {
    const depotsAvecCapacite = depots.filter(d =>
      d.statut === 'ACTIF' && d.capaciteActuelle < d.capacite
    );
    if (depotsAvecCapacite.length > 0) {
      // Prendre le premier disponible (peut être amélioré avec calcul de distance réelle)
      depotOptimal = depotsAvecCapacite[0];
    }
  }

  if (!depotOptimal) {
    return res.status(400).json({ error: 'Aucun dépôt disponible pour cette allocation' });
  }

  // Ajouter le colis au dépôt
  if (!depotOptimal.colisIds.includes(colisId)) {
    depotOptimal.colisIds.push(colisId);
    depotOptimal.capaciteActuelle++;
    depotOptimal.derniereMiseAJour = new Date().toISOString();

    // Enregistrer le mouvement
    depotMouvements.push({
      id: uuidv4(),
      depotId: depotOptimal.id,
      colisId: colisId,
      type: 'ENTREE',
      date: new Date().toISOString(),
      allocation: 'AUTOMATIQUE',
      gouvernoratClient: clientGouvernorat
    });
  }

  res.json({
    depotId: depotOptimal.id,
    depotNom: depotOptimal.nom,
    message: `Colis alloué automatiquement au dépôt ${depotOptimal.nom}`
  });
});

// POST allouer un colis de retour au dépôt du gouvernorat du client
app.post('/api/depots/allouer-retour', (req, res) => {
  const { colisId, clientGouvernorat } = req.query;

  if (!colisId || !clientGouvernorat) {
    return res.status(400).json({ error: 'colisId et clientGouvernorat requis' });
  }

  // Trouver le dépôt dans le gouvernorat du client pour le retour
  let depotRetour = depots.find(d =>
    d.statut === 'ACTIF' &&
    d.gouvernorat.toLowerCase() === clientGouvernorat.toLowerCase() &&
    d.capaciteActuelle < d.capacite
  );

  if (!depotRetour) {
    return res.status(400).json({ error: 'Aucun dépôt disponible dans le gouvernorat du client pour le retour' });
  }

  // Ajouter le colis au dépôt de retour
  if (!depotRetour.colisIds.includes(colisId)) {
    depotRetour.colisIds.push(colisId);
    depotRetour.capaciteActuelle++;
    depotRetour.derniereMiseAJour = new Date().toISOString();

    // Enregistrer le mouvement
    depotMouvements.push({
      id: uuidv4(),
      depotId: depotRetour.id,
      colisId: colisId,
      type: 'ENTREE',
      date: new Date().toISOString(),
      allocation: 'RETOUR',
      gouvernoratClient: clientGouvernorat
    });
  }

  res.json({
    depotId: depotRetour.id,
    depotNom: depotRetour.nom,
    message: `Colis de retour alloué au dépôt ${depotRetour.nom} dans le gouvernorat du client`
  });
});

// GET obtenir le dépôt optimal pour un gouvernorat
app.get('/api/depots/optimal/:gouvernorat', (req, res) => {
  const gouvernorat = req.params.gouvernorat;

  // Priorité 1: Dépôt dans le même gouvernorat
  let depotOptimal = depots.find(d =>
    d.statut === 'ACTIF' &&
    d.gouvernorat.toLowerCase() === gouvernorat.toLowerCase() &&
    d.capaciteActuelle < d.capacite
  );

  // Priorité 2: Dépôt qui couvre cette zone
  if (!depotOptimal) {
    depotOptimal = depots.find(d =>
      d.statut === 'ACTIF' &&
      d.zoneCouverture &&
      d.zoneCouverture.some(zone => zone.toLowerCase() === gouvernorat.toLowerCase()) &&
      d.capaciteActuelle < d.capacite
    );
  }

  // Priorité 3: Dépôt avec le plus de capacité disponible
  if (!depotOptimal) {
    const depotsTries = depots
      .filter(d => d.statut === 'ACTIF' && d.capaciteActuelle < d.capacite)
      .sort((a, b) => (b.capacite - b.capaciteActuelle) - (a.capacite - a.capaciteActuelle));

    if (depotsTries.length > 0) {
      depotOptimal = depotsTries[0];
    }
  }

  if (!depotOptimal) {
    return res.status(404).json({ error: 'Aucun dépôt optimal trouvé' });
  }

  res.json(depotOptimal);
});

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'depot-service',
    timestamp: new Date().toISOString(),
    depotsCount: depots.length
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🚀 Microservice Dépôts démarré sur le port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 API endpoint: http://localhost:${PORT}/api/depots`);
});