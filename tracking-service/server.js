const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8088;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bfexpress-tracking';

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

// Démarrage du serveur
server.listen(PORT, async () => {
  console.log(`🚀 Tracking Service démarré sur le port ${PORT}`);
  console.log(`🔌 WebSocket ready`);
  await initializeTestData();
});

module.exports = { app, server, io };