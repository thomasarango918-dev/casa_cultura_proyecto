"""
Punto de entrada de la API de la Casa de la Cultura de San Pedro de los Milagros.

Responsabilidades de este archivo:
    1. Configurar el registro de eventos (logging) de la aplicación.
    2. Crear la instancia de FastAPI con sus metadatos y su ciclo de vida.
    3. Registrar los middlewares (CORS) y los manejadores globales de errores.
    4. Montar los controladores bajo el prefijo de versión /api/v1.
    5. Exponer el endpoint /health para monitorear el servicio.

Ejecución en desarrollo (desde la carpeta backend):
    python -m uvicorn main:app --reload --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.database import check_database_connection, engine
from app.config.settings import settings
from app.controllers import (
    auth_controller,
    dashboard_controller,
    documento_controller,
    public_controller,
    solicitud_controller,
)
from app.utils.error_handlers import register_exception_handlers

# --------------------------------------------------------------------------- #
# Registro de eventos
# --------------------------------------------------------------------------- #
# Formato: fecha | nivel | módulo | mensaje. Facilita leer la consola del servidor.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger("casacultura")


# --------------------------------------------------------------------------- #
# Ciclo de vida de la aplicación
# --------------------------------------------------------------------------- #
@asynccontextmanager
async def lifespan(_: FastAPI):
    """Ejecuta tareas al iniciar y al detener el servidor.

    Al iniciar comprueba que PostgreSQL responda (solo informa, no detiene la API).
    Al detener libera todas las conexiones abiertas del pool.
    """
    if check_database_connection():
        logger.info("Conexión con PostgreSQL establecida.")
    else:
        logger.warning("No fue posible conectar con PostgreSQL. Revise DATABASE_URL en el archivo .env.")
    yield  # A partir de aquí la API atiende peticiones hasta que se detiene.
    engine.dispose()
    logger.info("Conexiones a la base de datos cerradas.")


# --------------------------------------------------------------------------- #
# Instancia de FastAPI
# --------------------------------------------------------------------------- #
# La documentación interactiva (/docs y /redoc) se desactiva en producción
# para no exponer públicamente la estructura de la API.
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "API REST para la gestión académica y la radicación pública de solicitudes de "
        "inscripción de la Casa de la Cultura de San Pedro de los Milagros."
    ),
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

# CORS: autoriza al frontend (que corre en otro origen, p. ej. localhost:5173)
# a consumir la API desde el navegador. Los orígenes permitidos se leen del .env.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Traduce las excepciones no controladas a respuestas JSON con el campo `detail`.
register_exception_handlers(app)

# --------------------------------------------------------------------------- #
# Rutas
# --------------------------------------------------------------------------- #
# Todos los controladores se agrupan bajo /api/v1. Para agregar un módulo nuevo
# (por ejemplo, solicitudes) basta con incluir aquí su router.
api_v1 = APIRouter(prefix=settings.API_V1_PREFIX)
api_v1.include_router(auth_controller.router)
api_v1.include_router(public_controller.router)  # Fase 2: sin token.
api_v1.include_router(solicitud_controller.router)  # Fase 2: BackOffice con token.
api_v1.include_router(dashboard_controller.router)
api_v1.include_router(documento_controller.router)  # Inventario de documentos.
app.include_router(api_v1)


@app.get("/health", tags=["Sistema"], summary="Estado del servicio")
def health() -> JSONResponse:
    """Informa si la API está en línea y si tiene conexión con la base de datos.

    Responde 200 cuando todo funciona y 503 cuando PostgreSQL no está disponible,
    lo que permite usarlo en monitoreo o en verificaciones de despliegue.
    """
    database_ok = check_database_connection()
    return JSONResponse(
        status_code=status.HTTP_200_OK if database_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "ok" if database_ok else "degradado",
            "database": "conectada" if database_ok else "sin conexión",
            "version": settings.APP_VERSION,
        },
    )
