import json
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Rostra API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./rostra.db"

    # JWT Authentication (Loaded via Environment Variable JWT_SECRET_KEY)
    JWT_SECRET_KEY: str = "dev-insecure-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    RESET_TOKEN_EXPIRE_MINUTES: int = 60

    # First platform owner, created at startup if no SUPER_ADMIN exists (production bootstrap)
    SUPER_ADMIN_EMAIL: str = ""
    SUPER_ADMIN_PASSWORD: str = ""

    RATE_LIMIT_ENABLED: bool = True

    # Interactive API docs (/docs). Always on outside production; in production only when this is true.
    API_DOCS_ENABLED: bool = False

    # Server & Port
    PORT: int = 8000

    # Outgoing email over SMTP (Brevo relay by default). Without credentials, emails are logged, not sent.
    SMTP_HOST: str = "smtp-relay.brevo.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""  # must be a sender verified in your SMTP provider
    EMAIL_FROM_NAME: str = "Rostra"
    INQUIRY_NOTIFY_TO: str = ""  # who is told when someone requests a workspace
    APP_BASE_URL: str = "http://localhost:3000"

    # CORS (Strict environment-driven origins)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def reject_insecure_production(self) -> "Settings":
        if self.is_production and (
            self.JWT_SECRET_KEY.startswith("dev-insecure") or len(self.JWT_SECRET_KEY) < 32
        ):
            raise ValueError("JWT_SECRET_KEY must be set to a random value of 32+ characters in production")
        if self.is_production and "*" in (self.CORS_ORIGINS if isinstance(self.CORS_ORIGINS, list) else [self.CORS_ORIGINS]):
            raise ValueError("CORS_ORIGINS must not contain '*' in production")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
