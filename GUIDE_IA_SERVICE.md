# 🚀 Guide d'Installation - Microservice IA BFExpress

## 📋 Prérequis

- Python 3.9 ou supérieur
- pip (gestionnaire de paquets Python)
- 4GB RAM minimum (8GB recommandé pour Hugging Face)
- Optionnel: GPU NVIDIA pour Hugging Face (plus rapide)

## 🔧 Installation

### Étape 1: Naviguer vers le répertoire du service IA

```bash
cd F:\stage_timsoft_frontend\ia-service
```

### Étape 2: Créer l'environnement virtuel

```bash
python -m venv venv
```

### Étape 3: Activer l'environnement virtuel

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### Étape 4: Installer les dépendances

```bash
pip install -r requirements.txt
```

### Étape 5: Configurer l'environnement

```bash
copy .env.example .env
```

### Étape 6: Configurer le provider IA

#### Option A: Azure OpenAI (Recommandé)

Éditez le fichier `.env` et configurez:

```env
AZURE_OPENAI_API_KEY=votre_clé_api_azure
AZURE_OPENAI_ENDPOINT=https://votre-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2023-12-01-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
USE_LOCAL_MODEL=False
```

**Pour obtenir une clé Azure OpenAI:**
1. Allez sur https://portal.azure.com
2. Créez une ressource "Azure OpenAI"
3. Naviguez vers "Keys and Endpoint"
4. Copiez la clé API et l'endpoint

#### Option B: Hugging Face (Gratuit/Local)

Éditez le fichier `.env` et configurez:

```env
USE_LOCAL_MODEL=True
HUGGINGFACE_MODEL=camembert-base
HUGGINGFACE_SENTIMENT_MODEL=camembert-base-sentiment
HUGGINGFACE_CLASSIFIER=facebook/bart-large-mnli
```

**Note:** Avec cette option, les modèles seront téléchargés automatiquement au premier démarrage (environ 500MB-1GB).

## 🚀 Démarrage

### Option 1: Script de démarrage (Windows)

```bash
start.bat
```

Ce script va:
- Créer l'environnement virtuel si nécessaire
- Installer les dépendances
- Créer le fichier .env si nécessaire
- Démarrer le service

### Option 2: Démarrage manuel

```bash
# Activer l'environnement
venv\Scripts\activate

# Démarrer le service
python -m app.main
```

### Option 3: Démarrage avec uvicorn (recommandé pour production)

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## ✅ Vérification

Une fois démarré, le service devrait être accessible sur:

- **API:** http://localhost:8000
- **Documentation:** http://localhost:8000/docs
- **Health Check:** http://localhost:8000/health

Testez le health check:

```bash
curl http://localhost:8000/health
```

Response attendue:
```json
{
  "status": "healthy",
  "service": "BFExpress IA Service",
  "version": "1.0.0",
  "ia_provider": "azure ou huggingface",
  "model_loaded": true,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

## 🔌 Intégration avec Frontend

Le frontend Angular est déjà configuré pour utiliser ce service. Assurez-vous que:

1. Le service IA est démarré sur `http://localhost:8000`
2. Le frontend Angular peut accéder à cette URL (pas de CORS)

### Test d'intégration

1. Démarrez le service IA: `start.bat`
2. Démarrez le frontend Angular: `cd BFExpress && npm start`
3. Naviguez vers le dashboard admin
4. Allez dans l'onglet "Réclamations"
5. Cliquez sur "🤖 Analyser avec IA"

## 🧪 Test des Endpoints

### Test avec curl

**Analyser une réclamation:**
```bash
curl -X POST "http://localhost:8000/api/ia/analyser-reclamation" \
  -H "Content-Type: application/json" \
  -d '{
    "reclamation_id": "TEST123",
    "description": "Mon colis est en retard de 3 jours et je suis furieux",
    "type_reclamation": "RETARD"
  }'
```

**Générer une réponse:**
```bash
curl -X POST "http://localhost:8000/api/ia/generer-reponse" \
  -H "Content-Type: application/json" \
  -d '{
    "reclamation_id": "TEST123",
    "type_reponse": "EMPATHIQUE",
    "contexte": {
      "client_name": "Jean Dupont",
      "ref_commande": "CMD789"
    }
  }'
```

**Détecter des anomalies:**
```bash
curl -X POST "http://localhost:8000/api/ia/anomalies-reclamations" \
  -H "Content-Type: application/json" \
  -d '{
    "reclamations": [
      {
        "id": "REC1",
        "clientId": "CLIENT1",
        "type": "RETARD",
        "dateCreation": "2024-01-15T10:00:00Z"
      }
    ],
    "periode_jours": 7
  }'
```

### Test avec Swagger UI

Ouvrez http://localhost:8000/docs dans votre navigateur et utilisez l'interface interactive.

## 🐛 Dépannage

### Problème: "ModuleNotFoundError: No module named 'transformers'"

**Solution:**
```bash
pip install transformers torch
```

### Problème: "Connection error" avec Azure OpenAI

**Solution:**
- Vérifiez votre clé API Azure
- Vérifiez l'endpoint Azure
- Vérifiez que votre ressource Azure est active

### Problème: Téléchargement lent des modèles Hugging Face

**Solution:**
- Utilisez un modèle plus petit
- Configurez un miroir Hugging Face
- Téléchargez les modèles manuellement

### Problème: CORS error depuis le frontend

**Solution:**
Vérifiez la configuration CORS dans `app/config.py`:

```python
allowed_origins: str = "http://localhost:4200,http://localhost:4201"
```

### Problème: Port 8000 déjà utilisé

**Solution:**
Changez le port dans `.env`:
```env
PORT=8001
```

Et mettez à jour `environment.ts` dans le frontend.

## 📊 Monitoring

### Logs

Les logs sont stockés dans le répertoire `logs/`:
- `ia_service_YYYY-MM-DD.log` - Logs journaliers
- Rotation automatique à minuit
- Rétention de 30 jours

### Métriques (à implémenter)

Pour un monitoring avancé, vous pouvez ajouter:
- Prometheus metrics
- Health checks détaillés
- Performance tracking

## 🔐 Sécurité

### Variables d'environnement

Ne JAMAIS commit le fichier `.env`. Utilisez `.env.example` comme template.

### API Keys

- Stockez les clés API dans `.env`
- Ne les loggez jamais
- Utilisez des clés avec permissions limitées

### Rate Limiting

Pour la production, implémentez le rate limiting avec `slowapi`:

```bash
pip install slowapi
```

## 🚀 Déploiement

### Docker

```bash
# Construire
docker build -t bfexpress-ia-service .

# Démarrer
docker run -p 8000:8000 --env-file .env bfexpress-ia-service
```

### Azure App Service

```bash
# Créer web app
az webapp create --resource-group BFExpress --plan BFExpressPlan --name bfexpress-ia

# Déployer
az webapp up --name bfexpress-ia
```

## 📞 Support

Pour toute question:
- Documentation: http://localhost:8000/docs
- Logs: `logs/ia_service_*.log`
- Issues: Créer une issue sur le repository

---

**Bon développement avec BFExpress IA Service! 🚀**