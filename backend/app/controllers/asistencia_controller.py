"""
Capa Controlador (MVC): asistencias (Fase 6, JWT + Administrador/Maestro).

    GET  /api/v1/admin/asistencias/grupo/{id}    Matriz: estudiantes activos x fechas de clase (sin festivos).
    POST /api/v1/admin/asistencias/grupo/{id}    Guarda la asistencia de HOY (otra fecha -> 400).

El Maestro recibe 403 fuera de los grupos de sus programas; el Coordinador no entra.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.dependencies.asistencia_dependencies import get_asistencia_service, require_asistencia
from app.schemas.asistencia_schema import AsistenciaGuardadaOut, GuardarAsistenciaRequest, MatrizAsistenciaOut
from app.schemas.auth_schema import MensajeError
from app.services.asistencia_service import AsistenciaService
from app.utils.exceptions import DomainError, PermisoDenegadoError, RecursoNoEncontradoError

_ERRORES = {
    status.HTTP_400_BAD_REQUEST: {"model": MensajeError},
    status.HTTP_404_NOT_FOUND: {"model": MensajeError},
}

router = APIRouter(
    prefix="/admin/asistencias",
    tags=["Asistencias"],
    dependencies=[Depends(require_asistencia)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)

GrupoId = Annotated[int, Path(gt=0, description="Id del grupo")]
Service = Annotated[AsistenciaService, Depends(get_asistencia_service)]


def _http_error(exc: DomainError) -> HTTPException:
    if isinstance(exc, RecursoNoEncontradoError):
        codigo = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, PermisoDenegadoError):
        codigo = status.HTTP_403_FORBIDDEN
    else:
        codigo = status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=codigo, detail=exc.message)


@router.get(
    "/grupo/{grupo_id}", response_model=MatrizAsistenciaOut, summary="Matriz de asistencia del grupo", responses=_ERRORES
)
def get_matriz(grupo_id: GrupoId, service: Service) -> MatrizAsistenciaOut:
    try:
        return service.matriz(grupo_id)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.post(
    "/grupo/{grupo_id}",
    response_model=AsistenciaGuardadaOut,
    summary="Guardar la asistencia de hoy (solo la fecha actual)",
    responses=_ERRORES,
)
def guardar_asistencia(grupo_id: GrupoId, data: GuardarAsistenciaRequest, service: Service) -> AsistenciaGuardadaOut:
    try:
        return service.guardar(grupo_id, data)
    except DomainError as exc:
        raise _http_error(exc) from exc
