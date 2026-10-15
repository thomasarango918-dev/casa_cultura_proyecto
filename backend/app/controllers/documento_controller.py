"""
Capa Controlador (MVC): inventario de documentos del BackOffice (CON token JWT).

Permite ubicar los documentos adjuntos sin recorrer el listado de solicitudes,
buscando por documento de identidad del aspirante o por número de radicado.
Los archivos se abren con el endpoint existente:
    GET /api/v1/admin/solicitudes/{id}/documentos/{doc_id}/archivo

Rutas (montadas en main.py bajo /api/v1). Requieren rol Administrador o Coordinador:
    GET /api/v1/admin/documentos               Solicitudes que coinciden, con sus documentos.
    GET /api/v1/admin/documentos/sugerencias   Opciones de autocompletado mientras se escribe.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies.solicitud_dependencies import get_solicitud_service, require_backoffice
from app.schemas.auth_schema import MensajeError
from app.schemas.solicitud_schema import InventarioResponse, MetodoBusqueda, SugerenciaOut
from app.services.solicitud_service import SolicitudService
from app.utils.exceptions import DatosInvalidosError

router = APIRouter(
    prefix="/admin/documentos",
    tags=["Inventario de documentos"],
    dependencies=[Depends(require_backoffice)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)

Metodo = Annotated[MetodoBusqueda, Query(description="documento = documento de identidad; radicado = número de radicado")]
Valor = Annotated[str, Query(min_length=1, max_length=50, description="Texto a buscar (coincidencia parcial)")]


@router.get(
    "",
    response_model=InventarioResponse,
    summary="Buscar documentos",
    description=(
        "Devuelve las solicitudes cuyo documento de identidad o número de radicado contiene el texto "
        "buscado, cada una con sus documentos adjuntos. Las coincidencias exactas aparecen primero."
    ),
    responses={status.HTTP_400_BAD_REQUEST: {"model": MensajeError}},
)
def buscar_documentos(
    metodo: Metodo,
    valor: Valor,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    service: SolicitudService = Depends(get_solicitud_service),
) -> InventarioResponse:
    try:
        return service.buscar_inventario(metodo, valor, limit)
    except DatosInvalidosError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc


@router.get(
    "/sugerencias",
    response_model=list[SugerenciaOut],
    summary="Autocompletado del buscador",
    description="Valores existentes que contienen el texto escrito (mínimo 2 caracteres; si no, lista vacía).",
)
def sugerencias_documentos(
    metodo: Metodo,
    valor: Valor,
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
    service: SolicitudService = Depends(get_solicitud_service),
) -> list[SugerenciaOut]:
    return service.sugerencias_inventario(metodo, valor, limit)
