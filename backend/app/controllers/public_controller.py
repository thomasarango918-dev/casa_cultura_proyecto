"""
Capa Controlador (MVC): radicación pública de solicitudes (SIN autenticación).

Rutas (montadas en main.py bajo /api/v1):
    GET  /api/v1/public/programas         Programas que el aspirante puede elegir.
    GET  /api/v1/public/tipos-documento   Tipos de documento de identidad admitidos.
    GET  /api/v1/public/parentescos       Parentescos para el acudiente de un menor de edad.
    GET  /api/v1/public/requisitos        Documentos que el aspirante debe adjuntar.
    POST /api/v1/public/solicitudes       Radica una solicitud con sus documentos (multipart/form-data).
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.config.uploads import MAX_FILES_PER_REQUEST
from app.dependencies.solicitud_dependencies import get_solicitud_service
from app.schemas.auth_schema import MensajeError
from app.schemas.solicitud_schema import (
    ParentescoOut,
    ProgramaOut,
    RadicadoResponse,
    RequisitoOut,
    SolicitudCreate,
    TipoDocumentoOut,
)
from app.services.solicitud_service import SolicitudService
from app.utils.exceptions import DatosInvalidosError
from app.utils.file_storage import read_upload

router = APIRouter(prefix="/public", tags=["Radicación pública"])


@router.get("/programas", response_model=list[ProgramaOut], summary="Programas disponibles")
def list_programas(service: SolicitudService = Depends(get_solicitud_service)) -> list[ProgramaOut]:
    return service.list_programas()


@router.get("/tipos-documento", response_model=list[TipoDocumentoOut], summary="Tipos de documento")
def list_tipos_documento(service: SolicitudService = Depends(get_solicitud_service)) -> list[TipoDocumentoOut]:
    return service.list_tipos_documento()


@router.get("/parentescos", response_model=list[ParentescoOut], summary="Parentescos del acudiente")
def list_parentescos(service: SolicitudService = Depends(get_solicitud_service)) -> list[ParentescoOut]:
    return service.list_parentescos()


@router.get("/requisitos", response_model=list[RequisitoOut], summary="Documentos requeridos")
def list_requisitos(service: SolicitudService = Depends(get_solicitud_service)) -> list[RequisitoOut]:
    return service.list_requisitos()


def _validation_error(errores: list[tuple[str, str]]) -> RequestValidationError:
    """Arma un 422 con el mismo formato del manejador global (campo + mensaje)."""
    return RequestValidationError(
        [{"loc": (campo,), "msg": mensaje, "type": "value_error"} for campo, mensaje in errores]
    )


@router.post(
    "/solicitudes",
    response_model=RadicadoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Radicar solicitud de inscripción",
    description=(
        "Recibe en multipart/form-data los datos del aspirante (incluida la fecha de nacimiento y la "
        "edad; si es menor de 18 años, también los datos del acudiente) y un archivo por cada "
        "documento requerido (ver GET /public/requisitos). Los archivos van en el campo `archivos` y, "
        "en el mismo orden, el código de cada requisito en el campo `requisitos`. "
        "Formatos: PDF, JPG, PNG o WEBP de hasta 5 MB. Devuelve el número de radicado."
    ),
    responses={
        status.HTTP_400_BAD_REQUEST: {"model": MensajeError, "description": "Archivo o dato no válido"},
    },
)
def radicar_solicitud(
    nombres: Annotated[str, Form()],
    apellidos: Annotated[str, Form()],
    tipo_documento: Annotated[str, Form()],
    numero_documento: Annotated[str, Form()],
    correo_electronico: Annotated[str, Form()],
    programa_id: Annotated[str, Form()],
    fecha_nacimiento: Annotated[str, Form(description="AAAA-MM-DD")],
    edad: Annotated[str, Form()],
    telefono: Annotated[str | None, Form()] = None,
    acudiente_nombre: Annotated[str | None, Form()] = None,
    acudiente_documento: Annotated[str | None, Form()] = None,
    acudiente_telefono: Annotated[str | None, Form()] = None,
    acudiente_parentesco: Annotated[str | None, Form()] = None,
    archivos: Annotated[list[UploadFile] | None, File(description="Documentos soporte")] = None,
    requisitos: Annotated[
        list[str] | None, Form(description="Código del requisito de cada archivo, en el mismo orden")
    ] = None,
    service: SolicitudService = Depends(get_solicitud_service),
) -> RadicadoResponse:
    # 1. Validación de los datos personales con el esquema (mensajes en español).
    try:
        data = SolicitudCreate.model_validate(
            {
                "nombres": nombres,
                "apellidos": apellidos,
                "tipo_documento": tipo_documento,
                "numero_documento": numero_documento,
                "correo_electronico": correo_electronico,
                "telefono": telefono,
                "programa_id": programa_id,
                "fecha_nacimiento": fecha_nacimiento,
                "edad": edad,
                "acudiente_nombre": acudiente_nombre,
                "acudiente_documento": acudiente_documento,
                "acudiente_telefono": acudiente_telefono,
                "acudiente_parentesco": acudiente_parentesco,
            }
        )
    except ValidationError as exc:
        # Se reutiliza el formato 422 del manejador global (campo + mensaje).
        raise RequestValidationError(
            [
                {"loc": error["loc"], "msg": error["msg"].removeprefix("Value error, "), "type": error["type"]}
                for error in exc.errors(include_url=False)
            ]
        ) from exc

    # 2. Reglas entre campos: edad coherente con la fecha y acudiente completo si es menor.
    errores = data.errores_condicionales(date.today())
    if errores:
        raise _validation_error(errores)

    archivos = archivos or []
    requisitos = [codigo.strip().upper() for codigo in (requisitos or [])]
    try:
        if len(archivos) > MAX_FILES_PER_REQUEST:
            raise DatosInvalidosError(f"Puede adjuntar como máximo {MAX_FILES_PER_REQUEST} documentos.")
        if len(requisitos) != len(archivos):
            raise DatosInvalidosError("Cada archivo debe indicar a qué documento requerido corresponde.")
        # 3. Lectura y validación de cada archivo (extensión, tamaño y contenido real).
        documentos = [
            (codigo, read_upload(archivo.filename, archivo.file))
            for codigo, archivo in zip(requisitos, archivos, strict=True)
        ]
        # 4. Registro de la solicitud y de los documentos.
        return service.radicar(data, documentos)
    except DatosInvalidosError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
