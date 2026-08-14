"""
Modèles de données pour le service IA
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class StatutReclamation(str, Enum):
    """Statuts de réclamation"""
    EN_ATTENTE = "EN_ATTENTE"
    EN_COURS = "EN_COURS"
    RESOLUE = "RESOLUE"
    REJETEE = "REJETEE"


class PrioriteReclamation(str, Enum):
    """Priorités de réclamation"""
    URGENT = "URGENT"
    NORMAL = "NORMAL"
    FAIBLE = "FAIBLE"


class Sentiment(str, Enum):
    """Sentiment du texte"""
    POSITIF = "POSITIF"
    NEUTRE = "NEUTRE"
    NEGATIF = "NEGATIF"


class TypeReponse(str, Enum):
    """Types de réponses générées"""
    FORMELLE = "FORMELLE"
    EMPATHIQUE = "EMPATHIQUE"
    TECHNIQUE = "TECHNIQUE"


class TypeAnomalie(str, Enum):
    """Types d'anomalies détectées"""
    SPIKE_RECLAMATIONS = "SPIKE_RECLAMATIONS"
    CLIENT_IRRITE = "CLIENT_IRRITE"
    PROBLEME_RECURRENT = "PROBLEME_RECURRENT"
    LIVREUR_PROBLEMATIQUE = "LIVREUR_PROBLEMATIQUE"
    ZONE_PROBLEMATIQUE = "ZONE_PROBLEMATIQUE"


class NiveauAnomalie(str, Enum):
    """Niveaux de gravité des anomalies"""
    HAUT = "HAUT"
    MOYEN = "MOYEN"
    BAS = "BAS"


# =========== Request Models ===========

class ReclamationRequest(BaseModel):
    """Requête d'analyse de réclamation"""
    reclamation_id: str = Field(..., description="ID de la réclamation")
    description: str = Field(..., description="Description de la réclamation")
    type_reclamation: Optional[str] = Field(None, description="Type de réclamation")
    client_id: Optional[str] = Field(None, description="ID du client")
    commande_id: Optional[str] = Field(None, description="ID de la commande")
    date_creation: Optional[datetime] = Field(None, description="Date de création")


class ReponseReclamationRequest(BaseModel):
    """Requête de génération de réponse"""
    reclamation_id: str = Field(..., description="ID de la réclamation")
    type_reponse: TypeReponse = Field(..., description="Type de réponse souhaité")
    contexte: Optional[Dict[str, Any]] = Field(None, description="Contexte additionnel")


class AnomaliesRequest(BaseModel):
    """Requête de détection d'anomalies"""
    reclamations: List[Dict[str, Any]] = Field(..., description="Liste des réclamations")
    periode_jours: int = Field(7, description="Période d'analyse en jours")


# =========== Response Models ===========

class ReclamationAnalysis(BaseModel):
    """Résultat de l'analyse IA d'une réclamation"""
    reclamation_id: str
    priorite: PrioriteReclamation
    sentiment: Sentiment
    probleme_detecte: str
    suggestion_action: str
    temps_resolution_estime: int  # en heures
    confidence: float = Field(..., ge=0, le=1, description="Score de confiance 0-1")
    categorie: Optional[str] = None
    mots_cles: List[str] = []
    date_analyse: datetime = Field(default_factory=datetime.utcnow)


class ReponseGeneree(BaseModel):
    """Réponse générée par l'IA"""
    reclamation_id: str
    type_reponse: TypeReponse
    texte: str
    variables: Dict[str, str] = {}
    confidence: float = Field(..., ge=0, le=1)
    date_generation: datetime = Field(default_factory=datetime.utcnow)


class AnomalieDetectee(BaseModel):
    """Anomalie détectée par l'IA"""
    type: TypeAnomalie
    niveau: NiveauAnomalie
    description: str
    action_recommandee: str
    donnees: Dict[str, Any] = {}
    date_detection: datetime = Field(default_factory=datetime.utcnow)


class AnomaliesResponse(BaseModel):
    """Réponse avec liste d'anomalies"""
    anomalies: List[AnomalieDetectee]
    total_anomalies: int
    periode_analyse: str
    date_analysis: datetime = Field(default_factory=datetime.utcnow)


class HealthResponse(BaseModel):
    """Response de health check"""
    status: str
    service: str
    version: str
    ia_provider: str
    model_loaded: bool
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """Response d'erreur standardisée"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)