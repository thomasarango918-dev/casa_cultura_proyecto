"""
Esquemas Pydantic v2 del módulo de radicación de solicitudes.

Público (sin token):
    ProgramaOut, TipoDocumentoOut,
    ParentescoOut, RequisitoOut     Catálogos para el formulario de inscripción.
    SolicitudCreate                 Datos personales (y del acudiente) que envía el aspirante.
    RadicadoResponse                Confirmación con el número de radicado.

BackOffice (con token):
    SolicitudResumen                Fila del listado de solicitudes.
    SolicitudListResponse           Listado con el total de resultados.
    SolicitudDetalle                Detalle con los documentos adjuntos.
    EvaluacionRequest               Decisión (aprobar / rechazar) y su justificación.
    DashboardKpis                   Conteos para el panel general.
    InventarioResponse              Inventario de documentos agrupado por solicitud.
    SugerenciaOut                   Opciones del autocompletado del inventario.

Las respuestas nunca exponen la ruta física de los archivos: el frontend los
descarga por su id mediante el endpoint de documentos.
"""

import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EstadoSolicitud = Literal["PENDIENTE", "APROBADO", "RECHAZADO"]

# Criterio de búsqueda del inventario de documentos.
MetodoBusqueda = Literal["documento", "radicado"]

_EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_DOCUMENT_SEPARATORS = re.compile(r"[\s.\-]")
_PHONE_ALLOWED = re.compile(r"^\+?[0-9 ()\-]{7,20}$")

MAYORIA_DE_EDAD = 18
EDAD_MAXIMA = 120


def calcular_edad(fecha_nacimiento: date, hoy: date) -> int:
    """Años cumplidos a la fecha `hoy` (resta uno si aún no llega el cumpleaños de ese año)."""
    cumpleanos_pendiente = (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day)
    return hoy.year - fecha_nacimiento.year - int(cumpleanos_pendiente)


# --------------------------------------------------------------------------- #
# Catálogos públicos
# --------------------------------------------------------------------------- #
class ProgramaOut(BaseModel):
    """Programa o taller que el aspirante puede elegir."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str = Field(validation_alias="programa")


class TipoDocumentoOut(BaseModel):
    """Tipo de documento de identidad admitido (sigla)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    sigla: str = Field(validation_alias="tipo_doc")


class ParentescoOut(BaseModel):
    """Opción de la lista desplegable de parentesco del acudiente."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str = Field(validation_alias="parentesco")


class RequisitoOut(BaseModel):
    """Documento que el aspirante debe adjuntar; `codigo` se envía junto a cada archivo."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    descripcion: str | None
    obligatorio: bool


# --------------------------------------------------------------------------- #
# Radicación pública
# --------------------------------------------------------------------------- #
class SolicitudCreate(BaseModel):
    """Datos personales del aspirante (llegan como campos de multipart/form-data)."""

    nombres: str = Field(..., min_length=2, max_length=100)
    apellidos: str = Field(..., min_length=2, max_length=100)
    tipo_documento: str = Field(..., min_length=2, max_length=20)
    numero_documento: str = Field(..., min_length=3, max_length=20)
    correo_electronico: str = Field(..., min_length=5, max_length=150)
    telefono: str | None = Field(default=None, max_length=20)
    programa_id: int = Field(..., gt=0)
    fecha_nacimiento: date
    edad: int = Field(..., ge=0, le=EDAD_MAXIMA)
    # Acudiente: obligatorio solo si el aspirante es menor de edad (ver errores_condicionales).
    acudiente_nombre: str | None = Field(default=None, max_length=150)
    acudiente_documento: str | None = Field(default=None, max_length=20)
    acudiente_telefono: str | None = Field(default=None, max_length=20)
    acudiente_parentesco: str | None = Field(default=None, max_length=30)

    @field_validator("nombres", "apellidos", mode="before")
    @classmethod
    def _limpiar_nombre(cls, value: object) -> object:
        """Quita espacios sobrantes y pasa a MAYÚSCULAS: '  ana   maría ' -> 'ANA MARÍA'.

        Fase 3: los nombres y apellidos se guardan siempre en mayúsculas, sin importar
        cómo los escribió el aspirante. str.upper() respeta tildes y la eñe (ñ -> Ñ).
        """
        return " ".join(value.split()).upper() if isinstance(value, str) else value

    @field_validator(
        "acudiente_nombre", "acudiente_documento", "acudiente_telefono", "acudiente_parentesco", mode="before"
    )
    @classmethod
    def _limpiar_acudiente(cls, value: object) -> object:
        """Los campos del acudiente vacíos se tratan como no enviados (NULL)."""
        if isinstance(value, str):
            value = " ".join(value.split())
            return value or None
        return value

    @field_validator("acudiente_documento")
    @classmethod
    def _normalizar_documento_acudiente(cls, value: str | None) -> str | None:
        return _DOCUMENT_SEPARATORS.sub("", value).upper() if value else value

    @field_validator("tipo_documento", mode="before")
    @classmethod
    def _normalizar_tipo(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("numero_documento", mode="before")
    @classmethod
    def _normalizar_documento(cls, value: object) -> object:
        """Elimina puntos, guiones y espacios (mismo criterio que el login)."""
        return _DOCUMENT_SEPARATORS.sub("", value).upper() if isinstance(value, str) else value

    @field_validator("numero_documento")
    @classmethod
    def _validar_documento(cls, value: str) -> str:
        if not value.isalnum():
            raise ValueError("El número de documento solo puede contener letras y números.")
        return value

    @field_validator("correo_electronico", mode="before")
    @classmethod
    def _normalizar_correo(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("correo_electronico")
    @classmethod
    def _validar_correo(cls, value: str) -> str:
        if not _EMAIL_PATTERN.match(value):
            raise ValueError("El correo electrónico no tiene un formato válido.")
        return value

    @field_validator("telefono", mode="before")
    @classmethod
    def _normalizar_telefono(cls, value: object) -> object:
        """Un teléfono vacío se guarda como NULL."""
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("telefono")
    @classmethod
    def _validar_telefono(cls, value: str | None) -> str | None:
        if value is not None and not _PHONE_ALLOWED.match(value):
            raise ValueError("El teléfono solo puede contener números, espacios, guiones y el signo +.")
        return value

    @property
    def es_menor_de_edad(self) -> bool:
        return self.edad < MAYORIA_DE_EDAD

    def errores_condicionales(self, hoy: date) -> list[tuple[str, str]]:
        """Reglas que dependen de varios campos: fecha de nacimiento, edad y acudiente.

        Se devuelven como (campo, mensaje) para que el controlador responda 422
        señalando el campo exacto, igual que los demás errores de validación.
        """
        if self.fecha_nacimiento > hoy:
            return [("fecha_nacimiento", "La fecha de nacimiento no puede ser posterior a hoy.")]
        edad_real = calcular_edad(self.fecha_nacimiento, hoy)
        if edad_real > EDAD_MAXIMA:
            return [("fecha_nacimiento", "La fecha de nacimiento no es válida.")]

        errores: list[tuple[str, str]] = []
        if self.edad != edad_real:
            errores.append(("edad", f"La edad no corresponde con la fecha de nacimiento ({edad_real} años)."))

        if edad_real < MAYORIA_DE_EDAD:
            if not self.acudiente_nombre or len(self.acudiente_nombre) < 3:
                errores.append(("acudiente_nombre", "Ingrese el nombre completo del acudiente."))
            if not self.acudiente_documento:
                errores.append(("acudiente_documento", "Ingrese la cédula del acudiente."))
            elif not self.acudiente_documento.isalnum() or not 3 <= len(self.acudiente_documento) <= 20:
                errores.append(
                    ("acudiente_documento", "La cédula del acudiente solo puede contener letras y números.")
                )
            if not self.acudiente_telefono:
                errores.append(("acudiente_telefono", "Ingrese el número de contacto del acudiente."))
            elif not _PHONE_ALLOWED.match(self.acudiente_telefono):
                errores.append(
                    (
                        "acudiente_telefono",
                        "El número de contacto solo puede contener números, espacios, guiones y el signo +.",
                    )
                )
            if not self.acudiente_parentesco:
                errores.append(("acudiente_parentesco", "Seleccione el parentesco del acudiente."))
        return errores


class RadicadoResponse(BaseModel):
    """Confirmación que recibe el aspirante al radicar su solicitud."""

    id: int
    numero_radicado: str
    nombre_completo: str
    correo_electronico: str
    programa: str
    estado: EstadoSolicitud
    fecha_radicacion: datetime
    total_documentos: int


# --------------------------------------------------------------------------- #
# BackOffice
# --------------------------------------------------------------------------- #
class DocumentoOut(BaseModel):
    """Documento adjunto, sin su ruta física."""

    id: int
    nombre_archivo: str
    tipo_documento: str | None  # Tipo MIME.
    requisito: str | None  # Código del requisito (NULL en archivos anteriores al ajuste).
    requisito_nombre: str | None  # Por ejemplo, "Certificado de EPS".
    fecha_subida: datetime


class AcudienteOut(BaseModel):
    """Datos del acudiente de un aspirante menor de edad."""

    nombre: str | None
    documento: str | None
    telefono: str | None
    parentesco: str | None


class SolicitudResumen(BaseModel):
    """Fila del listado de solicitudes."""

    id: int
    numero_radicado: str
    nombres: str
    apellidos: str
    nombre_completo: str
    tipo_documento: str
    numero_documento: str
    correo_electronico: str
    telefono: str | None
    programa_id: int
    programa: str
    estado: EstadoSolicitud
    fecha_radicacion: datetime
    total_documentos: int
    edad: int | None
    es_menor_de_edad: bool


class SolicitudListResponse(BaseModel):
    """Listado de solicitudes con la cantidad total que cumple los filtros."""

    total: int
    items: list[SolicitudResumen]


class SolicitudDetalle(SolicitudResumen):
    """Detalle completo de una solicitud, con sus documentos y su evaluación."""

    justificacion_respuesta: str | None
    fecha_evaluacion: datetime | None
    evaluado_por: str | None  # Nombre del funcionario que evaluó.
    fecha_nacimiento: date | None
    acudiente: AcudienteOut | None  # Solo si el aspirante es menor de edad.
    documentos: list[DocumentoOut]


class EvaluacionRequest(BaseModel):
    """Decisión sobre una solicitud pendiente."""

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"estado": "APROBADO", "justificacion": "Documentación completa y legible."},
            ]
        },
    )

    estado: Literal["APROBADO", "RECHAZADO"]
    justificacion: str = Field(..., min_length=10, max_length=2000)

    @field_validator("justificacion", mode="before")
    @classmethod
    def _limpiar_justificacion(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class DashboardKpis(BaseModel):
    """Conteos reales de solicitudes para las tarjetas del panel general."""

    total: int
    pendientes: int
    aprobadas: int
    rechazadas: int


# --------------------------------------------------------------------------- #
# Inventario de documentos
# --------------------------------------------------------------------------- #
class InventarioSolicitud(BaseModel):
    """Solicitud encontrada en el inventario, con sus documentos adjuntos."""

    solicitud_id: int
    numero_radicado: str
    nombre_completo: str
    tipo_documento: str
    numero_documento: str
    programa: str
    estado: EstadoSolicitud
    fecha_radicacion: datetime
    documentos: list[DocumentoOut]


class InventarioResponse(BaseModel):
    """Resultado de una búsqueda en el inventario."""

    metodo: MetodoBusqueda
    valor: str  # Valor buscado, ya normalizado.
    total: int  # Solicitudes que coinciden (puede ser mayor que len(items)).
    total_documentos: int  # Documentos en las solicitudes devueltas.
    items: list[InventarioSolicitud]


class SugerenciaOut(BaseModel):
    """Opción del autocompletado: un documento de identidad o un radicado existente."""

    valor: str
    nombre: str
    solicitudes: int
