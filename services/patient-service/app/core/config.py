from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    service_name: str = "patient-service"
    database_url: str = "postgresql+asyncpg://healthsync:dev_password@localhost:5432/healthsync"
    db_schema: str = "patient"
    redis_url: str = "redis://localhost:6379"
    jwt_private_key_path: str = "/secrets/jwt_private.pem"
    jwt_public_key_path: str = "/secrets/jwt_public.pem"
    jwt_algorithm: str = "RS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_hours: int = 8
    cache_ttl_seconds: int = 300
    cache_ttl_allergies_seconds: int = 3600
    cache_ttl_admissions_seconds: int = 600
    cors_origins: str = "*"

    class Config:
        env_file = ".env"

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg_driver(cls, v: str) -> str:
        # Managed Postgres hosts (Render, Heroku, etc.) hand out plain
        # postgresql:// URLs; SQLAlchemy's async engine needs the +asyncpg
        # driver in the scheme or it falls back to the sync psycopg2 driver.
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()
