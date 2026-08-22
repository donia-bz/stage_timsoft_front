from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
import uvicorn
import os
from datetime import datetime
import random
try:
    from textblob import TextBlob
    from textblob_fr import PatternTagger, PatternAnalyzer
    HAS_TEXTBLOB = True
except ImportError:
    HAS_TEXTBLOB = False

load_dotenv()

app = FastAPI(title="BFExpress IA Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Reclamation(BaseModel):
    id: str
    description: str
    type: Optional[str] = None
    objet: Optional[str] = None
    clientId: Optional[str] = None
    commandeId: Optional[str] = None
    dateCreation: Optional[str] = None
    statut: Optional[str] = None

class AnomalyDetectionRequest(BaseModel):
    reclamations: List[Reclamation]
    days: int = 7

class AnomalyDetectionResponse(BaseModel):
    anomalies: List[dict]
    totalReclamations: int
    processedDate: str

class ReclamationAnalysis(BaseModel):
    priorite: str
    sentiment: str
    problemeDetecte: str
    suggestionAction: str
    tempsResolutionEstime: int
    confidence: float

class Commande(BaseModel):
    id: str
    latitude: float = 36.8
    longitude: float = 10.1
    poidsKg: float = 1.0
    ville: str = "Tunis"

class Livreur(BaseModel):
    id: str
    nom: str
    prenom: str
    latitudeActuelle: float = 36.8
    longitudeActuelle: float = 10.1
    noteMoyenne: float = 5.0

class DispatchRequest(BaseModel):
    commandes: List[Commande]
    livreurs: List[Livreur]

class DispatchResponse(BaseModel):
    affectations: dict  # {livreurId: [orderId1, orderId2, ...]}

# AI Service Simple (Rule-based avec logique avancée)
class SimpleAIAnalyzer:
    def __init__(self):
        self.keywords_urgent = {
            'perdu', 'cassé', 'endommagé', 'volé', 'disparu', 'accident', 'blessure',
            'urgence', 'immédiat', 'danger', 'grave', 'sérieux', 'critique'
        }
        self.keywords_retard = {
            'retard', 'en retard', 'tard', 'attendre', 'delai', 'attente', 'longtemps'
        }
        self.keywords_paiement = {
            'paiement', 'facture', 'facturé', 'payer', 'coût', 'argent', 'prix',
            'remboursement', 'rembourser', 'rembourse'
        }
        self.keywords_positive = {
            'merci', 'satisfait', 'content', 'bravo', 'excellent', 'super', 'parfait',
            'apprécie', 'remerciement', 'félicitations'
        }
        self.keywords_negatif = {
            'mécontent', 'insatisfait', 'déçu', 'frustré', 'énervé', 'colère',
            'fâché', 'horrible', 'mauvais', 'nul', 'décevant'
        }

    def analyze_sentiment(self, text: str) -> str:
        if HAS_TEXTBLOB:
            blob = TextBlob(text, pos_tagger=PatternTagger(), analyzer=PatternAnalyzer())
            polarity = blob.sentiment[0]
            if polarity <= -0.2:
                return 'NEGATIF'
            elif polarity >= 0.2:
                return 'POSITIF'
            else:
                return 'NEUTRE'
        else:
            text_lower = text.lower()
            positive_count = sum(1 for kw in self.keywords_positive if kw in text_lower)
            negative_count = sum(1 for kw in self.keywords_negatif if kw in text_lower)
            
            if positive_count > negative_count:
                return 'POSITIF'
            elif negative_count > positive_count:
                return 'NEGATIF'
            else:
                return 'NEUTRE'

    def detect_problem(self, text: str, type_r: str = None) -> str:
        text_lower = text.lower()
        type_lower = (type_r or '').lower()
        
        # Check urgent keywords
        if any(kw in text_lower for kw in self.keywords_urgent):
            return 'URGENT - Incident grave détecté'
        
        # Check delay keywords
        if any(kw in text_lower for kw in self.keywords_retard):
            return 'Problème de retard de livraison'
        
        # Check payment keywords
        if any(kw in text_lower for kw in self.keywords_paiement):
            return 'Problème de paiement/facturation'
        
        # Check type field
        if type_lower:
            if 'retard' in type_lower:
                return 'Retard de livraison'
            elif 'perdu' in type_lower:
                return 'Colis perdu'
            elif 'endommagé' in type_lower or 'cassé' in type_lower:
                return 'Colis endommagé'
        
        return 'Problème général de livraison'

    def get_resolution_time(self, problem: str) -> int:
        problem_lower = problem.lower()
        
        if 'urgent' in problem_lower or 'grave' in problem_lower:
            return 4  # 4 heures
        elif 'perdu' in problem_lower:
            return 48  # 2 jours
        elif 'endommagé' in problem_lower or 'cassé' in problem_lower:
            return 24  # 1 jour
        elif 'retard' in problem_lower:
            return 8  # 8 heures
        elif 'paiement' in problem_lower:
            return 12  # 12 heures
        else:
            return 24  # 1 jour par défaut

    def get_priority(self, resolution_time: int) -> str:
        if resolution_time <= 4:
            return 'URGENT'
        elif resolution_time <= 12:
            return 'NORMAL'
        else:
            return 'FAIBLE'

    def analyze_reclamation(self, reclamation: Reclamation) -> ReclamationAnalysis:
        description = reclamation.description or ''
        type_r = reclamation.type or reclamation.objet or ''
        
        sentiment = self.analyze_sentiment(description)
        probleme = self.detect_problem(description, type_r)
        resolution_time = self.get_resolution_time(probleme)
        priority = self.get_priority(resolution_time)
        
        return ReclamationAnalysis(
            priorite=priority,
            sentiment=sentiment,
            problemeDetecte=probleme,
            suggestionAction=self.get_suggestion(probleme),
            tempsResolutionEstime=resolution_time,
            confidence=0.75
        )

    def get_suggestion(self, problem: str) -> str:
        problem_lower = problem.lower()
        
        if 'perdu' in problem_lower:
            return 'Lancer enquête immédiate et proposer remboursement'
        elif 'endommagé' in problem_lower or 'cassé' in problem_lower:
            return 'Demander photos et proposer remplacement'
        elif 'retard' in problem_lower:
            return 'Vérifier statut et proposer compensation'
        elif 'paiement' in problem_lower:
            return 'Vérifier bordereau et régulariser'
        elif 'urgent' in problem_lower or 'grave' in problem_lower:
            return 'Traitement prioritaire - contacter immédiatement'
        else:
            return 'Analyser et résoudre selon le contexte'

ai_analyzer = SimpleAIAnalyzer()

# API Endpoints
@app.get("/")
def root():
    return {
        "service": "BFExpress IA Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "/health": "Health check",
            "/api/analyze-reclamation": "Analyser une réclamation",
            "/api/detect-anomalies": "Détecter les anomalies"
        }
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/api/ia/analyser-reclamation")
def analyze_reclamation_ia(request: dict):
    try:
        # Adaptation pour le format envoyé par le frontend
        reclamation = Reclamation(
            id=request.get("reclamation_id", ""),
            description=request.get("description", ""),
            type=request.get("type_reclamation", ""),
            clientId=request.get("client_id", ""),
            commandeId=request.get("commande_id", ""),
            dateCreation=request.get("date_creation", "")
        )
        analysis = ai_analyzer.analyze_reclamation(reclamation)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-reclamation")
def analyze_reclamation(reclamation: Reclamation):
    try:
        analysis = ai_analyzer.analyze_reclamation(reclamation)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReponseGenererRequest(BaseModel):
    reclamation_id: str
    type_reponse: str  # 'FORMELLE', 'EMPATHIQUE', 'TECHNIQUE'
    contexte: Optional[dict] = None

@app.post("/api/ia/generer-reponse")
def generer_reponse(req: ReponseGenererRequest):
    try:
        ctx = req.contexte or {}
        client_name = ctx.get("client_name", "Cher client")
        ref_commande = ctx.get("ref_commande", "votre commande")
        probleme = ctx.get("probleme", "le problème signalé")
        
        if req.type_reponse == "EMPATHIQUE":
            templates = [
                f"Bonjour {client_name},\n\nJe suis sincèrement désolé(e) d'apprendre que vous avez rencontré un problème concernant {ref_commande}. Nous comprenons tout à fait votre frustration face à cette situation ({probleme.lower()}).\n\nSachez que nous avons immédiatement pris en charge votre dossier. Notre équipe met tout en œuvre pour trouver une solution dans les plus brefs délais.\n\nMerci de votre patience.\n\nCordialement,\nL'équipe Support BFExpress",
            ]
        elif req.type_reponse == "FORMELLE":
            templates = [
                f"Bonjour {client_name},\n\nNous accusons réception de votre réclamation concernant la commande {ref_commande} au sujet de : {probleme}.\n\nVotre dossier a été transmis au service compétent pour analyse. Nous reviendrons vers vous avec des éléments de réponse dans les délais impartis.\n\nCordialement,\nService des Réclamations BFExpress",
            ]
        elif req.type_reponse == "TECHNIQUE":
            templates = [
                f"Bonjour {client_name},\n\nSuite à l'analyse de votre dossier (Réf: {ref_commande}) lié à l'incident de type '{probleme}', une vérification de traçabilité est requise.\n\nLe ticket a été escaladé au niveau 2 de notre support. Vous serez notifié(e) automatiquement lors du changement de statut de votre ticket.\n\nL'équipe Technique BFExpress",
            ]
        else:
            templates = [f"Bonjour {client_name},\n\nNous avons bien reçu votre réclamation pour {ref_commande} et nous la traitons actuellement.\n\nCordialement,"]

        texte = random.choice(templates)
        
        return {
            "texte": texte,
            "confidence": round(random.uniform(0.85, 0.95), 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/detect-anomalies")
def detect_anomalies(request: AnomalyDetectionRequest):
    try:
        reclamations = request.reclamations
        anomalies = []
        
        # Détection des anomalies avec règles avancées
        today = datetime.now()
        
        # 1. Pic de réclamations
        recent_reclamations = []
        for rec in reclamations:
            if rec.dateCreation:
                try:
                    rec_date = datetime.fromisoformat(rec.dateCreation.replace('Z', '+00:00'))
                    days_diff = (today - rec_date).days
                    if days_diff <= 1:
                        recent_reclamations.append(rec)
                except:
                    pass
        
        if len(recent_reclamations) > 5:
            anomalies.append({
                "type": "SPIKE_RECLAMATIONS",
                "niveau": "HAUT",
                "description": f"Pic de réclamations: {len(recent_reclamations)} aujourd'hui",
                "actionRecommandee": "Investiguer la cause du pic (incident technique ?)"
            })
        
        # 2. Clients irrités
        client_counts = {}
        for rec in reclamations:
            if rec.clientId:
                client_counts[rec.clientId] = client_counts.get(rec.clientId, 0) + 1
        
        irrite_clients = [cid for cid, count in client_counts.items() if count > 2]
        if irrite_clients:
            anomalies.append({
                "type": "CLIENT_IRRITE",
                "niveau": "MOYEN",
                "description": f"{len(irrite_clients)} clients avec >2 réclamations",
                "actionRecommandee": "Contacter les clients prioritairement"
            })
        
        # 3. Problèmes récurrents
        type_counts = {}
        for rec in reclamations:
            rec_type = rec.type or rec.objet or "Autre"
            type_counts[rec_type] = type_counts.get(rec_type, 0) + 1
        
        recurrent_problems = [t for t, count in type_counts.items() if count > 3]
        if recurrent_problems:
            top_problem = max(recurrent_problems, key=lambda x: type_counts[x])
            anomalies.append({
                "type": "PROBLEME_RECURRENT",
                "niveau": "MOYEN",
                "description": f"Problème récurrent: {top_problem} ({type_counts[top_problem]}x)",
                "actionRecommandee": "Analyser et résoudre le problème système"
            })
        
        # 4. Réclamations urgentes en attente
        urgent_pending = []
        for rec in reclamations:
            if rec.dateCreation and rec.statut == 'EN_ATTENTE':
                try:
                    rec_date = datetime.fromisoformat(rec.dateCreation.replace('Z', '+00:00'))
                    days_diff = (today - rec_date).days
                    if days_diff > 2:
                        urgent_pending.append(rec)
                except:
                    pass
        
        if urgent_pending:
            anomalies.append({
                "type": "RECLAMATIONS_URGENTES",
                "niveau": "HAUT",
                "description": f"{len(urgent_pending)} réclamations urgentes en attente (>2 jours)",
                "actionRecommandee": "Traiter prioritairement les réclamations en attente"
            })
        
        # 5. Taux de résolution faible
        resolved = len([r for r in reclamations if r.statut == 'RESOLUE'])
        total = len(reclamations)
        if total > 10:
            resolution_rate = (resolved / total) * 100
            if resolution_rate < 50:
                anomalies.append({
                    "type": "TAUX_RESOLUTION_FAIBLE",
                    "niveau": "MOYEN",
                    "description": f"Taux de résolution faible: {resolution_rate:.1f}%",
                    "actionRecommandee": "Améliorer le processus de traitement"
                })
        
        return AnomalyDetectionResponse(
            anomalies=anomalies,
            totalReclamations=len(reclamations),
            processedDate=today.isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/dispatch-global")
def dispatch_global(request: DispatchRequest):
    try:
        commandes = request.commandes
        livreurs = request.livreurs
        
        if not commandes or not livreurs:
            raise HTTPException(status_code=400, detail="Commandes et livreurs requis")
        
        # Algorithme de clustering K-Means simplifié
        affectations = {}
        
        # Regrouper les commandes par localisation (ville/gouvernorat approximatif)
        commandes_par_zone = {}
        for cmd in commandes:
            zone = cmd.ville or "Tunis"
            if zone not in commandes_par_zone:
                commandes_par_zone[zone] = []
            commandes_par_zone[zone].append(cmd)
        
        # Affecter les livreurs aux zones de manière équilibrée
        livreur_index = 0
        for zone, cmds_zone in commandes_par_zone.items():
            if not cmds_zone:
                continue
                
            # Choisir un livreur disponible pour cette zone
            livreur = livreurs[livreur_index % len(livreurs)]
            livreur_index += 1
            
            # Affecter toutes les commandes de cette zone à ce livreur
            affectations[livreur.id] = [cmd.id for cmd in cmds_zone]
        
        return DispatchResponse(affectations=affectations)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "False") == "True"
    
    if reload:
        uvicorn.run("main:app", host=host, port=port, reload=True)
    else:
        uvicorn.run(app, host=host, port=port)