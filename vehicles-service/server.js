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
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

const PORT = process.env.PORT || 8086;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bfexpress-vehicles';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connecté pour service véhicules'))
.catch(err => console.error('❌ Erreur MongoDB:', err));

// Schéma MongoDB pour les véhicules
const vehiculeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  immatriculation: { type: String, required: true, unique: true },
  marque: { type: String, required: true },
  modele: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['CAMIONNETTE', 'UTILITAIRE', 'CAMION'], 
    required: true 
  },
  capaciteKg: { type: Number, required: true },
  capaciteVolume: { type: Number },
  annee: { type: Number },
  statut: { 
    type: String, 
    enum: ['DISPONIBLE', 'EN_SERVICE', 'MAINTENANCE', 'HORS_SERVICE'], 
    default: 'DISPONIBLE' 
  },
  depotId: { type: String },
  livreurId: { type: String },
  photoUrl: String,
  derniereMiseAJour: { type: Date, default: Date.now },
  dateCreation: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
vehiculeSchema.index({ statut: 1 });
vehiculeSchema.index({ livreurId: 1 });
vehiculeSchema.index({ depotId: 1 });
vehiculeSchema.index({ immatriculation: 1 });

const Vehicule = mongoose.model('Vehicule', vehiculeSchema);

// WebSocket pour temps réel
io.on('connection', (socket) => {
  console.log('🔌 Client connecté au service véhicules:', socket.id);

  // Envoyer les véhicules actuels au nouveau client
  Vehicule.find({}).then(vehicules => {
    socket.emit('initial-vehicules', vehicules);
  });

  // Abonnement aux mises à jour de véhicules
  socket.on('subscribe-vehicules', () => {
    socket.join('vehicules-updates');
    console.log('👤 Client abonné aux mises à jour véhicules:', socket.id);
  });

  // Abonnement aux mises à jour d'un véhicule spécifique
  socket.on('subscribe-vehicule', (vehiculeId) => {
    socket.join(`vehicule-${vehiculeId}`);
    console.log('👤 Client abonné au véhicule:', vehiculeId);
  });

  // Abonnement aux véhicules d'un livreur spécifique
  socket.on('subscribe-livreur-vehicules', (livreurId) => {
    socket.join(`livreur-vehicules-${livreurId}`);
    console.log('👤 Client abonné aux véhicules du livreur:', livreurId);
  });

  // Abonnement aux notifications admin
  socket.on('subscribe-admin-updates', () => {
    socket.join('admin-updates');
    console.log('👤 Admin connecté:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client déconnecté du service véhicules:', socket.id);
  });
});

// Fonction pour notifier les changements
function notifyVehiculeUpdate(vehicule, action) {
  io.to('vehicules-updates').emit('vehicule-updated', { vehicule, action });
  io.to(`vehicule-${vehicule.id}`).emit('vehicule-updated', { vehicule, action });
  
  if (vehicule.livreurId) {
    io.to(`livreur-vehicules-${vehicule.livreurId}`).emit('vehicule-updated', { vehicule, action });
  }
  
  io.to('admin-updates').emit('vehicule-updated', { vehicule, action });
}

// API REST pour les véhicules
app.get('/api/vehicules', async (req, res) => {
  try {
    const { statut, livreurId, depotId } = req.query;
    const filter = {};
    
    if (statut) filter.statut = statut;
    if (livreurId) filter.livreurId = livreurId;
    if (depotId) filter.depotId = depotId;

    const vehicules = await Vehicule.find(filter).sort({ derniereMiseAJour: -1 });
    res.json(vehicules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicules/:id', async (req, res) => {
  try {
    const vehicule = await Vehicule.findOne({ id: req.params.id });
    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }
    res.json(vehicule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/vehicules/livreur/:livreurId', async (req, res) => {
  try {
    const vehicules = await Vehicule.find({ livreurId: req.params.livreurId });
    res.json(vehicules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vehicules', async (req, res) => {
  try {
    const vehiculeData = {
      ...req.body,
      id: uuidv4(),
      dateCreation: new Date(),
      derniereMiseAJour: new Date()
    };

    const vehicule = new Vehicule(vehiculeData);
    await vehicule.save();

    notifyVehiculeUpdate(vehicule, 'created');
    res.status(201).json(vehicule);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Véhicule avec cette immatriculation existe déjà' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/vehicules/:id', async (req, res) => {
  try {
    const vehicule = await Vehicule.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body, derniereMiseAJour: new Date() },
      { new: true, runValidators: true }
    );

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    notifyVehiculeUpdate(vehicule, 'updated');
    res.json(vehicule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/vehicules/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    
    const vehicule = await Vehicule.findOneAndUpdate(
      { id: req.params.id },
      { statut, derniereMiseAJour: new Date() },
      { new: true, runValidators: true }
    );

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    notifyVehiculeUpdate(vehicule, 'status-changed');
    res.json(vehicule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/vehicules/:id', async (req, res) => {
  try {
    const vehicule = await Vehicule.findOneAndDelete({ id: req.params.id });

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    notifyVehiculeUpdate(vehicule, 'deleted');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour assigner un véhicule à un livreur
app.post('/api/vehicules/:vehiculeId/assigner', async (req, res) => {
  try {
    const { livreurId } = req.body;
    
    const vehicule = await Vehicule.findOneAndUpdate(
      { id: req.params.vehiculeId },
      { 
        livreurId, 
        statut: 'EN_SERVICE',
        derniereMiseAJour: new Date() 
      },
      { new: true }
    );

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    notifyVehiculeUpdate(vehicule, 'assigned-to-driver');
    res.json(vehicule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour désassigner un véhicule d'un livreur
app.post('/api/vehicules/:vehiculeId/desassigner', async (req, res) => {
  try {
    const vehicule = await Vehicule.findOneAndUpdate(
      { id: req.params.vehiculeId },
      { 
        livreurId: null, 
        statut: 'DISPONIBLE',
        derniereMiseAJour: new Date() 
      },
      { new: true }
    );

    if (!vehicule) {
      return res.status(404).json({ error: 'Véhicule non trouvé' });
    }

    notifyVehiculeUpdate(vehicule, 'unassigned-from-driver');
    res.json(vehicule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'vehicles-service',
    timestamp: new Date().toISOString(),
    vehiculesCount: 0 // Will be updated dynamically
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚗 Service Véhicules démarré sur le port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 API endpoint: http://localhost:${PORT}/api/vehicules`);
  console.log(`🔌 WebSocket disponible pour temps réel`);
});