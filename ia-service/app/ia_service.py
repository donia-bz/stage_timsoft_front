"""
Service IA principal pour BFExpress
Gère l'analyse de réclamations avec Azure OpenAI ou Hugging Face
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import re
import json
from loguru import logger

from app.models import (
    ReclamationAnalysis, ReponseGeneree, AnomalieDetectee,
    PrioriteReclamation, Sentiment, TypeReponse, TypeAnomalie, NiveauAnomalie
)
from app.config import settings


class IAService:
    """Service IA principal"""
    
    def __init__(self):
        self.provider = "azure" if settings.use_azure_openai else "huggingface"
        self.model_loaded = False
        
        # Initialiser le provider choisi
        if self.provider == "azure":
            self._init_azure_openai()
        else:
            self._init_huggingface()
        
        logger.info(f"IA Service initialisé avec provider: {self.provider}")
    
    def _init_azure_openai(self):
        """Initialiser Azure OpenAI"""
        try:
            from openai import AzureOpenAI
            
            self.azure_client = AzureOpenAI(
                api_key=settings.azure_openai_api_key,
                api_version=settings.azure_openai_api_version,
                azure_endpoint=settings.azure_openai_endpoint
            )
            self.model_loaded = True
            logger.info("Azure OpenAI initialisé avec succès")
        except Exception as e:
            logger.error(f"Erreur initialisation Azure OpenAI: {e}")
            self.model_loaded = False
    
    def _init_huggingface(self):
        """Initialiser Hugging Face (local)"""
        try:
            from transformers import pipeline
            import torch
            
            # Charger les modèles en mode lazy (au premier appel)
            self.sentiment_pipeline = None
            self.classifier = None
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            
            self.model_loaded = True
            logger.info(f"Hugging Face prêt (device: {self.device})")
        except Exception as e:
            logger.error(f"Erreur initialisation Hugging Face: {e}")
            self.model_loaded = False
    
    def _load_huggingface_models(self):
        """Charger les modèles Hugging Face au besoin (lazy loading)"""
        if self.provider != "huggingface" or self.sentiment_pipeline is not None:
            return
        
        try:
            from transformers import pipeline
            
            logger.info("Chargement des modèles Hugging Face...")
            
            # Modèle de sentiment
            self.sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model=settings.huggingface_sentiment_model,
                device=self.device
            )
            
            # Classifieur zero-shot
            self.classifier = pipeline(
                "zero-shot-classification",
                model=settings.huggingface_classifier,
                device=self.device
            )
            
            logger.info("Modèles Hugging Face chargés avec succès")
        except Exception as e:
            logger.error(f"Erreur chargement modèles: {e}")
    
    # =========== Analyse de Réclamation ===========
    
    async def analyser_reclamation(
        self,
        reclamation_id: str,
        description: str,
        type_reclamation: Optional[str] = None,
        client_id: Optional[str] = None,
        commande_id: Optional[str] = None,
        date_creation: Optional[datetime] = None
    ) -> ReclamationAnalysis:
        """
        Analyser une réclamation avec IA
        
        Args:
            reclamation_id: ID de la réclamation
            description: Description de la réclamation
            type_reclamation: Type de réclamation
            client_id: ID du client
            commande_id: ID de la commande
            date_creation: Date de création
        
        Returns:
            ReclamationAnalysis: Analyse complète
        """
        logger.info(f"Analyse réclamation {reclamation_id}")
        
        # Nettoyer le texte
        description_clean = self._clean_text(description)
        
        # Analyser selon le provider
        if self.provider == "azure":
            return await self._analyser_azure(reclamation_id, description_clean, type_reclamation, date_creation)
        else:
            return await self._analyser_huggingface(reclamation_id, description_clean, type_reclamation, date_creation)
    
    async def _analyser_azure(
        self,
        reclamation_id: str,
        description: str,
        type_reclamation: Optional[str],
        date_creation: Optional[datetime]
    ) -> ReclamationAnalysis:
        """Analyser avec Azure OpenAI"""
        try:
            response = self.azure_client.chat.completions.create(
                model=settings.azure_openai_deployment_name,
                messages=[
                    {
                        "role": "system",
                        "content": """Tu es un expert en analyse de réclamations pour un service de livraison.
Analyse la réclamation et fournis:
1. priorité (URGENT, NORMAL, FAIBLE)
2. sentiment (POSITIF, NEUTRE, NEGATIF)
3. problème_detecté (court descriptif)
4. suggestion_action (action concrète)
5. temps_resolution_estime (en heures)
6. confidence (0-1)
7. categorie (type de problème)
8. mots_cles (liste de 3-5 mots clés)

Réponds en JSON uniquement."""
                    },
                    {
                        "role": "user",
                        "content": f"""Type: {type_reclamation or 'Non spécifié'}
Description: {description}

Analyse cette réclamation."""
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            result = json.loads(response.choices[0].message.content)
            
            return ReclamationAnalysis(
                reclamation_id=reclamation_id,
                priorite=PrioriteReclamation(result.get("priorite", "NORMAL")),
                sentiment=Sentiment(result.get("sentiment", "NEUTRE")),
                probleme_detecte=result.get("probleme_detecte", "Problème standard"),
                suggestion_action=result.get("suggestion_action", "Réponse standard"),
                temps_resolution_estime=result.get("temps_resolution_estime", 24),
                confidence=result.get("confidence", 0.8),
                categorie=result.get("categorie"),
                mots_cles=result.get("mots_cles", [])
            )
            
        except Exception as e:
            logger.error(f"Erreur analyse Azure: {e}")
            # Fallback vers analyse rule-based
            return self._analyser_rule_based(reclamation_id, description, type_reclamation, date_creation)
    
    async def _analyser_huggingface(
        self,
        reclamation_id: str,
        description: str,
        type_reclamation: Optional[str],
        date_creation: Optional[datetime]
    ) -> ReclamationAnalysis:
        """Analyser avec Hugging Face"""
        try:
            self._load_huggingface_models()
            
            # Analyse de sentiment
            sentiment_result = self.sentiment_pipeline(description)[0]
            sentiment = "POSITIF" if sentiment_result["label"] == "POSITIVE" else "NEGATIF"
            
            # Classification par priorité
            priorite_labels = ["URGENT", "NORMAL", "FAIBLE"]
            priorite_result = self.classifier(description, priorite_labels)
            priorite = priorite_result["labels"][0]
            confidence = priorite_result["scores"][0]
            
            # Extraction de problème et action (rule-based)
            probleme, action, temps = self._extract_problem_action(description, type_reclamation)
            
            # Extraction mots-clés
            mots_cles = self._extract_keywords(description)
            
            return ReclamationAnalysis(
                reclamation_id=reclamation_id,
                priorite=PrioriteReclamation(priorite),
                sentiment=Sentiment(sentiment),
                probleme_detecte=probleme,
                suggestion_action=action,
                temps_resolution_estime=temps,
                confidence=confidence,
                mots_cles=mots_cles
            )
            
        except Exception as e:
            logger.error(f"Erreur analyse Hugging Face: {e}")
            return self._analyser_rule_based(reclamation_id, description, type_reclamation, date_creation)
    
    def _analyser_rule_based(
        self,
        reclamation_id: str,
        description: str,
        type_reclamation: Optional[str],
        date_creation: Optional[datetime]
    ) -> ReclamationAnalysis:
        """Analyse rule-based (fallback)"""
        logger.info("Utilisation analyse rule-based")
        
        # Déterminer la priorité
        priorite = self._determine_priorite_rule_based(description, type_reclamation, date_creation)
        
        # Analyser le sentiment
        sentiment = self._analyze_sentiment_rule_based(description)
        
        # Extraire problème et action
        probleme, action, temps = self._extract_problem_action(description, type_reclamation)
        
        # Extraire mots-clés
        mots_cles = self._extract_keywords(description)
        
        return ReclamationAnalysis(
            reclamation_id=reclamation_id,
            priorite=priorite,
            sentiment=sentiment,
            probleme_detecte=probleme,
            suggestion_action=action,
            temps_resolution_estime=temps,
            confidence=0.6,  # Confidence plus basse pour rule-based
            mots_cles=mots_cles
        )
    
    # =========== Génération de Réponse ===========
    
    async def generer_reponse(
        self,
        reclamation_id: str,
        type_reponse: TypeReponse,
        contexte: Optional[Dict[str, Any]] = None
    ) -> ReponseGeneree:
        """
        Générer une réponse personnalisée
        
        Args:
            reclamation_id: ID de la réclamation
            type_reponse: Type de réponse souhaité
            contexte: Contexte additionnel (nom client, etc.)
        
        Returns:
            ReponseGeneree: Réponse générée
        """
        logger.info(f"Génération réponse {type_reponse.value} pour réclamation {reclamation_id}")
        
        contexte = contexte or {}
        
        if self.provider == "azure":
            return await self._generer_reponse_azure(reclamation_id, type_reponse, contexte)
        else:
            return await self._generer_reponse_template(reclamation_id, type_reponse, contexte)
    
    async def _generer_reponse_azure(
        self,
        reclamation_id: str,
        type_reponse: TypeReponse,
        contexte: Dict[str, Any]
    ) -> ReponseGeneree:
        """Générer avec Azure OpenAI"""
        try:
            system_prompt = self._get_system_prompt(type_reponse)
            
            response = self.azure_client.chat.completions.create(
                model=settings.azure_openai_deployment_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"""Génère une réponse de type {type_reponse.value}
Contexte: {json.dumps(contexte, ensure_ascii=False)}"""
                    }
                ],
                temperature=0.7
            )
            
            texte = response.choices[0].message.content
            
            return ReponseGeneree(
                reclamation_id=reclamation_id,
                type_reponse=type_reponse,
                texte=texte,
                variables=contexte,
                confidence=0.85
            )
            
        except Exception as e:
            logger.error(f"Erreur génération Azure: {e}")
            return self._generer_reponse_template(reclamation_id, type_reponse, contexte)
    
    async def _generer_reponse_template(
        self,
        reclamation_id: str,
        type_reponse: TypeReponse,
        contexte: Dict[str, Any]
    ) -> ReponseGeneree:
        """Générer avec templates"""
        template = self._get_template(type_reponse)
        
        # Remplacer les variables
        texte = template
        for key, value in contexte.items():
            texte = texte.replace(f"{{{key}}}", str(value))
        
        return ReponseGeneree(
            reclamation_id=reclamation_id,
            type_reponse=type_reponse,
            texte=texte,
            variables=contexte,
            confidence=0.75
        )
    
    # =========== Détection d'Anomalies ===========
    
    async def detecter_anomalies(
        self,
        reclamations: List[Dict[str, Any]],
        periode_jours: int = 7
    ) -> List[AnomalieDetectee]:
        """
        Détecter les anomalies dans les réclamations
        
        Args:
            reclamations: Liste des réclamations
            periode_jours: Période d'analyse
        
        Returns:
            List[AnomalieDetectee]: Anomalies détectées
        """
        logger.info(f"Détection anomalies sur {len(reclamations)} réclamations")
        
        anomalies = []
        maintenant = datetime.utcnow()
        date_limite = maintenant - timedelta(days=periode_jours)
        
        # Filtrer réclamations récentes
        reclamations_recentes = [
            r for r in reclamations
            if datetime.fromisoformat(r.get('dateCreation', '').replace('Z', '+00:00')) > date_limite
        ] if reclamations else []
        
        # Détection pic de réclamations
        if len(reclamations_recentes) > 5:
            anomalies.append(AnomalieDetectee(
                type=TypeAnomalie.SPIKE_RECLAMATIONS,
                niveau=NiveauAnomalie.HAUT,
                description=f"Pic de réclamations: {len(reclamations_recentes)} sur {periode_jours} jours",
                action_recommandee="Investiguer la cause du pic",
                donnees={"count": len(reclamations_recentes), "periode": periode_jours}
            ))
        
        # Détection clients irrités
        clients_counts = self._count_by_field(reclamations_recentes, 'clientId')
        clients_irrites = [(client_id, count) for client_id, count in clients_counts.items() if count > 2]
        
        if clients_irrites:
            anomalies.append(AnomalieDetectee(
                type=TypeAnomalie.CLIENT_IRRITE,
                niveau=NiveauAnomalie.MOYEN,
                description=f"{len(clients_irrites)} clients avec >2 réclamations",
                action_recommandee="Contacter les clients prioritairement",
                donnees={"clients": clients_irrites}
            ))
        
        # Détection problèmes récurrents
        types_counts = self._count_by_field(reclamations_recentes, 'type')
        problemes_recurrents = [(type_, count) for type_, count in types_counts.items() if count > 3]
        
        if problemes_recurrents:
            top_probleme = problemes_recurrents[0]
            anomalies.append(AnomalieDetectee(
                type=TypeAnomalie.PROBLEME_RECURRENT,
                niveau=NiveauAnomalie.MOYEN,
                description=f"Problème récurrent: {top_probleme[0]} ({top_probleme[1]}x)",
                action_recommandee="Analyser et résoudre le problème système",
                donnees={"problemes": problemes_recurrents}
            ))
        
        logger.info(f"{len(anomalies)} anomalies détectées")
        return anomalies
    
    # =========== Méthodes utilitaires ===========
    
    def _clean_text(self, text: str) -> str:
        """Nettoyer le texte"""
        text = text.strip()
        text = re.sub(r'\s+', ' ', text)
        return text
    
    def _determine_priorite_rule_based(
        self,
        description: str,
        type_reclamation: Optional[str],
        date_creation: Optional[datetime]
    ) -> PrioriteReclamation:
        """Déterminer priorité avec règles"""
        desc_lower = description.lower()
        type_lower = (type_reclamation or "").lower()
        
        # Critères d'urgence
        urgent_keywords = ['perdu', 'endommagé', 'cassé', 'paiement', 'argent', 'vol']
        if any(kw in desc_lower or kw in type_lower for kw in urgent_keywords):
            return PrioriteReclamation.URGENT
        
        # Vérifier l'ancienneté
        if date_creation:
            jours_attente = (datetime.utcnow() - date_creation).days
            if jours_attente > 3:
                return PrioriteReclamation.URGENT
            elif jours_attente > 1:
                return PrioriteReclamation.NORMAL
        
        return PrioriteReclamation.FAIBLE
    
    def _analyze_sentiment_rule_based(self, description: str) -> Sentiment:
        """Analyser sentiment avec règles"""
        desc_lower = description.lower()
        
        negative_words = ['furieux', 'énervé', 'colère', 'inacceptable', 'mécontent', 'décu']
        positive_words = ['merci', 'satisfait', 'content', 'excellent', 'parfait']
        
        if any(word in desc_lower for word in negative_words):
            return Sentiment.NEGATIF
        elif any(word in desc_lower for word in positive_words):
            return Sentiment.POSITIF
        
        return Sentiment.NEUTRE
    
    def _extract_problem_action(
        self,
        description: str,
        type_reclamation: Optional[str]
    ) -> tuple[str, str, int]:
        """Extraire problème, action et temps estimé"""
        desc_lower = description.lower()
        type_lower = (type_reclamation or "").lower()
        
        # Mapping problème -> action -> temps
        mappings = {
            'retard': ('Retard de livraison', 'Vérifier statut et proposer compensation', 8),
            'perdu': ('Colis perdu', 'Lancer enquête et proposer remboursement', 48),
            'endommagé': ('Colis endommagé', 'Demander photos et proposer remplacement', 24),
            'paiement': ('Problème paiement', 'Vérifier bordereau et régulariser', 12),
            'absent': ('Destinataire absent', 'Reprogrammer livraison', 4),
            'adresse': ('Adresse erronée', 'Confirmer adresse avec client', 6),
        }
        
        for keyword, (probleme, action, temps) in mappings.items():
            if keyword in desc_lower or keyword in type_lower:
                return probleme, action, temps
        
        return ('Problème standard', 'Réponse standard', 24)
    
    def _extract_keywords(self, description: str) -> List[str]:
        """Extraire mots-clés du texte"""
        # Mots simples à ignorer
        stop_words = {'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'de', 'du', 'au', 'aux'}
        
        words = re.findall(r'\b\w+\b', description.lower())
        keywords = [w for w in words if len(w) > 3 and w not in stop_words]
        
        # Retourner les 5 plus fréquents
        from collections import Counter
        counter = Counter(keywords)
        return [word for word, _ in counter.most_common(5)]
    
    def _count_by_field(self, items: List[Dict], field: str) -> Dict[str, int]:
        """Compter les occurrences d'un champ"""
        counts = {}
        for item in items:
            value = item.get(field, 'unknown')
            counts[value] = counts.get(value, 0) + 1
        return counts
    
    def _get_system_prompt(self, type_reponse: TypeReponse) -> str:
        """Obtenir le prompt système selon le type de réponse"""
        prompts = {
            TypeReponse.FORMELLE: """Tu es un service client professionnel.
Génère une réponse formelle, polie et structurée.
Utilise un ton professionnel et direct.""",
            
            TypeReponse.EMPATHIQUE: """Tu es un service client humain et empathique.
Génère une réponse chaleureuse, compréhensive et personnalisée.
Montre de l'empathie et de la compréhension.""",
            
            TypeReponse.TECHNIQUE: """Tu es un support technique.
Génère une réponse factuelle, précise et orientée solution.
Inclus les détails techniques et les étapes de résolution."""
        }
        return prompts.get(type_reponse, "")
    
    def _get_template(self, type_reponse: TypeReponse) -> str:
        """Obtenir le template selon le type"""
        templates = {
            TypeReponse.FORMELLE: """Madame, Monsieur {client_name},

Nous accusons réception de votre réclamation concernant {probleme} (Réf: {ref_commande}).

Votre dossier a été enregistré sous la référence {ref_reclamation} et est actuellement en cours de traitement par notre service client.

Nous vous informerons de l'avancement de votre dossier dans les plus brefs délais.

Cordialement,
Le service client BFExpress""",
            
            TypeReponse.EMPATHIQUE: """Cher/Chère {client_name},

Nous sommes vraiment désolés d'apprendre votre mécontentement concernant votre commande {ref_commande}. Nous comprenons parfaitement votre situation et nous allons faire notre possible pour la résoudre rapidement.

Notre équipe s'occupe personnellement de votre dossier (Réf: {ref_reclamation}) et vous recontactera dans les plus brefs délais.

Merci de votre patience et de votre compréhension.

Bien cordialement,
L'équipe BFExpress""",
            
            TypeReponse.TECHNIQUE: """Suivi technique - Réclamation {ref_reclamation}

Commande concernée: {ref_commande}
Statut actuel: {statut}
Problème identifié: {probleme}

Actions en cours:
- Vérification du statut de la commande
- Analyse du parcours de livraison
- Contact avec le livreur si nécessaire

Délai estimé de résolution: {temps_estime}h

Vous serez notifié automatiquement de la résolution."""
        }
        return templates.get(type_reponse, "")


# Instance globale du service
ia_service = IAService()