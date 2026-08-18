const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

const PORT = process.env.PORT || 8084;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bfexpress-livreurs';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connecté pour service livreurs'))
.catch(err => console.error('❌ Erreur MongoDB:', err));

// Schéma MongoDB pour les livreurs
const livreurSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nom: { type: String, required: true },
  prenom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  telephone: { type: String, required: true },
  gouvernorat: { type: String },
  typePermis: { type: String, default: 'B' },
  statut: { 
    type: String, 
    enum: ['DISPONIBLE', 'EN_COURSE', 'HORS_LIGNE', 'INSCRIPTION', 'SUSPENDU'], 
    default: 'INSCRIPTION' 
  },
  latitudeActuelle: { type: Number },
  longitudeActuelle: { type: Number },
  depotId: { type: String },
  vehiculeId: { type: String },
  noteMoyenne: { type: Number, default: 5.0 },
  nombreLivraisons: { type: Number, default: 0 },
  dateInscription: { type: Date, default: Date.now },
  adresse: String,
  ville: String,
  dateNaissance: Date,
  derniereMiseAJour: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index pour optimiser les requêtes
livreurSchema.index({ statut: 1 });
livreurSchema.index({ gouvernorat: 1 });
livreurSchema.index({ vehiculeId: 1 });
livreurSchema.index({ email: 1 });

const Livreur = mongoose.model('Livreur', livreurSchema);

// WebSocket pour temps réel
io.on('connection', (socket) => {
  console.log('🔌 Client connecté au service livreurs:', socket.id);

  // Envoyer les livreurs actuels au nouveau client
  Livreur.find({}).then(livreurs => {
    socket.emit('initial-livreurs', livreurs);
  });

  // Abonnement aux mises à jour de livreurs
  socket.on('subscribe-livreurs', () => {
    socket.join('livreurs-updates');
    console.log('👤 Client abonné aux mises à jour livreurs:', socket.id);
  });

  // Abonnement aux mises à jour d'un livreur spécifique
  socket.on('subscribe-livreur', (livreurId) => {
    socket.join(`livreur-${livreurId}`);
    console.log('👤 Client abonné au livreur:', livreurId);
  });

  // Abonnement aux notifications admin
  socket.on('subscribe-admin-updates', () => {
    socket.join('admin-updates');
    console.log('👤 Admin connecté:', socket.id);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client déconnecté du service livreurs:', socket.id);
  });
});

// Fonction pour notifier les changements
function notifyLivreurUpdate(livreur, action) {
  io.to('livreurs-updates').emit('livreur-updated', { livreur, action });
  io.to(`livreur-${livreur.id}`).emit('livreur-updated', { livreur, action });
  io.to('admin-updates').emit('livreur-updated', { livreur, action });
}

// API REST pour les livreurs
app.get('/api/livreurs', async (req, res) => {
  try {
    const { statut, gouvernorat } = req.query;
    const filter = {};
    
    if (statut) filter.statut = statut;
    if (gouvernorat) filter.gouvernorat = gouvernorat;

    const livreurs = await Livreur.find(filter).sort({ derniereMiseAJour: -1 });
    res.json(livreurs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/livreurs/:id', async (req, res) => {
  try {
    const livreur = await Livreur.findOne({ id: req.params.id });
    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/livreurs/statut/:statut', async (req, res) => {
  try {
    const livreurs = await Livreur.find({ statut: req.params.statut });
    res.json(livreurs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/livreurs/gouvernorat/:gouvernorat', async (req, res) => {
  try {
    const livreurs = await Livreur.find({ gouvernorat: req.params.gouvernorat });
    res.json(livreurs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/livreurs', async (req, res) => {
  try {
    const livreurData = {
      ...req.body,
      id: uuidv4(),
      dateInscription: new Date(),
      derniereMiseAJour: new Date()
    };

    const livreur = new Livreur(livreurData);
    await livreur.save();

    notifyLivreurUpdate(livreur, 'created');
    res.status(201).json(livreur);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Livreur avec cet email existe déjà' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/livreurs/:id', async (req, res) => {
  try {
    const livreur = await Livreur.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body, derniereMiseAJour: new Date() },
      { new: true, runValidators: true }
    );

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    notifyLivreurUpdate(livreur, 'updated');
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/livreurs/:id/statut', async (req, res) => {
  try {
    const { statut } = req.body;
    
    const livreur = await Livreur.findOneAndUpdate(
      { id: req.params.id },
      { statut, derniereMiseAJour: new Date() },
      { new: true, runValidators: true }
    );

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    notifyLivreurUpdate(livreur, 'status-changed');
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/livreurs/:id/gouvernorat', async (req, res) => {
  try {
    const { gouvernorat } = req.query;
    
    const livreur = await Livreur.findOneAndUpdate(
      { id: req.params.id },
      { gouvernorat, derniereMiseAJour: new Date() },
      { new: true, runValidators: true }
    );

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    notifyLivreurUpdate(livreur, 'gouvernorat-assigned');
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/livreurs/:id/position', async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    const livreur = await Livreur.findOneAndUpdate(
      { id: req.params.id },
      { 
        latitudeActuelle: parseFloat(latitude),
        longitudeActuelle: parseFloat(longitude),
        derniereMiseAJour: new Date()
      },
      { new: true }
    );

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    notifyLivreurUpdate(livreur, 'position-updated');
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/livreurs/:id', async (req, res) => {
  try {
    const livreur = await Livreur.findOneAndDelete({ id: req.params.id });

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    notifyLivreurUpdate(livreur, 'deleted');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour assigner un véhicule à un livreur
app.post('/api/livreurs/:livreurId/vehicule', async (req, res) => {
  try {
    const { vehiculeId } = req.query;
    
    // Mettre à jour le livreur
    const livreur = await Livreur.findOneAndUpdate(
      { id: req.params.livreurId },
      { vehiculeId, derniereMiseAJour: new Date() },
      { new: true }
    );

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    // Mettre à jour aussi le véhicule dans le service véhicules
    try {
      const vehiclesServiceUrl = process.env.VEHICLES_SERVICE_URL || 'http://localhost:8086';
      await fetch(`${vehiclesServiceUrl}/api/vehicules/${vehiculeId}/assigner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livreurId: req.params.livreurId })
      });
      console.log(`✅ Véhicule ${vehiculeId} assigné au livreur ${req.params.livreurId} dans le service véhicules`);
    } catch (vehiclesError) {
      console.error('⚠️ Erreur lors de la mise à jour du véhicule dans le service véhicules:', vehiclesError);
      // On continue quand même car le livreur a été mis à jour
    }

    notifyLivreurUpdate(livreur, 'vehicle-assigned');
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint pour désassigner un véhicule
app.delete('/api/livreurs/:livreurId/vehicule', async (req, res) => {
  try {
    const livreur = await Livreur.findOneAndUpdate(
      { id: req.params.livreurId },
      { vehiculeId: null, derniereMiseAJour: new Date() },
      { new: true }
    );

    if (!livreur) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }

    // Désassigner aussi le véhicule dans le service véhicules
    if (livreur.vehiculeId) {
      try {
        const vehiclesServiceUrl = process.env.VEHICLES_SERVICE_URL || 'http://localhost:8086';
        await fetch(`${vehiclesServiceUrl}/api/vehicules/${livreur.vehiculeId}/desassigner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`✅ Véhicule ${livreur.vehiculeId} désassigné du livreur ${req.params.livreurId} dans le service véhicules`);
      } catch (vehiclesError) {
        console.error('⚠️ Erreur lors de la désassignation du véhicule dans le service véhicules:', vehiclesError);
        // On continue quand même car le livreur a été mis à jour
      }
    }

    notifyLivreurUpdate(livreur, 'vehicle-unassigned');
    res.json(livreur);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'livreurs-service',
    timestamp: new Date().toISOString(),
    livreursCount: 0 // Will be updated dynamically
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Service Livreurs démarré sur le port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 API endpoint: http://localhost:${PORT}/api/livreurs`);
  console.log(`🔌 WebSocket disponible pour temps réel`);
});