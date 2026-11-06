"""
Capa Controlador (MVC): estadísticas contextuales (Fase 7, JWT). Solo lectura.

    GET /api/v1/admin/estadisticas/solicitudes                    Admin/Coord. Solicitudes por estado.
    GET /api/v1/admin/estadisticas/categorias                     Admin/Coord. Aprobados por categoría y programa.
    GET /api/v1/admin/estadisticas/maestros                       Admin/Coord: todos; Maestro: solo él.
    GET /api/v1/admin/estadisticas/ocupacion-grupos?maestro_id=N  Estudiantes activos por grupo del maestro.

Un Maestro que pide la ocupación de otro maestro recibe 403; un maestro inexistente, 404.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies.estadistica_dependencies import (
    get_estadistica_service,
    require_estadisticas,
    require_estadisticas_grupos,
)
from app.models.user_model import Usuario
from app.schemas.auth_schema import MensajeError
from app.schemas.estadistica_schema import (
    EstudiantesPorCategoriaOut,
    MaestroEstadisticaOut,
    OcupacionGrupoOut,
    SolicitudesPorEstadoOut,
)
from app.services.estadistica_service import EstadisticaService
from app.utils.exceptions import DomainError, PermisoDenegadoError, RecursoNoEncontradoError

router = APIRouter(
    prefix="/admin/estadisticas",
    tags=["Estadísticas"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)

Service = Annotated[EstadisticaService, Depends(get_estadistica_service)]
UsuarioGrupos = Annotated[Usuario, Depends(require_estadisticas_grupos)]


def _http_error(exc: DomainError) -> HTTPException:
    if isinstance(exc, RecursoNoEncontradoError):
        codigo = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, PermisoDenegadoError):
        codigo = status.HTTP_403_FORBIDDEN
    else:
        codigo = status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=codigo, detail=exc.message)


@router.get(
    "/solicitudes",
    response_model=list[SolicitudesPorEstadoOut],
    summary="Solicitudes por estado",
    dependencies=[Depends(require_estadisticas)],
)
def get_solicitudes(service: Service) -> list[SolicitudesPorEstadoOut]:
    return service.solicitudes()


@router.get(
    "/categorias",
    response_model=list[EstudiantesPorCategoriaOut],
    summary="Estudiantes aprobados por categoría, desglosados por programa",
    dependencies=[Depends(require_estadisticas)],
)
def get_categorias(service: Service) -> list[EstudiantesPorCategoriaOut]:
    return service.categorias()


@router.get("/maestros", response_model=list[MaestroEstadisticaOut], summary="Maestros del filtro de ocupación")
def get_maestros(usuario: UsuarioGrupos, service: Service) -> list[MaestroEstadisticaOut]:
    return service.maestros(usuario)


@router.get(
    "/ocupacion-grupos",
    response_model=list[OcupacionGrupoOut],
    summary="Estudiantes activos por grupo de un maestro",
    responses={status.HTTP_404_NOT_FOUND: {"model": MensajeError}},
)
def get_ocupacion_grupos(
    usuario: UsuarioGrupos,
    service: Service,
    maestro_id: Annotated[int, Query(gt=0, description="Id del maestro (tbl_usuarios)")],
) -> list[OcupacionGrupoOut]:
    try:
        return service.ocupacion_grupos(maestro_id, usuario)
    except DomainError as exc:
        raise _http_error(exc) from exc
