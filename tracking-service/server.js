const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8090;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://donia:jCn8Pt1ZhyF5ewRy@timsoftstage.192tpcj.mongodb.net/bfexpress-tracking?retryWrites=true&w=majority';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connecté'))
.catch(err => console.error('❌ Erreur MongoDB:', err));

// Schéma MongoDB pour les positions des livreurs
const driverPositionSchema = new mongoose.Schema({
  livreurId: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  telephone: { type: String },
  gouvernorat: { type: String },
  statut: { type: String, enum: ['DISPONIBLE', 'EN_COURSE', 'EN_PAUSE', 'HORS_SERVICE'], default: 'DISPONIBLE' },
  position: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    altitude: { type: Number, default: 0 },
    accuracy: { type: Number },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 }
  },
  vehicule: {
    immatriculation: { type: String },
    type: { type: String },
    modele: { type: String }
  },
  derniereMiseAJour: { type: Date, default: Date.now },
  zone: { type: String },
  coursesEnCours: [{ type: mongoose.Schema.Types.ObjectId }],
  historique: [{
    position: {
      latitude: Number,
      longitude: Number
    },
    timestamp: { type: Date, default: Date.now },
    statut: String
  }]
}, {
  timestamps: true
});

// Index pour optimiser les requêtes géospatiales
driverPositionSchema.index({ 'position.latitude': 1, 'position.longitude': 1 });
driverPositionSchema.index({ livreurId: 1 });
driverPositionSchema.index({ statut: 1 });
driverPositionSchema.index({ gouvernorat: 1 });

const DriverPosition = mongoose.model('DriverPosition', driverPositionSchema);

// Schéma pour les dépôts
const depotSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
  adresse: String,
  ville: String,
  gouvernorat: String,
  position: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  capacite: { type: Number, default: 500 },
  capaciteActuelle: { type: Number, default: 0 },
  statut: { type: String, enum: ['ACTIF', 'INACTIF'], default: 'ACTIF' }
}, {
  timestamps: true
});

const Depot = mongoose.model('Depot', depotSchema);

// Schéma pour le suivi des manifestes
const manifestTrackingSchema = new mongoose.Schema({
  manifestId: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  clientName: { type: String, required: true },
  nombreColis: { type: Number, required: true },
  totalCOD: { type: Number, default: 0 },
  statut: { 
    type: String, 
    enum: ['EN_ATTENTE_RAMASSAGE', 'EN_COURS_RAMASSAGE', 'RAMASSE', 'AU_DEPOT', 'EN_DISTRIBUTION', 'LIVRE', 'ANNULE'],
    default: 'EN_ATTENTE_RAMASSAGE'
  },
  livreurId: { type: String },
  depotId: { type: String },
  dateCreation: { type: Date, default: Date.now },
  dateRamassage: { type: Date },
  dateDepot: { type: Date },
  dateDistribution: { type: Date },
  dateLivraison: { type: Date },
  positionsHistorique: [{
    latitude: Number,
    longitude: Number,
    timestamp: { type: Date, default: Date.now },
    statut: String,
    livreurId: String
  }],
  notifications: [{
    type: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    lue: { type: Boolean, default: false }
  }]
}, {
  timestamps: true
});

const ManifestTracking = mongoose.model('ManifestTracking', manifestTrackingSchema);

// Schéma pour les livraisons
const livraisonSchema = new mongoose.Schema({
  colisId: { type: String, required: true, unique: true },
  commandeId: { type: String },
  livreurId: { type: String, required: true },
  statut: { 
    type: String, 
    enum: ['ASSIGNEE', 'EN_COURS', 'LIVREE', 'ANNULEE'], 
    default: 'ASSIGNEE' 
  },
  dateAffectation: { type: Date, default: Date.now },
  dateLivraison: { type: Date },
  positionDepart: {
    latitude: Number,
    longitude: Number
  },
  positionArrivee: {
    latitude: Number,
    longitude: Number
  }
}, {
  timestamps: true
});

const Livraison = mongoose.model('Livraison', livraisonSchema);

// Socket.io pour temps réel
io.on('connection', (socket) => {
  console.log('🔌 Client connecté:', socket.id);

  // Envoyer les positions actuelles au nouveau client
  DriverPosition.find({}).then(positions => {
    socket.emit('initial-positions', positions);
  });

  // Abonnement aux mises à jour de positions
  socket.on('subscribe-positions', () => {
    socket.join('positions-updates');
    console.log('👤 Client abonné aux positions:', socket.id);
  });

  // Abonnement aux notifications admin
  socket.on('subscribe-admin-notifications', () => {
    socket.join('admin-notifications');
    console.log('👤 Admin connecté:', socket.id);
  });

  // Abonnement aux notifications client spécifique
  socket.on('subscribe-client-notifications', (clientId) => {
    socket.join(`client-${clientId}`);
    console.log('👤 Client abonné aux notifications:', clientId);
  });

  // Abonnement aux notifications d'un manifeste spécifique
  socket.on('subscribe-manifest', (manifestId) => {
    socket.join(`manifest-${manifestId}`);
    console.log('👤 Client abonné au manifeste:', manifestId);
  });

  // Abonnement aux mises à jour de manifestes pour l'admin
  socket.on('subscribe-manifest-updates', () => {
    socket.join('manifest-updates');
    console.log('👤 Admin abonné aux mises à jour de manifestes');
  });

  // Enregistrement d'un nouveau manifeste pour le tracking
  socket.on('register-manifest', async (data) => {
    try {
      const { manifestId, clientId, clientName, nombreColis, totalCOD } = data;
      
      const manifestTracking = new ManifestTracking({
        manifestId,
        clientId,
        clientName,
        nombreColis,
        totalCOD: totalCOD || 0,
        statut: 'EN_ATTENTE_RAMASSAGE'
      });

      await manifestTracking.save();

      // Notifier les clients abonnés
      io.to('admin-notifications').emit('manifest-created', manifestTracking);
      io.to('manifest-updates').emit('manifest-created', manifestTracking);
      io.to(`client-${clientId}`).emit('manifest-status-update', {
        manifestId,
        statut: 'EN_ATTENTE_RAMASSAGE',
        message: 'Manifeste créé et en attente de ramassage'
      });

      socket.emit('manifest-registered', { success: true, manifestId });
    } catch (error) {
      console.error('Erreur enregistrement manifeste:', error);
      socket.emit('manifest-registered', { success: false, error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client déconnecté:', socket.id);
  });
});

// API REST pour les positions
app.get('/api/positions', async (req, res) => {
  try {
    const { statut, gouvernorat } = req.query;
    const filter = {};
    
    if (statut) filter.statut = statut;
    if (gouvernorat) filter.gouvernorat = gouvernorat;

    const positions = await DriverPosition.find(filter).sort({ derniereMiseAJour: -1 });
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/positions/:livreurId', async (req, res) => {
  try {
    const driverPosition = await DriverPosition.findOne({ livreurId: req.params.livreurId });
    if (!driverPosition) {
      return res.status(404).json({ error: 'Position non trouvée' });
    }
    res.json(driverPosition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/positions', async (req, res) => {
  try {
    const { livreurId, nom, prenom, position, statut, vehicule, gouvernorat } = req.body;

    // Sauvegarder dans l'historique
    const updateData = {
      position,
      statut,
      vehicule,
      gouvernorat,
      derniereMiseAJour: new Date()
    };

    // Ajouter à l'historique
    updateData.$push = {
      historique: {
        position,
        timestamp: new Date(),
        statut
      }
    };

    const driverPosition = await DriverPosition.findOneAndUpdate(
      { livreurId },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Diffuser la mise à jour en temps réel
    io.to('positions-updates').emit('position-update', {
      livreurId,
      position: driverPosition,
      statut,
      nom,
      prenom,
      vehicule,
      gouvernorat,
      timestamp: new Date()
    });

    // Notification admin
    io.to('admin-notifications').emit('admin-alert', {
      type: 'POSITION_UPDATE',
      message: `${nom} ${prenom} a mis à jour sa position`,
      data: { livreurId, position, statut }
    });

    res.json(position);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/positions/:livreurId/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    const driverPosition = await DriverPosition.findOneAndUpdate(
      { livreurId: req.params.livreurId },
      { statut, derniereMiseAJour: new Date() },
      { new: true }
    );

    // Diffuser le changement de statut
    io.to('positions-updates').emit('status-update', {
      livreurId: req.params.livreurId,
      statut,
      timestamp: new Date()
    });

    res.json(driverPosition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API pour les dépôts
app.get('/api/depots', async (req, res) => {
  try {
    const depots = await Depot.find({ statut: 'ACTIF' });
    res.json(depots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/depots', async (req, res) => {
  try {
    const depot = new Depot(req.body);
    await depot.save();
    
    // Diffuser l'ajout de dépôt
    io.to('admin-notifications').emit('depot-added', depot);
    
    res.status(201).json(depot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API pour obtenir les positions dans un rayon géographique
app.get('/api/positions/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    
    const positions = await DriverPosition.find({
      'position.latitude': { 
        $gte: parseFloat(lat) - parseFloat(radius), 
        $lte: parseFloat(lat) + parseFloat(radius) 
      },
      'position.longitude': { 
        $gte: parseFloat(lng) - parseFloat(radius), 
        $lte: parseFloat(lng) + parseFloat(radius) 
      }
    });

    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API pour les statistiques
app.get('/api/stats', async (req, res) => {
  try {
    const totalLivreurs = await DriverPosition.countDocuments();
    const disponibles = await DriverPosition.countDocuments({ statut: 'DISPONIBLE' });
    const enCourse = await DriverPosition.countDocuments({ statut: 'EN_COURSE' });
    const depots = await Depot.countDocuments({ statut: 'ACTIF' });

    const stats = {
      totalLivreurs,
      disponibles,
      enCourse,
      depots,
      tauxActivite: totalLivreurs > 0 ? Math.round((enCourse / totalLivreurs) * 100) : 0
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MANIFEST TRACKING API ==========

// Créer un nouveau suivi de manifeste
app.post('/api/manifests', async (req, res) => {
  try {
    const { manifestId, clientId, clientName, nombreColis, totalCOD } = req.body;
    
    const manifestTracking = new ManifestTracking({
      manifestId,
      clientId,
      clientName,
      nombreColis,
      totalCOD: totalCOD || 0,
      statut: 'EN_ATTENTE_RAMASSAGE'
    });

    await manifestTracking.save();

    // Notifier les clients abonnés
    io.to('admin-notifications').emit('manifest-created', manifestTracking);
    io.to(`client-${clientId}`).emit('manifest-status-update', {
      manifestId,
      statut: 'EN_ATTENTE_RAMASSAGE',
      message: 'Manifeste créé et en attente de ramassage'
    });

    res.status(201).json(manifestTracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir le suivi d'un manifeste
app.get('/api/manifests/:manifestId', async (req, res) => {
  try {
    const manifestTracking = await ManifestTracking.findOne({ manifestId: req.params.manifestId });
    if (!manifestTracking) {
      return res.status(404).json({ error: 'Manifeste non trouvé' });
    }
    res.json(manifestTracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir tous les manifestes d'un client
app.get('/api/manifests/client/:clientId', async (req, res) => {
  try {
    const manifests = await ManifestTracking.find({ clientId: req.params.clientId })
      .sort({ dateCreation: -1 });
    res.json(manifests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour le statut d'un manifeste
app.put('/api/manifests/:manifestId/statut', async (req, res) => {
  try {
    const { statut, livreurId, depotId, position } = req.body;
    
    const updateData = { statut };
    const timestamp = new Date();

    // Mettre à jour les dates selon le statut
    switch (statut) {
      case 'EN_COURS_RAMASSAGE':
        updateData.dateRamassage = timestamp;
        updateData.livreurId = livreurId;
        break;
      case 'RAMASSE':
        updateData.dateRamassage = timestamp;
        break;
      case 'AU_DEPOT':
        updateData.dateDepot = timestamp;
        updateData.depotId = depotId;
        break;
      case 'EN_DISTRIBUTION':
        updateData.dateDistribution = timestamp;
        updateData.livreurId = livreurId;
        break;
      case 'LIVRE':
        updateData.dateLivraison = timestamp;
        break;
    }

    // Ajouter position à l'historique si fournie
    if (position && (position.latitude || position.longitude)) {
      updateData.$push = {
        positionsHistorique: {
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp,
          statut,
          livreurId: livreurId || null
        }
      };
    }

    const manifestTracking = await ManifestTracking.findOneAndUpdate(
      { manifestId: req.params.manifestId },
      updateData,
      { new: true }
    );

    if (!manifestTracking) {
      return res.status(404).json({ error: 'Manifeste non trouvé' });
    }

    // Ajouter notification
    const notification = {
      type: 'STATUS_UPDATE',
      message: `Statut du manifeste mis à jour: ${statut}`,
      timestamp,
      lue: false
    };
    manifestTracking.notifications.push(notification);
    await manifestTracking.save();

    // Diffuser la mise à jour en temps réel
    io.to('admin-notifications').emit('manifest-status-update', {
      manifestId: req.params.manifestId,
      statut,
      livreurId,
      depotId,
      timestamp
    });

    io.to('manifest-updates').emit('manifest-status-update', {
      manifestId: req.params.manifestId,
      statut,
      livreurId,
      depotId,
      timestamp
    });

    io.to(`client-${manifestTracking.clientId}`).emit('manifest-status-update', {
      manifestId: req.params.manifestId,
      statut,
      message: notification.message
    });

    res.json(manifestTracking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les notifications non lues d'un client
app.get('/api/manifests/:manifestId/notifications', async (req, res) => {
  try {
    const manifest = await ManifestTracking.findOne({ manifestId: req.params.manifestId });
    if (!manifest) {
      return res.status(404).json({ error: 'Manifeste non trouvé' });
    }

    const unreadNotifications = manifest.notifications.filter(n => !n.lue);
    res.json(unreadNotifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marquer les notifications comme lues
app.put('/api/manifests/:manifestId/notifications/read', async (req, res) => {
  try {
    const manifest = await ManifestTracking.findOneAndUpdate(
      { manifestId: req.params.manifestId },
      { $set: { 'notifications.$[].lue': true } },
      { new: true }
    );

    if (!manifest) {
      return res.status(404).json({ error: 'Manifeste non trouvé' });
    }

    res.json({ success: true, message: 'Notifications marquées comme lues' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir l'historique des positions d'un manifeste
app.get('/api/manifests/:manifestId/positions', async (req, res) => {
  try {
    const manifest = await ManifestTracking.findOne({ manifestId: req.params.manifestId });
    if (!manifest) {
      return res.status(404).json({ error: 'Manifeste non trouvé' });
    }

    res.json(manifest.positionsHistorique || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== LIVRAISONS API ==========

// Obtenir toutes les livraisons
app.get('/api/livraisons', async (req, res) => {
  try {
    const { livreurId, statut, commandeId } = req.query;
    const filter = {};
    
    if (livreurId) filter.livreurId = livreurId;
    if (statut) filter.statut = statut;
    if (commandeId) filter.commandeId = commandeId;

    const livraisons = await Livraison.find(filter).sort({ dateAffectation: -1 });
    res.json(livraisons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les livraisons d'un livreur spécifique
app.get('/api/livraisons/livreur/:livreurId', async (req, res) => {
  try {
    const { livreurId } = req.params;
    const { statut } = req.query;
    
    const filter = { livreurId };
    if (statut) filter.statut = statut;

    const livraisons = await Livraison.find(filter).sort({ dateAffectation: -1 });
    res.json(livraisons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir une livraison par ID
app.get('/api/livraisons/:id', async (req, res) => {
  try {
    const livraison = await Livraison.findById(req.params.id);
    if (!livraison) {
      return res.status(404).json({ error: 'Livraison non trouvée' });
    }
    res.json(livraison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer une nouvelle livraison
app.post('/api/livraisons', async (req, res) => {
  try {
    const { colisId, commandeId, livreurId, positionDepart, positionArrivee } = req.body;
    
    const livraison = new Livraison({
      colisId,

      commandeId,
      livreurId,
      statut: 'ASSIGNEE',
      positionDepart,
      positionArrivee
    });

    await livraison.save();

    // Diffuser la création de livraison
    io.to('admin-notifications').emit('livraison-created', livraison);
    io.to(`livreur-${livreurId}`).emit('livraison-assigned', livraison);

    res.status(201).json(livraison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour une livraison
app.put('/api/livraisons/:id', async (req, res) => {
  try {
    const { statut, positionArrivee, dateLivraison } = req.body;
    
    const updateData = {};
    if (statut) updateData.statut = statut;
    if (positionArrivee) updateData.positionArrivee = positionArrivee;
    if (dateLivraison) updateData.dateLivraison = dateLivraison;
    if (statut === 'LIVREE' && !dateLivraison) updateData.dateLivraison = new Date();

    const livraison = await Livraison.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!livraison) {
      return res.status(404).json({ error: 'Livraison non trouvée' });
    }

    // Diffuser la mise à jour
    io.to('admin-notifications').emit('livraison-updated', livraison);
    io.to(`livreur-${livraison.livreurId}`).emit('livraison-updated', livraison);

    res.json(livraison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une livraison
app.delete('/api/livraisons/:id', async (req, res) => {
  try {
    const livraison = await Livraison.findByIdAndDelete(req.params.id);
    if (!livraison) {
      return res.status(404).json({ error: 'Livraison non trouvée' });
    }

    // Diffuser la suppression
    io.to('admin-notifications').emit('livraison-deleted', { id: req.params.id });
    io.to(`livreur-${livraison.livreurId}`).emit('livraison-cancelled', { id: req.params.id });

    res.json({ success: true, message: 'Livraison supprimée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialisation des données de test
async function initializeTestData() {
  const count = await DriverPosition.countDocuments();
  if (count === 0) {
    console.log('📝 Initialisation des données de test...');
    
    const testDrivers = [
      {
        livreurId: 'DRV001',
        nom: 'Ben Ali',
        prenom: 'Ahmed',
        telephone: '+216 71 123 456',
        gouvernorat: 'Tunis',
        statut: 'DISPONIBLE',
        position: { latitude: 36.8065, longitude: 10.1815, speed: 0 },
        vehicule: { immatriculation: '123 TUN 456', type: 'FOURGON', modele: 'Renault Master' }
      },
      {
        livreurId: 'DRV002',
        nom: 'Trabelsi',
        prenom: 'Mohamed',
        telephone: '+216 72 234 567',
        gouvernorat: 'Sfax',
        statut: 'EN_COURSE',
        position: { latitude: 34.7406, longitude: 10.7603, speed: 45 },
        vehicule: { immatriculation: '456 SFX 789', type: 'CAMIONNETTE', modele: 'Piaggio' }
      },
      {
        livreurId: 'DRV003',
        nom: 'Masmoudi',
        prenom: 'Fatma',
        telephone: '+216 71 345 678',
        gouvernorat: 'Sousse',
        statut: 'DISPONIBLE',
        position: { latitude: 35.8256, longitude: 10.6084, speed: 0 },
        vehicule: { immatriculation: '789 SUS 012', type: 'UTILITAIRE', modele: 'Citroën Berlingo' }
      }
    ];

    await DriverPosition.insertMany(testDrivers);
    console.log('✅ Données de test initialisées');
  }

  const depotCount = await Depot.countDocuments();
  if (depotCount === 0) {
    console.log('📝 Initialisation des dépôts de test...');
    
    const testDepots = [
      {
        id: 'DEP001',
        nom: 'Dépôt Tunis Centre',
        adresse: '123 Avenue Habib Bourguiba',
        ville: 'Tunis',
        gouvernorat: 'Tunis',
        position: { latitude: 36.8065, longitude: 10.1815 },
        capacite: 500,
        capaciteActuelle: 120,
        statut: 'ACTIF'
      },
      {
        id: 'DEP002',
        nom: 'Dépôt Sfax Sud',
        adresse: '45 Route de Gabès',
        ville: 'Sfax',
        gouvernorat: 'Sfax',
        position: { latitude: 34.7406, longitude: 10.7603 },
        capacite: 800,
        capaciteActuelle: 200,
        statut: 'ACTIF'
      },
      {
        id: 'DEP003',
        nom: 'Dépôt Sousse Nord',
        adresse: '78 Avenue du 2 Mars',
        ville: 'Sousse',
        gouvernorat: 'Sousse',
        position: { latitude: 35.8256, longitude: 10.6084 },
        capacite: 600,
        capaciteActuelle: 150,
        statut: 'ACTIF'
      }
    ];

    await Depot.insertMany(testDepots);
    console.log('✅ Dépôts de test initialisés');
  }
}

// ========== WHATSAPP BUSINESS API ==========
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

// Envoyer un message WhatsApp
async function sendWhatsAppMessage(toPhone, message) {
  try {
    // Nettoyer le numéro de téléphone (format international sans +)
    const cleanPhone = toPhone.replace(/\D/g, '');

    const payload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Message WhatsApp envoyé:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Erreur envoi WhatsApp:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

// Endpoint pour envoyer une notification WhatsApp
app.post('/api/whatsapp/send', async (req, res) => {
  const { phone, message, type, livraisonId } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'Phone et message requis' });
  }

  const result = await sendWhatsAppMessage(phone, message);

  if (result.success) {
    // Log de la notification
    console.log(`📱 WhatsApp ${type} envoyé pour livraison ${livraisonId}`);
    res.json({ success: true, data: result.data });
  } else {
    res.status(500).json({ success: false, error: result.error });
  }
});

// Endpoint pour notifier le client (en route)
app.post('/api/whatsapp/on-route', async (req, res) => {
  const { phone, clientName, livraisonRef, estimatedTime } = req.body;

  const message = `🚚 *BFExpress - Votre colis est en route*\n\n` +
    `Bonjour ${clientName},\n\n` +
    `Votre livreur est en route pour vous livrer le colis ${livraisonRef}.\n` +
    `Temps estimé: ${estimatedTime || '15-30 minutes'}\n\n` +
    `Vous pouvez suivre sa position en temps réel sur votre dashboard.\n\n` +
    `Merci de votre confiance ! 📦`;

  const result = await sendWhatsAppMessage(phone, message);
  res.json(result);
});

// Endpoint pour notifier le client (livré)
app.post('/api/whatsapp/delivered', async (req, res) => {
  const { phone, clientName, livraisonRef } = req.body;

  const message = `✅ *BFExpress - Colis livré avec succès*\n\n` +
    `Bonjour ${clientName},\n\n` +
    `Votre colis ${livraisonRef} a été livré avec succès.\n\n` +
    `Merci d'avoir choisi BFExpress ! 🎉\n\n` +
    `Pour toute réclamation, contactez notre support.`;

  const result = await sendWhatsAppMessage(phone, message);
  res.json(result);
});

// Endpoint pour notifier le client (échec)
app.post('/api/whatsapp/failed', async (req, res) => {
  const { phone, clientName, livraisonRef, reason } = req.body;

  const reasonMessages = {
    'CLIENT_ABSENT': 'Le client était absent à l\'adresse indiquée.',
    'ADDRESS_INCORRECT': 'L\'adresse fournie est incorrecte ou incomplète.',
    'CLIENT_REFUSED': 'Le client a refusé la livraison.',
    'NO_ACCESS': 'Accès impossible à l\'adresse (bâtiment fermé, etc.).',
    'OTHER': 'Problème lors de la tentative de livraison.'
  };

  const reasonText = reasonMessages[reason] || reasonMessages['OTHER'];

  const message = `⚠️ *BFExpress - Problème de livraison*\n\n` +
    `Bonjour ${clientName},\n\n` +
    `Nous n'avons pas pu livrer votre colis ${livraisonRef}.\n\n` +
    `Raison: ${reasonText}\n\n` +
    `Veuillez nous contacter pour réorganiser la livraison.\n` +
    `Tél: +216 XX XXX XXX\n\n` +
    `Nous nous excusons pour la gêne occasionnée.`;

  const result = await sendWhatsAppMessage(phone, message);
  res.json(result);
});

// Démarrage du serveur
server.listen(PORT, async () => {
  console.log(`🚀 Tracking Service démarré sur le port ${PORT}`);
  console.log(`🔌 WebSocket ready`);
  await initializeTestData();
});

module.exports = { app, server, io };