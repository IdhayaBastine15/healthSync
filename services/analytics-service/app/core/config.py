from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    service_name: str = "analytics-service"
    database_url: str = "postgresql+asyncpg://healthsync:dev_password@localhost:5432/healthsync"
    db_schema: str = "analytics"
    redis_url: str = "redis://localhost:6379"
    jwt_public_key_path: str = "/secrets/jwt_public.pem"
    jwt_algorithm: str = "RS256"
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
