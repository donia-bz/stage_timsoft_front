# 🤖 BFExpress IA Service

Microservice IA pour l'analyse et le traitement des réclamations BFExpress.

## 📋 Fonctionnalités

- **Analyse de réclamations** avec IA (Azure OpenAI ou Hugging Face)
- **Classification automatique** par priorité, sentiment et type de problème
- **Génération de réponses** personnalisées (formelle, empathique, technique)
- **Détection d'anomalies** (pics de réclamations, clients irrités, problèmes récurrents)
- **Support multi-provider** (Azure OpenAI ou Hugging Face local)
- **API REST** avec FastAPI
- **Logging avancé** avec Loguru
- **Fallback rule-based** si IA indisponible

## 🚀 Installation

### Prérequis

- Python 3.9+
- pip

### Installation

```bash
# Cloner ou naviguer vers le répertoire
cd ia-service

# Créer environnement virtuel
python -m venv venv

# Activer l'environnement
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

## ⚙️ Configuration

### 1. Copier le fichier d'environnement

```bash
cp .env.example .env
```

### 2. Configurer selon le provider choisi

#### Option A: Azure OpenAI (Recommandé)

```env
# Dans .env
AZURE_OPENAI_API_KEY=votre_clé_api_azure
AZURE_OPENAI_ENDPOINT=https://votre-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
USE_LOCAL_MODEL=False
```

#### Option B: Hugging Face (Local/Gratuit)

```env
# Dans .env
USE_LOCAL_MODEL=True
HUGGINGFACE_MODEL=camembert-base
HUGGINGFACE_SENTIMENT_MODEL=camembert-base-sentiment
HUGGINGFACE_CLASSIFIER=facebook/bart-large-mnli
```

## 🎯 Démarrage

### Développement

```bash
# Démarrage avec auto-reload
python -m app.main
```

### Production

```bash
# Démarrage sans reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Avec Docker (Optionnel)

```bash
# Construire l'image
docker build -t bfexpress-ia-service .

# Démarrer le conteneur
docker run -p 8000:8000 --env-file .env bfexpress-ia-service
```

## 📡 API Endpoints

### Health Check

```http
GET /health
```

### Analyser une réclamation

```http
POST /api/ia/analyser-reclamation
Content-Type: application/json

{
  "reclamation_id": "REC123",
  "description": "Mon colis est en retard de 3 jours",
  "type_reclamation": "RETARD",
  "client_id": "CLIENT456",
  "commande_id": "CMD789",
  "date_creation": "2024-01-15T10:00:00Z"
}
```

**Response:**
```json
{
  "reclamation_id": "REC123",
  "priorite": "URGENT",
  "sentiment": "NEGATIF",
  "probleme_detecte": "Retard de livraison",
  "suggestion_action": "Vérifier statut et proposer compensation",
  "temps_resolution_estime": 8,
  "confidence": 0.85,
  "mots_cles": ["retard", "jours", "colis"],
  "date_analyse": "2024-01-15T10:05:00Z"
}
```

### Générer une réponse

```http
POST /api/ia/generer-reponse
Content-Type: application/json

{
  "reclamation_id": "REC123",
  "type_reponse": "EMPATHIQUE",
  "contexte": {
    "client_name": "Jean Dupont",
    "ref_commande": "CMD789",
    "ref_reclamation": "REC123",
    "statut": "EN_RETARD",
    "probleme": "Retard de livraison",
    "temps_estime": "8"
  }
}
```

### Détecter des anomalies

```http
POST /api/ia/anomalies-reclamations
Content-Type: application/json

{
  "reclamations": [
    {
      "id": "REC1",
      "clientId": "CLIENT1",
      "type": "RETARD",
      "dateCreation": "2024-01-15T10:00:00Z"
    }
  ],
  "periode_jours": 7
}
```

## 🔌 Intégration avec Frontend Angular

### 1. Mettre à jour environment.ts

```typescript
// environments/environment.ts
export const environment = {
  // ... autres configs
  iaUrl: 'http://localhost:8000',
};
```

### 2. Mettre à jour ApiService

```typescript
// app/services/api.service.ts
analyserReclamation(reclamationId: string, description: string, type?: string): Observable<any> {
  return this.http.post<any>(`${environment.iaUrl}/api/ia/analyser-reclamation`, {
    reclamation_id: reclamationId,
    description,
    type_reclamation: type
  });
}

genererReponseReclamation(reclamationId: string, type: string, contexte: any): Observable<any> {
  return this.http.post<any>(`${environment.iaUrl}/api/ia/generer-reponse`, {
    reclamation_id: reclamationId,
    type_reponse: type,
    contexte
  });
}

detecterAnomalies(reclamations: any[], periodeJours: number): Observable<any> {
  return this.http.post<any>(`${environment.iaUrl}/api/ia/anomalies-reclamations`, {
    reclamations,
    periode_jours: periodeJours
  });
}
```

### 3. Mettre à jour Dashboard Admin

```typescript
// Dans dashboard-admin.component.ts
analyserReclamationsIA(): void {
  this.apiService.analyserReclamation(rec.id, rec.description, rec.type).subscribe({
    next: (analysis) => {
      this.reclamationsAnalysis[rec.id] = analysis;
    },
    error: (err) => {
      console.error('Erreur IA:', err);
      // Fallback vers analyse rule-based
    }
  });
}
```

## 📊 Architecture

```
Frontend (Angular)
    ↓ HTTP
FastAPI Service
    ↓
IA Provider (Azure OpenAI / Hugging Face)
    ↓
Analysis & Response Generation
```

## 🔧 Développement

### Structure du projet

```
ia-service/
├── app/
│   ├── __init__.py
│   ├── main.py           # Application FastAPI
│   ├── config.py         # Configuration
│   ├── models.py         # Modèles Pydantic
│   └── ia_service.py     # Service IA principal
├── logs/                 # Logs
├── models/               # Modèles téléchargés (HF)
├── requirements.txt      # Dépendances
├── .env.example         # Configuration exemple
└── README.md            # Documentation
```

### Tests

```bash
# Tests unitaires (à implémenter)
pytest tests/

# Tests API
pytest tests/test_api.py
```

## 🐛 Dépannage

### Problème: Import error transformers

**Solution:**
```bash
pip install torch transformers
```

### Problème: Azure OpenAI connection error

**Solution:**
- Vérifier la clé API
- Vérifier l'endpoint
- Vérifier la version de l'API

### Problème: Hugging Face model download slow

**Solution:**
- Utiliser un modèle plus petit
- Télécharger le modèle manuellement
- Utiliser un miroir Hugging Face

## 📈 Performance

### Temps de réponse estimés

- **Azure OpenAI**: 1-3 secondes
- **Hugging Face Local**: 0.5-2 secondes (selon GPU)
- **Rule-based fallback**: <0.1 seconde

### Optimisations

- Lazy loading des modèles Hugging Face
- Cache des analyses
- Batch processing pour multiples requêtes
- Async/await pour IO bound operations

## 🔐 Sécurité

- **API Keys**: Stocker dans .env, jamais commit
- **CORS**: Configurer les origines autorisées
- **Rate Limiting**: À implémenter avec slowapi
- **Logging**: Ne jamais logger de données sensibles

## 🚀 Déploiement

### Azure App Service

```bash
# Créer web app
az webapp create --resource-group BFExpress --plan BFExpressPlan --name bfexpress-ia

# Déployer
az webapp up --name bfexpress-ia
```

### Docker Container

```bash
# Build
docker build -t bfexpress-ia:latest .

# Push
docker push your-registry/bfexpress-ia:latest

# Deploy
kubectl apply -f k8s-deployment.yaml
```

## 📝 Roadmap

- [ ] Fine-tuning sur données BFExpress
- [ ] Interface admin pour monitoring
- [ ] Dashboard analytics
- [ ] Support multilingue (FR/AR)
- [ ] Voice-to-text pour réclamations vocales
- [ ] Intégration notifications temps réel

## 🤝 Contribution

Pour contribuer:
1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📞 Support

Pour questions ou problèmes:
- Issues GitHub
- Email: support@bfexpress.tn
- Documentation: `/docs` endpoint

## 📄 Licence

Propriétaire - BFExpress

---

**Développé avec ❤️ pour BFExpress**