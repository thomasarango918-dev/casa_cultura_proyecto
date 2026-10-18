"""
Capa Controlador (MVC): módulo de usuarios y roles (Fase 3, CON token JWT).

Rutas (montadas en main.py bajo /api/v1). Requieren rol Administrador o Coordinador;
cualquier otro rol recibe 403:
    GET   /api/v1/admin/usuarios              Listado (Coordinador: solo Maestros y Estudiantes).
    GET   /api/v1/admin/usuarios/catalogos    Roles asignables y tipos de documento.
    GET   /api/v1/admin/usuarios/{id}         Detalle de un usuario.
    POST  /api/v1/admin/usuarios              Crear usuario.
    PUT   /api/v1/admin/usuarios/{id}         Actualizar datos y rol (el documento es inmutable).
    PATCH /api/v1/admin/usuarios/{id}/estado  Habilitar o deshabilitar la cuenta.
"""

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Path, Query, status

from app.dependencies.usuario_dependencies import get_usuario_service, require_gestion_usuarios
from app.models.user_model import Usuario
from app.schemas.auth_schema import MensajeError
from app.schemas.usuario_schema import (
    CatalogosUsuario,
    EstadoUsuarioRequest,
    UsuarioCreate,
    UsuarioListResponse,
    UsuarioOut,
    UsuarioUpdate,
)
from app.services.usuario_service import UsuarioService
from app.utils.exceptions import (
    DatosInvalidosError,
    DomainError,
    PermisoDenegadoError,
    RecursoNoEncontradoError,
    RegistroDuplicadoError,
)

router = APIRouter(
    prefix="/admin/usuarios",
    tags=["Usuarios y roles"],
    dependencies=[Depends(require_gestion_usuarios)],
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": MensajeError},
        status.HTTP_403_FORBIDDEN: {"model": MensajeError},
    },
)

UsuarioId = Annotated[int, Path(gt=0, description="Id del usuario")]

# Código HTTP de cada excepción de dominio de este módulo.
_HTTP_STATUS: dict[type[DomainError], int] = {
    RecursoNoEncontradoError: status.HTTP_404_NOT_FOUND,
    PermisoDenegadoError: status.HTTP_403_FORBIDDEN,
    RegistroDuplicadoError: status.HTTP_409_CONFLICT,
    DatosInvalidosError: status.HTTP_400_BAD_REQUEST,
}

_ERRORES = {
    status.HTTP_400_BAD_REQUEST: {"model": MensajeError},
    status.HTTP_404_NOT_FOUND: {"model": MensajeError},
    status.HTTP_409_CONFLICT: {"model": MensajeError, "description": "Correo o documento ya registrado"},
}


def _http_error(exc: DomainError) -> HTTPException:
    """Traduce la excepción de dominio al código HTTP correspondiente."""
    for tipo, codigo in _HTTP_STATUS.items():
        if isinstance(exc, tipo):
            return HTTPException(status_code=codigo, detail=exc.message)
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.get("", response_model=UsuarioListResponse, summary="Listar usuarios")
def list_usuarios(
    documento: Annotated[str | None, Query(max_length=20, description="Número de documento (parcial)")] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    actor: Usuario = Depends(require_gestion_usuarios),
    service: UsuarioService = Depends(get_usuario_service),
) -> UsuarioListResponse:
    try:
        return service.listar(actor, documento=documento, limit=limit, offset=offset)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.get("/catalogos", response_model=CatalogosUsuario, summary="Roles asignables y tipos de documento")
def get_catalogos(
    actor: Usuario = Depends(require_gestion_usuarios),
    service: UsuarioService = Depends(get_usuario_service),
) -> CatalogosUsuario:
    try:
        return service.catalogos(actor)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.get("/{usuario_id}", response_model=UsuarioOut, summary="Detalle de un usuario", responses=_ERRORES)
def get_usuario(
    usuario_id: UsuarioId,
    actor: Usuario = Depends(require_gestion_usuarios),
    service: UsuarioService = Depends(get_usuario_service),
) -> UsuarioOut:
    try:
        return service.detalle(actor, usuario_id)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.post(
    "",
    response_model=UsuarioOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario",
    description="Un Coordinador solo puede crear usuarios con rol Maestro o Estudiante.",
    responses=_ERRORES,
)
def create_usuario(
    data: UsuarioCreate,
    actor: Usuario = Depends(require_gestion_usuarios),
    service: UsuarioService = Depends(get_usuario_service),
) -> UsuarioOut:
    try:
        return service.crear(actor, data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.put(
    "/{usuario_id}",
    response_model=UsuarioOut,
    summary="Actualizar usuario",
    description="Actualiza nombre, correo, tipo de documento y rol. El número de documento no se puede modificar.",
    responses=_ERRORES,
)
def update_usuario(
    usuario_id: UsuarioId,
    data: UsuarioUpdate,
    actor: Usuario = Depends(require_gestion_usuarios),
    service: UsuarioService = Depends(get_usuario_service),
) -> UsuarioOut:
    try:
        return service.actualizar(actor, usuario_id, data)
    except DomainError as exc:
        raise _http_error(exc) from exc


@router.patch(
    "/{usuario_id}/estado",
    response_model=UsuarioOut,
    summary="Habilitar o deshabilitar usuario",
    description="Con cuerpo `{activo}` fija el estado; sin cuerpo, lo alterna. Nadie puede deshabilitarse a sí mismo.",
    responses=_ERRORES,
)
def update_estado(
    usuario_id: UsuarioId,
    data: Annotated[EstadoUsuarioRequest | None, Body()] = None,
    actor: Usuario = Depends(require_gestion_usuarios),
    service: UsuarioService = Depends(get_usuario_service),
) -> UsuarioOut:
    try:
        return service.cambiar_estado(actor, usuario_id, data.activo if data else None)
    except DomainError as exc:
        raise _http_error(exc) from exc
