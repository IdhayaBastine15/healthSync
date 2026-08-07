from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_name: str = "audit-service"
    database_url: str = "postgresql+asyncpg://healthsync:dev_password@localhost:5432/healthsync"
    db_schema: str = "audit"
    redis_url: str = "redis://localhost:6379"
    jwt_public_key_path: str = "/secrets/jwt_public.pem"
    jwt_algorithm: str = "RS256"
    cors_origins: str = "*"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
