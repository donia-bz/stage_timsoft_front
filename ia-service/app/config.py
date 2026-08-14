"""
Configuration du microservice IA BFExpress
Supporte Azure OpenAI et Hugging Face (local)
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Configuration principale"""
    
    # Application
    app_name: str = "BFExpress IA Service"
    app_version: str = "1.0.0"
    debug: bool = True
    log_level: str = "INFO"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = True
    
    # CORS
    allowed_origins: str = "http://localhost:4200,http://localhost:4201"
    
    # Azure OpenAI
    azure_openai_api_key: Optional[str] = None
    azure_openai_endpoint: Optional[str] = None
    azure_openai_api_version: str = "2023-12-01-preview"
    azure_openai_deployment_name: str = "gpt-4"
    azure_openai_embedding_deployment: str = "text-embedding-ada-002"
    
    # Hugging Face (Local)
    huggingface_model: str = "camembert-base"
    huggingface_sentiment_model: str = "camembert-base-sentiment"
    huggingface_classifier: str = "facebook/bart-large-mnli"
    use_local_model: bool = True
    
    # Database
    database_url: str = "sqlite:///./ia_service.db"
    
    # Cache
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl: int = 3600
    
    # Rate Limiting
    rate_limit_per_minute: int = 30
    rate_limit_per_hour: int = 500
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """Convertir la string des origines en liste"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]
    
    @property
    def use_azure_openai(self) -> bool:
        """Déterminer si Azure OpenAI est configuré"""
        return bool(self.azure_openai_api_key and self.azure_openai_endpoint)


settings = Settings()