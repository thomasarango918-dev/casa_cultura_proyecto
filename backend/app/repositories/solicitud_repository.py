"""
Repositorio de solicitudes: consultas y escrituras sobre TBL_SolicitudInscripcion,
TBL_DocumentoInscripcion y TBL_ConsecutivoRadicado, más los catálogos que usa
el formulario público (programas y tipos de documento).

El repositorio no confirma transacciones: el servicio decide cuándo hacer
commit, porque la radicación combina base de datos y archivos en disco.
"""

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.models.catalogo_model import Parentesco, RequisitoDocumento
from app.models.programa_model import Categoria, Programa
from app.models.solicitud_model import (
    ESTADO_APROBADO,
    ESTADO_PENDIENTE,
    ESTADO_RECHAZADO,
    DocumentoInscripcion,
    SolicitudInscripcion,
)
from app.models.user_model import TipoDocumento

# Incrementa el consecutivo del año en curso y devuelve el radicado ya formateado.
#   - El año se toma del reloj de PostgreSQL (LOCALTIMESTAMP), no del servidor web.
#   - INSERT ... ON CONFLICT DO UPDATE es atómico: si dos peticiones llegan a la vez,
#     la segunda espera el bloqueo de fila que la primera mantiene hasta su COMMIT.
#   - Si la transacción se revierte, el incremento también: no quedan huecos.
#   - LPAD con GREATEST conserva al menos cuatro dígitos sin truncar desde el 10000.
_NEXT_RADICADO_SQL = text(
    """
    INSERT INTO tbl_consecutivoradicado AS c (anio, ultimo)
    VALUES (EXTRACT(YEAR FROM LOCALTIMESTAMP)::INT, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo = c.ultimo + 1
    RETURNING 'RAD-' || c.anio || '-' || LPAD(c.ultimo::TEXT, GREATEST(4, LENGTH(c.ultimo::TEXT)), '0')
    """
)


def _escape_like(value: str) -> str:
    """Escapa los comodines de LIKE para buscar el texto literal escrito por el usuario."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class SolicitudRepository:
    """Acceso a datos de las solicitudes de inscripción."""

    def __init__(self, db: Session) -> None:
        self._db = db

    # ---- Catálogos -----------------------------------------------------------
    def list_programas(self) -> list[Programa]:
        return list(self._db.scalars(select(Programa).order_by(Programa.programa)))

    def get_programa(self, programa_id: int) -> Programa | None:
        return self._db.get(Programa, programa_id)

    def get_programa_para_radicar(self, programa_id: int) -> tuple[Programa, bool] | None:
        """(programa, categoría activa). FOR SHARE hasta el COMMIT: si el BackOffice deshabilita la
        categoría o borra el programa en paralelo, espera y luego ve esta solicitud (Fase 5)."""
        stmt = (
            select(Programa, Categoria.activo)
            .join(Categoria, Programa.categoria_id == Categoria.id)
            .where(Programa.id == programa_id)
            .with_for_update(read=True)
        )
        row = self._db.execute(stmt).first()
        return (row[0], row[1]) if row else None

    def list_tipos_documento(self) -> list[TipoDocumento]:
        return list(self._db.scalars(select(TipoDocumento).order_by(TipoDocumento.id)))

    def tipo_documento_exists(self, sigla: str) -> bool:
        stmt = select(TipoDocumento.id).where(TipoDocumento.tipo_doc == sigla)
        return self._db.scalar(stmt) is not None

    def list_parentescos(self) -> list[Parentesco]:
        return list(self._db.scalars(select(Parentesco).order_by(Parentesco.orden, Parentesco.parentesco)))

    def parentesco_exists(self, parentesco: str) -> bool:
        stmt = select(Parentesco.id).where(Parentesco.parentesco == parentesco)
        return self._db.scalar(stmt) is not None

    def list_requisitos(self) -> list[RequisitoDocumento]:
        """Documentos que debe adjuntar el aspirante, en el orden en que se muestran."""
        return list(self._db.scalars(select(RequisitoDocumento).order_by(RequisitoDocumento.orden)))

    # ---- Radicación ----------------------------------------------------------
    def next_numero_radicado(self) -> str:
        """Reserva el siguiente número RAD-AAAA-XXXX dentro de la transacción actual."""
        return self._db.execute(_NEXT_RADICADO_SQL).scalar_one()

    def add(self, solicitud: SolicitudInscripcion) -> SolicitudInscripcion:
        """Agrega la solicitud a la sesión y obtiene su id (sin confirmar)."""
        self._db.add(solicitud)
        self._db.flush()
        return solicitud

    def add_documento(self, documento: DocumentoInscripcion) -> None:
        self._db.add(documento)

    # ---- Control de la transacción (lo usa el servicio) ----------------------
    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def refresh(self, solicitud: SolicitudInscripcion) -> SolicitudInscripcion:
        """Relee la solicitud para obtener los valores calculados por PostgreSQL (fechas)."""
        self._db.refresh(solicitud)
        return solicitud

    # ---- Consultas del BackOffice --------------------------------------------
    def get_by_id(self, solicitud_id: int, *, for_update: bool = False) -> SolicitudInscripcion | None:
        """Busca una solicitud. Con for_update bloquea la fila hasta el fin de la transacción."""
        stmt = select(SolicitudInscripcion).where(SolicitudInscripcion.id == solicitud_id)
        if for_update:
            # "of" limita el bloqueo a la solicitud (no a la tabla de programas unida).
            stmt = stmt.with_for_update(of=SolicitudInscripcion)
        return self._db.scalars(stmt).unique().first()

    def get_documento(self, solicitud_id: int, documento_id: int) -> DocumentoInscripcion | None:
        stmt = select(DocumentoInscripcion).where(
            DocumentoInscripcion.id == documento_id,
            DocumentoInscripcion.solicitud_id == solicitud_id,
        )
        return self._db.scalars(stmt).first()

    def search(
        self,
        *,
        estado: str | None = None,
        buscar: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[int, list[SolicitudInscripcion]]:
        """Lista solicitudes (más recientes primero) con filtros opcionales.

        Args:
            estado: PENDIENTE, APROBADO o RECHAZADO.
            buscar: Texto a buscar en radicado, nombre, documento o correo.

        Returns:
            Tupla (total que cumple los filtros, página solicitada).
        """
        conditions = []
        if estado:
            conditions.append(SolicitudInscripcion.estado == estado)
        if buscar:
            pattern = f"%{_escape_like(buscar)}%"
            nombre_completo = SolicitudInscripcion.nombres + " " + SolicitudInscripcion.apellidos
            conditions.append(
                or_(
                    SolicitudInscripcion.numero_radicado.ilike(pattern, escape="\\"),
                    nombre_completo.ilike(pattern, escape="\\"),
                    SolicitudInscripcion.numero_documento.ilike(pattern, escape="\\"),
                    SolicitudInscripcion.correo_electronico.ilike(pattern, escape="\\"),
                )
            )

        total = self._db.scalar(select(func.count(SolicitudInscripcion.id)).where(*conditions)) or 0
        stmt = (
            select(SolicitudInscripcion)
            .where(*conditions)
            .order_by(SolicitudInscripcion.fecha_radicacion.desc(), SolicitudInscripcion.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return total, list(self._db.scalars(stmt).unique())

    # ---- Inventario de documentos --------------------------------------------
    def _columna_inventario(self, metodo: str):
        """Columna sobre la que busca el inventario: número de documento o número de radicado."""
        if metodo == "radicado":
            return SolicitudInscripcion.numero_radicado
        return SolicitudInscripcion.numero_documento

    def search_inventario(self, *, metodo: str, valor: str, limit: int) -> tuple[int, list[SolicitudInscripcion]]:
        """Solicitudes con documentos cuyo documento de identidad o radicado contiene `valor`.

        La búsqueda es parcial y sin distinguir mayúsculas ("0001" encuentra RAD-2026-0001).
        Las coincidencias exactas aparecen primero y luego las más recientes.
        """
        columna = self._columna_inventario(metodo)
        condiciones = [
            columna.ilike(f"%{_escape_like(valor)}%", escape="\\"),
            SolicitudInscripcion.documentos.any(),
        ]
        total = self._db.scalar(select(func.count(SolicitudInscripcion.id)).where(*condiciones)) or 0
        stmt = (
            select(SolicitudInscripcion)
            .where(*condiciones)
            .order_by(
                (func.upper(columna) == valor.upper()).desc(),
                SolicitudInscripcion.fecha_radicacion.desc(),
                SolicitudInscripcion.id.desc(),
            )
            .limit(limit)
        )
        return total, list(self._db.scalars(stmt).unique())

    def sugerencias_inventario(self, *, metodo: str, valor: str, limit: int) -> list[tuple[str, str, int]]:
        """Valores distintos que contienen `valor`, para el autocompletado del buscador.

        Returns:
            Tuplas (valor, nombre de un aspirante asociado, cantidad de solicitudes).
        """
        columna = self._columna_inventario(metodo)
        nombre = SolicitudInscripcion.nombres + " " + SolicitudInscripcion.apellidos
        stmt = (
            select(
                columna,
                func.max(nombre),
                func.count(SolicitudInscripcion.id),
                func.max(SolicitudInscripcion.fecha_radicacion).label("ultima"),
            )
            .where(columna.ilike(f"%{_escape_like(valor)}%", escape="\\"))
            .group_by(columna)
            .order_by((func.upper(columna) == valor.upper()).desc(), func.max(SolicitudInscripcion.fecha_radicacion).desc())
            .limit(limit)
        )
        return [(row[0], row[1], row[2]) for row in self._db.execute(stmt)]

    def count_by_estado(self) -> dict[str, int]:
        """Cuenta las solicitudes totales y por estado en una sola consulta."""
        estado = SolicitudInscripcion.estado
        row = self._db.execute(
            select(
                func.count(SolicitudInscripcion.id),
                func.count(SolicitudInscripcion.id).filter(estado == ESTADO_PENDIENTE),
                func.count(SolicitudInscripcion.id).filter(estado == ESTADO_APROBADO),
                func.count(SolicitudInscripcion.id).filter(estado == ESTADO_RECHAZADO),
            )
        ).one()
        return {"total": row[0], "pendientes": row[1], "aprobadas": row[2], "rechazadas": row[3]}
