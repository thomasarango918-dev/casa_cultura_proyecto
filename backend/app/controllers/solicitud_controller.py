"""
Capa Controlador (MVC): gestión de solicitudes en el BackOffice (CON token JWT).

Rutas (montadas en main.py bajo /api/v1). Requieren rol Administrador o Coordinador:
    GET  /api/v1/admin/solicitudes                                   Listado con filtros.
    GET  /api/v1/admin/solicitudes/{id}                              Detalle con documentos.
    POST /api/v1/admin/solicitudes/{id}/evaluar                      Aprobar o rechazar.
    GET  /api/v1/admin/solicitudes/{id}/documentos/{doc_id}/archivo  Archivo para previsualizar.
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from fastapi.responses import FileResponse

from app.dependencies.solicitud_dependencies import get_solicitud_service, require_backoffice
from app.models.user_model import Usuario
from app.schemas.auth_schema import MensajeError
from app.schemas.solicitud_schema import EvaluacionRequest, SolicitudDetalle, SolicitudListResponse
from app.services.solicitud_service import SolicitudService
from app.utils.exceptions import EstadoSolicitudError, RecursoNoEncontradoError

router = APIRouter(
    prefix="/admin/solicitudes",
    tags=["Solicitudes (BackOffice)"],
    dependencies=[Depends(require_backoffice)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)

SolicitudId = Annotated[int, Path(gt=0, description="Id de la solicitud")]


@router.get("", response_model=SolicitudListResponse, summary="Listar solicitudes")
def list_solicitudes(
    estado: Annotated[Literal["PENDIENTE", "APROBADO", "RECHAZADO"] | None, Query()] = None,
    buscar: Annotated[
        str | None, Query(max_length=100, description="Radicado, nombre, documento o correo")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    service: SolicitudService = Depends(get_solicitud_service),
) -> SolicitudListResponse:
    return service.listar(estado=estado, buscar=buscar, limit=limit, offset=offset)


@router.get(
    "/{solicitud_id}",
    response_model=SolicitudDetalle,
    summary="Detalle de una solicitud",
    responses={status.HTTP_404_NOT_FOUND: {"model": MensajeError}},
)
def get_solicitud(
    solicitud_id: SolicitudId,
    service: SolicitudService = Depends(get_solicitud_service),
) -> SolicitudDetalle:
    try:
        return service.detalle(solicitud_id)
    except RecursoNoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc


@router.post(
    "/{solicitud_id}/evaluar",
    response_model=SolicitudDetalle,
    summary="Aprobar o rechazar una solicitud",
    description="Solo las solicitudes PENDIENTES pueden evaluarse. La justificación es obligatoria.",
    responses={
        status.HTTP_404_NOT_FOUND: {"model": MensajeError},
        status.HTTP_409_CONFLICT: {"model": MensajeError, "description": "La solicitud ya fue evaluada"},
    },
)
def evaluar_solicitud(
    solicitud_id: SolicitudId,
    evaluacion: EvaluacionRequest,
    usuario: Usuario = Depends(require_backoffice),
    service: SolicitudService = Depends(get_solicitud_service),
) -> SolicitudDetalle:
    try:
        return service.evaluar(solicitud_id, evaluacion, usuario)
    except RecursoNoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc
    except EstadoSolicitudError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get(
    "/{solicitud_id}/documentos/{documento_id}/archivo",
    response_class=FileResponse,
    summary="Ver un documento adjunto",
    description="Envía el archivo con Content-Disposition inline para que el navegador lo muestre.",
    responses={status.HTTP_404_NOT_FOUND: {"model": MensajeError}},
)
def get_documento_archivo(
    solicitud_id: SolicitudId,
    documento_id: Annotated[int, Path(gt=0)],
    service: SolicitudService = Depends(get_solicitud_service),
) -> FileResponse:
    try:
        path, media_type, filename = service.documento(solicitud_id, documento_id)
    except RecursoNoEncontradoError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message) from exc
    return FileResponse(
        path,
        media_type=media_type,
        filename=filename,
        content_disposition_type="inline",
        headers={
            # El navegador debe respetar el tipo declarado y no guardar copias en caché compartida.
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
