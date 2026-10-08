"""
Manejadores globales de errores.

Garantizan que cualquier error llegue al frontend como JSON con el campo
`detail` en español, en lugar de una página de error o un mensaje técnico.
También evitan exponer detalles internos (consultas SQL, rutas de archivos):
esos detalles quedan solo en el registro del servidor.

Correspondencia de errores:
    Datos inválidos en la petición  -> 422
    Base de datos no disponible     -> 503
    Otro error de base de datos     -> 500
    Cualquier otro error            -> 500
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

logger = logging.getLogger("casacultura.errors")


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Responde 422 con la lista de campos que no pasaron la validación de Pydantic."""
    errors = [
        {
            # "loc" llega como ("body", "identificador"); se omite "body" para dejar solo el campo.
            "campo": ".".join(str(part) for part in error.get("loc", ()) if part != "body"),
            "mensaje": error.get("msg", "Valor no válido."),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": "Revise los datos enviados.", "errores": errors}),
    )


async def _database_unavailable_handler(_: Request, exc: OperationalError) -> JSONResponse:
    """Responde 503 cuando no hay conexión con PostgreSQL (servidor apagado, credenciales, red)."""
    logger.error("Base de datos no disponible: %s", exc.orig)
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "El servicio de base de datos no está disponible. Intente más tarde."},
    )


async def _database_error_handler(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Responde 500 ante cualquier otro error de SQLAlchemy y lo registra con su traza."""
    logger.exception("Error de base de datos", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "No fue posible completar la operación en la base de datos."},
    )


async def _unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    """Última red de seguridad: cualquier excepción no prevista se registra y responde 500."""
    logger.exception("Error no controlado", exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Ocurrió un error inesperado en el servidor."},
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Registra todos los manejadores en la aplicación. Se llama una vez desde main.py.

    FastAPI elige el manejador de la clase más específica, por eso OperationalError
    (subclase de SQLAlchemyError) recibe el suyo propio.
    """
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(OperationalError, _database_unavailable_handler)
    app.add_exception_handler(SQLAlchemyError, _database_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
