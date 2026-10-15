"""
Capa Modelo (MVC): radicación de solicitudes de inscripción.

Mapea las tablas creadas por database/fase2_solicitudes.sql y ampliadas por
database/fase2_ajustes_inscripcion.sql (fecha de nacimiento, edad, acudiente y
requisito de cada documento):

    TBL_SolicitudInscripcion  -> SolicitudInscripcion
    TBL_DocumentoInscripcion  -> DocumentoInscripcion
    TBL_ConsecutivoRadicado   -> ConsecutivoRadicado
"""

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base
from app.models.catalogo_model import RequisitoDocumento
from app.models.programa_model import Programa
from app.models.user_model import Usuario

# Estados del flujo de radicación (restricción ck_solicitud_estado).
ESTADO_PENDIENTE = "PENDIENTE"
ESTADO_APROBADO = "APROBADO"
ESTADO_RECHAZADO = "RECHAZADO"
ESTADOS_SOLICITUD = (ESTADO_PENDIENTE, ESTADO_APROBADO, ESTADO_RECHAZADO)

# Edad desde la cual el aspirante no necesita acudiente.
MAYORIA_DE_EDAD = 18


class SolicitudInscripcion(Base):
    """Solicitud radicada por un aspirante desde el formulario público."""

    __tablename__ = "tbl_solicitudinscripcion"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    numero_radicado: Mapped[str] = mapped_column(
        "numero_radicado", String(50), unique=True, nullable=False
    )
    nombres: Mapped[str] = mapped_column("nombres", String(100), nullable=False)
    apellidos: Mapped[str] = mapped_column("apellidos", String(100), nullable=False)
    # Sigla del tipo de documento; llave foránea hacia TBL_TipoDocumento.Tipo_Doc.
    tipo_documento: Mapped[str] = mapped_column(
        "tipo_documento", ForeignKey("tbl_tipodocumento.tipo_doc"), nullable=False
    )
    numero_documento: Mapped[str] = mapped_column("numero_documento", String(20), nullable=False)
    correo_electronico: Mapped[str] = mapped_column("correo_electronico", String(150), nullable=False)
    telefono: Mapped[str | None] = mapped_column("telefono", String(20), nullable=True)
    programa_id: Mapped[int] = mapped_column("programa_id", ForeignKey("tbl_programas.id"), nullable=False)
    estado: Mapped[str] = mapped_column(
        "estado", String(20), nullable=False, default=ESTADO_PENDIENTE, server_default=ESTADO_PENDIENTE
    )
    justificacion_respuesta: Mapped[str | None] = mapped_column("justificacion_respuesta", Text, nullable=True)
    fecha_radicacion: Mapped[datetime] = mapped_column(
        "fecha_radicacion", DateTime, nullable=False, server_default=func.localtimestamp()
    )
    fecha_evaluacion: Mapped[datetime | None] = mapped_column("fecha_evaluacion", DateTime, nullable=True)
    evaluado_por: Mapped[int | None] = mapped_column(
        "evaluado_por", ForeignKey("tbl_usuarios.id"), nullable=True
    )
    # Ajuste de inscripción. Admiten NULL solo por las solicitudes radicadas antes del ajuste.
    fecha_nacimiento: Mapped[date | None] = mapped_column("fecha_nacimiento", Date, nullable=True)
    edad: Mapped[int | None] = mapped_column("edad", SmallInteger, nullable=True)
    acudiente_nombre: Mapped[str | None] = mapped_column("acudiente_nombre", String(150), nullable=True)
    acudiente_documento: Mapped[str | None] = mapped_column("acudiente_documento", String(20), nullable=True)
    acudiente_telefono: Mapped[str | None] = mapped_column("acudiente_telefono", String(20), nullable=True)
    acudiente_parentesco: Mapped[str | None] = mapped_column(
        "acudiente_parentesco", ForeignKey("tbl_parentesco.parentesco"), nullable=True
    )

    # El programa se necesita en todos los listados: se carga en la misma consulta.
    programa: Mapped[Programa] = relationship(lazy="joined")
    evaluador: Mapped[Usuario | None] = relationship(lazy="select")
    documentos: Mapped[list["DocumentoInscripcion"]] = relationship(
        back_populates="solicitud",
        cascade="all, delete-orphan",
        order_by="DocumentoInscripcion.id",
        lazy="selectin",
    )

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}"

    @property
    def es_menor_de_edad(self) -> bool:
        return self.edad is not None and self.edad < MAYORIA_DE_EDAD

    def __repr__(self) -> str:
        return f"<SolicitudInscripcion id={self.id} radicado={self.numero_radicado!r} estado={self.estado}>"


class DocumentoInscripcion(Base):
    """Archivo (PDF o imagen) adjunto a una solicitud."""

    __tablename__ = "tbl_documentoinscripcion"

    id: Mapped[int] = mapped_column("id", Integer, primary_key=True)
    solicitud_id: Mapped[int] = mapped_column(
        "solicitud_id", ForeignKey("tbl_solicitudinscripcion.id", ondelete="CASCADE"), nullable=False
    )
    nombre_archivo: Mapped[str] = mapped_column("nombre_archivo", String(255), nullable=False)
    ruta_archivo: Mapped[str] = mapped_column("ruta_archivo", String(500), unique=True, nullable=False)
    tipo_documento: Mapped[str | None] = mapped_column("tipo_documento", String(50), nullable=True)
    # Documento requerido al que corresponde el archivo (NULL en archivos anteriores al ajuste).
    requisito: Mapped[str | None] = mapped_column(
        "requisito", ForeignKey("tbl_requisitodocumento.codigo"), nullable=True
    )
    fecha_subida: Mapped[datetime] = mapped_column(
        "fecha_subida", DateTime, nullable=False, server_default=func.localtimestamp()
    )

    solicitud: Mapped[SolicitudInscripcion] = relationship(back_populates="documentos")
    requisito_info: Mapped[RequisitoDocumento | None] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return f"<DocumentoInscripcion id={self.id} archivo={self.nombre_archivo!r}>"


class ConsecutivoRadicado(Base):
    """Último consecutivo de radicado emitido por año (ver SolicitudRepository.next_numero_radicado)."""

    __tablename__ = "tbl_consecutivoradicado"

    anio: Mapped[int] = mapped_column("anio", Integer, primary_key=True)
    ultimo: Mapped[int] = mapped_column("ultimo", Integer, nullable=False, default=0)
