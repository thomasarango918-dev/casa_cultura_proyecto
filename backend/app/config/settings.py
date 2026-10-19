"""
Configuración centralizada de la aplicación.

Los valores se leen de variables de entorno o del archivo `.env` ubicado en la
carpeta backend. Pydantic valida los tipos al arrancar: si falta un valor
obligatorio (como JWT_SECRET_KEY) la API no inicia y muestra el error exacto.

Uso en el resto del código:
    from app.config.settings import settings
    settings.DATABASE_URL
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de configuración de la API. Cada atributo corresponde a una variable del .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,  # Los nombres en el .env deben escribirse en mayúsculas.
        extra="ignore",  # Variables desconocidas en el .env se ignoran en lugar de fallar.
    )

    # ---- Aplicación ---------------------------------------------------------
    APP_NAME: str = "Casa de la Cultura San Pedro de los Milagros - API"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # ---- Base de datos ------------------------------------------------------
    # Formato: postgresql+psycopg2://usuario:contraseña@servidor:puerto/base_de_datos
    DATABASE_URL: str = "postgresql+psycopg2://casacultura:casacultura_dev@localhost:5432/casacultura"
    DB_ECHO: bool = False  # True imprime en consola cada consulta SQL (útil para depurar).
    DB_POOL_SIZE: int = 10  # Conexiones que el pool mantiene abiertas.
    DB_MAX_OVERFLOW: int = 20  # Conexiones adicionales permitidas en picos de carga.

    # ---- Seguridad / JWT ----------------------------------------------------
    # Clave con la que se firman los tokens. Es obligatoria y debe ser larga y aleatoria.
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: Literal["HS256", "HS384", "HS512"] = "HS256"
    JWT_EXPIRE_MINUTES: int = Field(default=480, gt=0)  # 480 minutos = 8 horas (una jornada).
    JWT_ISSUER: str = "casacultura-sanpedro"  # Emisor; se valida al leer cada token.

    # ---- CORS ---------------------------------------------------------------
    # Orígenes del frontend autorizados. En el archivo .env se escribe como lista JSON.
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # ---- Correo electrónico (Fase 4) ----------------------------------------
    # Todas son opcionales. El proveedor se elige solo:
    #   1. RESEND_API_KEY con valor  -> se envía con Resend.
    #   2. SMTP_HOST con valor       -> se envía por SMTP (Gmail, Outlook, servidor propio...).
    #   3. Ninguno de los dos        -> el correo solo se escribe en la consola (modo desarrollo).
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_SSL: bool = False  # True para el puerto 465; False usa STARTTLS (puerto 587).
    # Remitente que verá el destinatario. Con Resend debe ser de un dominio verificado.
    EMAIL_FROM: str = "Casa de la Cultura <onboarding@resend.dev>"
    # Correo del BackOffice que recibe el aviso de cada nueva solicitud.
    EMAIL_ADMIN: str = ""
    # Dirección del frontend; se usa para armar el enlace de recuperación de contraseña.
    FRONTEND_URL: str = "http://localhost:5173"
    # Vigencia del enlace de recuperación de contraseña.
    PASSWORD_RESET_EXPIRE_MINUTES: int = Field(default=15, gt=0)

    @field_validator("FRONTEND_URL")
    @classmethod
    def _normalize_frontend_url(cls, value: str) -> str:
        """Quita espacios y la barra final para no generar enlaces con "//"."""
        return value.strip().rstrip("/")

    @field_validator("CORS_ORIGINS")
    @classmethod
    def _normalize_origins(cls, value: list[str]) -> list[str]:
        """Quita espacios y la barra final de cada origen.

        El navegador envía el origen sin barra final ("http://localhost:5173"),
        así que "http://localhost:5173/" en el .env no coincidiría.
        """
        return [origin.strip().rstrip("/") for origin in value if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Indica si la API corre en producción (se usa para ocultar /docs)."""
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    """Crea la configuración una sola vez y reutiliza la misma instancia en adelante."""
    return Settings()


# Instancia global que importan los demás módulos.
settings = get_settings()
