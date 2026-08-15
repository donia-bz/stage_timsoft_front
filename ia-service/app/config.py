from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "BFExpress IA Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:4200,http://localhost:4201"

    class Config:
        env_file = ".env"

settings = Settings()