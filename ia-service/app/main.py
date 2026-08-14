"""
Application FastAPI principale pour le service IA BFExpress
Endpoints pour l'analyse de réclamations
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from loguru import logger
import sys
from datetime import datetime
from typing import List

from app.config import settings
from app.models import (
    ReclamationRequest, ReclamationAnalysis,
    ReponseReclamationRequest, ReponseGeneree,
    AnomaliesRequest, AnomaliesResponse,
    HealthResponse, ErrorResponse
)
from app.ia_service import ia_service


# Configuration logger
logger.remove()
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level=settings.log_level
)
logger.add(
    "logs/ia_service_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="30 days",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle management"""
    logger.info(f"🚀 Démarrage de {settings.app_name} v{settings.app_version}")
    logger.info(f"🤖 Provider IA: {ia_service.provider}")
    logger.info(f"📊 Modèle chargé: {ia_service.model_loaded}")
    
    yield
    
    logger.info("🛑 Arrêt du service IA")


# Créer l'application FastAPI
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Microservice IA pour BFExpress - Analyse de réclamations",
    lifespan=lifespan
)

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========== Exception Handlers ===========

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handler pour exceptions HTTP"""
    logger.error(f"HTTP Error: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error="HTTP_ERROR",
            message=exc.detail,
            timestamp=datetime.utcnow()
        ).dict()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handler pour exceptions générales"""
    logger.error(f"Unexpected error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="INTERNAL_ERROR",
            message="Une erreur interne est survenue",
            details={"error": str(exc)},
            timestamp=datetime.utcnow()
        ).dict()
    )


# =========== Health Check ===========

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Vérifier l'état du service
    
    Returns:
        HealthResponse: État du service
    """
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        version=settings.app_version,
        ia_provider=ia_service.provider,
        model_loaded=ia_service.model_loaded
    )


@app.get("/", tags=["Root"])
async def root():
    """Endpoint racine"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "endpoints": {
            "health": "/health",
            "analyser": "/api/ia/analyser-reclamation",
            "reponse": "/api/ia/generer-reponse",
            "anomalies": "/api/ia/anomalies-reclamations"
        }
    }


# =========== Endpoints IA Réclamations ===========

@app.post(
    "/api/ia/analyser-reclamation",
    response_model=ReclamationAnalysis,
    tags=["Réclamations"],
    summary="Analyser une réclamation avec IA",
    description="Analyse une réclamation pour déterminer la priorité, le sentiment, le problème et suggérer une action"
)
async def analyser_reclamation(request: ReclamationRequest):
    """
    Analyser une réclamation avec IA
    
    - **reclamation_id**: ID unique de la réclamation
    - **description**: Description détaillée de la réclamation
    - **type_reclamation**: Type de réclamation (optionnel)
    - **client_id**: ID du client (optionnel)
    - **commande_id**: ID de la commande (optionnel)
    - **date_creation**: Date de création (optionnel)
    
    Returns une analyse complète avec:
    - Priorité (URGENT, NORMAL, FAIBLE)
    - Sentiment (POSITIF, NEUTRE, NEGATIF)
    - Problème détecté
    - Action suggérée
    - Temps de résolution estimé
    - Score de confiance
    """
    try:
        logger.info(f"Analyse réclamation {request.reclamation_id}")
        
        analysis = await ia_service.analyser_reclamation(
            reclamation_id=request.reclamation_id,
            description=request.description,
            type_reclamation=request.type_reclamation,
            client_id=request.client_id,
            commande_id=request.commande_id,
            date_creation=request.date_creation
        )
        
        logger.info(f"Analyse terminée pour {request.reclamation_id}")
        return analysis
        
    except Exception as e:
        logger.error(f"Erreur analyse réclamation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'analyse: {str(e)}"
        )


@app.post(
    "/api/ia/generer-reponse",
    response_model=ReponseGeneree,
    tags=["Réclamations"],
    summary="Générer une réponse personnalisée",
    description="Génère une réponse personnalisée pour une réclamation (formelle, empathique ou technique)"
)
async def generer_reponse(request: ReponseReclamationRequest):
    """
    Générer une réponse personnalisée
    
    - **reclamation_id**: ID de la réclamation
    - **type_reponse**: Type de réponse (FORMELLE, EMPATHIQUE, TECHNIQUE)
    - **contexte**: Contexte additionnel (nom client, réf commande, etc.)
    
    Returns une réponse générée avec:
    - Texte de la réponse
    - Variables utilisées
    - Score de confiance
    """
    try:
        logger.info(f"Génération réponse {request.type_reponse.value} pour {request.reclamation_id}")
        
        response = await ia_service.generer_reponse(
            reclamation_id=request.reclamation_id,
            type_reponse=request.type_reponse,
            contexte=request.contexte
        )
        
        logger.info(f"Réponse générée pour {request.reclamation_id}")
        return response
        
    except Exception as e:
        logger.error(f"Erreur génération réponse: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération: {str(e)}"
        )


@app.post(
    "/api/ia/anomalies-reclamations",
    response_model=AnomaliesResponse,
    tags=["Réclamations"],
    summary="Détecter des anomalies dans les réclamations",
    description="Analyse un ensemble de réclamations pour détecter des anomalies (pics, clients irrités, problèmes récurrents)"
)
async def detecter_anomalies(request: AnomaliesRequest):
    """
    Détecter des anomalies dans les réclamations
    
    - **reclamations**: Liste des réclamations à analyser
    - **periode_jours**: Période d'analyse en jours (défaut: 7)
    
    Returns les anomalies détectées:
    - Pics de réclamations
    - Clients irrités
    - Problèmes récurrents
    """
    try:
        logger.info(f"Détection anomalies sur {len(request.reclamations)} réclamations")
        
        anomalies = await ia_service.detecter_anomalies(
            reclamations=request.reclamations,
            periode_jours=request.periode_jours
        )
        
        logger.info(f"{len(anomalies)} anomalies détectées")
        
        return AnomaliesResponse(
            anomalies=anomalies,
            total_anomalies=len(anomalies),
            periode_analyse=f"{request.periode_jours} jours"
        )
        
    except Exception as e:
        logger.error(f"Erreur détection anomalies: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la détection: {str(e)}"
        )


# =========== Endpoints Batch (Optionnel) ===========

@app.post(
    "/api/ia/analyser-batch",
    tags=["Réclamations"],
    summary="Analyser plusieurs réclamations en batch",
    description="Analyse plusieurs réclamations en une seule requête (traitement parallèle)"
)
async def analyser_batch(requests: List[ReclamationRequest]):
    """
    Analyser plusieurs réclamations en batch
    
    - **requests**: Liste de requêtes d'analyse
    
    Returns la liste des analyses
    """
    try:
        logger.info(f"Analyse batch de {len(requests)} réclamations")
        
        # Traitement parallèle
        import asyncio
        analyses = await asyncio.gather(*[
            ia_service.analyser_reclamation(
                reclamation_id=req.reclamation_id,
                description=req.description,
                type_reclamation=req.type_reclamation,
                client_id=req.client_id,
                commande_id=req.commande_id,
                date_creation=req.date_creation
            )
            for req in requests
        ])
        
        logger.info(f"Batch terminé: {len(analyses)} analyses")
        return analyses
        
    except Exception as e:
        logger.error(f"Erreur analyse batch: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'analyse batch: {str(e)}"
        )


# =========== Documentation ===========

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """Custom Swagger UI"""
    from fastapi.openapi.utils import get_openapi
    from fastapi.responses import HTMLResponse
    
    openapi_schema = get_openapi(
        title=settings.app_name,
        version=settings.app_version,
        description="Microservice IA pour BFExpress",
        routes=app.routes,
    )
    
    # Personnaliser la documentation
    openapi_schema["info"]["x-logo"] = {
        "url": "https://via.placeholder.com/100x100?text=BFExpress"
    }
    
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html>
    <head>
        <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css">
        <title>{settings.app_name} - API Documentation</title>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
        <script>
            SwaggerUIBundle({{
                spec: {openapi_schema},
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.query,
                    SwaggerUIBundle.presets.standalone
                ]
            }})
        </script>
    </body>
    </html>
    """)


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"🚀 Lancement de {settings.app_name} sur {settings.host}:{settings.port}")
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level.lower()
    )