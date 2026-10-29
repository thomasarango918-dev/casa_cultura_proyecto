"""
Repositorio del módulo de usuarios (Fase 3): consultas y escrituras sobre TBL_Usuarios,
TBL_Roles y TBL_TipoDocumento para la administración de cuentas.

No reemplaza a UserRepository (Fase 1, usado por el login): lo complementa con
las operaciones que necesita el BackOffice. No hace commit por su cuenta; el
servicio decide cuándo confirmar o revertir.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.solicitud_model import SolicitudInscripcion
from app.models.user_model import Role, TipoDocumento, Usuario


def _escape_like(value: str) -> str:
    """Escapa los comodines de LIKE para que '%' y '_' se busquen literalmente."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class UsuarioAdminRepository:
    """Acceso a datos para la gestión de usuarios."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ------------------------------------------------------------------ #
    # Catálogos
    # ------------------------------------------------------------------ #
    def list_roles(self) -> list[Role]:
        return list(self._db.scalars(select(Role).order_by(Role.id)))

    def get_rol(self, rol_id: int) -> Role | None:
        return self._db.get(Role, rol_id)

    def list_tipos_documento(self) -> list[TipoDocumento]:
        return list(self._db.scalars(select(TipoDocumento).order_by(TipoDocumento.id)))

    def get_tipo_documento(self, tipo_id: int) -> TipoDocumento | None:
        return self._db.get(TipoDocumento, tipo_id)

    # ------------------------------------------------------------------ #
    # Usuarios
    # ------------------------------------------------------------------ #
    def get(self, usuario_id: int) -> Usuario | None:
        return self._db.get(Usuario, usuario_id)

    def search(
        self,
        *,
        nombres_rol: list[str] | None,
        documento: str | None,
        limit: int,
        offset: int,
    ) -> tuple[int, list[Usuario]]:
        """Usuarios filtrados por rol (nombres en minúsculas) y por documento parcial.

        `nombres_rol=None` no filtra por rol (Administrador). Una lista vacía no devuelve nada.
        """
        condiciones = []
        if nombres_rol is not None:
            condiciones.append(func.lower(Role.nom_role).in_(nombres_rol))
        if documento:
            condiciones.append(Usuario.num_documento.ilike(f"%{_escape_like(documento)}%", escape="\\"))

        base = select(Usuario).join(Usuario.rol).where(*condiciones)
        total = self._db.scalar(select(func.count()).select_from(base.subquery())) or 0
        stmt = (
            base.order_by(Usuario.state.desc(), Usuario.nombre_com, Usuario.id)
            .limit(limit)
            .offset(offset)
        )
        # unique() es obligatorio con relaciones de carga "joined" en SQLAlchemy 2.0.
        return total, list(self._db.scalars(stmt).unique())

    def email_en_uso(self, email: str, excluir_id: int | None = None) -> bool:
        stmt = select(Usuario.id).where(Usuario.email == email)
        if excluir_id is not None:
            stmt = stmt.where(Usuario.id != excluir_id)
        return self._db.scalar(stmt.limit(1)) is not None

    def documento_en_uso(self, num_documento: str) -> bool:
        stmt = select(Usuario.id).where(Usuario.num_documento == num_documento).limit(1)
        return self._db.scalar(stmt) is not None

    def solicitudes_evaluadas(self, usuario_id: int) -> int:
        stmt = select(func.count()).where(SolicitudInscripcion.evaluado_por == usuario_id)
        return self._db.scalar(stmt) or 0

    def add(self, usuario: Usuario) -> None:
        self._db.add(usuario)

    def delete(self, usuario: Usuario) -> None:
        self._db.delete(usuario)

    # ------------------------------------------------------------------ #
    # Transacción
    # ------------------------------------------------------------------ #
    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def refresh(self, usuario: Usuario) -> None:
        """Recarga el usuario desde la base (incluye rol y tipo de documento, de carga joined)."""
        self._db.refresh(usuario)
