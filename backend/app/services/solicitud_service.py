"""
Servicio de solicitudes: reglas de negocio de la radicación y de la evaluación.

Radicación (público):
    0. Verificar que las inscripciones estén abiertas (TBL_Configuracion_Sistema);
       si están cerradas no se procesa nada (InscripcionesCerradasError -> 403).
    1. Validar los documentos (uno por cada requisito de TBL_RequisitoDocumento),
       el programa, el tipo de documento y, si el aspirante es menor de edad,
       el parentesco del acudiente.
    2. Reservar el número RAD-AAAA-XXXX dentro de la transacción.
    3. Guardar la solicitud, escribir los archivos en disco y registrar los documentos.
       La solicitud guarda el periodo académico vigente en la columna Periodo.
    4. Confirmar todo junto. Si algo falla, se revierte la base y se borran los archivos.

Evaluación (BackOffice):
    Solo una solicitud PENDIENTE puede aprobarse o rechazarse, siempre con justificación.

Inventario de documentos (BackOffice):
    Búsqueda parcial por documento de identidad o por número de radicado, con
    autocompletado. Solo consulta; no modifica nada.
"""

import logging
from pathlib import Path

from sqlalchemy import func

from app.config.uploads import ALLOWED_EXTENSIONS, MAX_FILES_PER_REQUEST
from app.models.solicitud_model import (
    ESTADO_PENDIENTE,
    DocumentoInscripcion,
    SolicitudInscripcion,
)
from app.models.user_model import Usuario
from app.repositories.solicitud_repository import SolicitudRepository
from app.schemas.solicitud_schema import (
    AcudienteOut,
    DashboardKpis,
    DocumentoOut,
    EvaluacionRequest,
    InventarioResponse,
    InventarioSolicitud,
    ParentescoOut,
    ProgramaOut,
    RadicadoResponse,
    RequisitoOut,
    SolicitudCreate,
    SolicitudDetalle,
    SolicitudListResponse,
    SolicitudResumen,
    SugerenciaOut,
    TipoDocumentoOut,
)
from app.services.auth_service import normalizar_documento
from app.services.configuracion_sistema_service import ConfiguracionSistemaService
from app.utils.exceptions import (
    ArchivoInvalidoError,
    DatosInvalidosError,
    EstadoSolicitudError,
    InscripcionesCerradasError,
    RecursoNoEncontradoError,
)
from app.utils.file_storage import ArchivoAdjunto, delete_files, resolve_stored, save_document

logger = logging.getLogger("casacultura.solicitudes")

# Archivo recibido junto con el código del requisito al que corresponde.
DocumentoRecibido = tuple[str, ArchivoAdjunto]

# Caracteres mínimos para buscar en el inventario de documentos.
MIN_BUSQUEDA = 2


def normalizar_busqueda(metodo: str, valor: str) -> str:
    """Prepara el texto buscado igual a como está guardado en la base.

    - Documento de identidad: sin puntos, guiones ni espacios y en mayúsculas ("1.036.123" -> "1036123").
    - Radicado: sin espacios y en mayúsculas ("rad-2026-0001" -> "RAD-2026-0001").
    """
    if metodo == "documento":
        return normalizar_documento(valor.strip())
    return "".join(valor.split()).upper()


def to_resumen(solicitud: SolicitudInscripcion) -> SolicitudResumen:
    return SolicitudResumen(
        id=solicitud.id,
        numero_radicado=solicitud.numero_radicado,
        nombres=solicitud.nombres,
        apellidos=solicitud.apellidos,
        nombre_completo=solicitud.nombre_completo,
        tipo_documento=solicitud.tipo_documento,
        numero_documento=solicitud.numero_documento,
        correo_electronico=solicitud.correo_electronico,
        telefono=solicitud.telefono,
        programa_id=solicitud.programa_id,
        programa=solicitud.programa.programa,
        estado=solicitud.estado,
        fecha_radicacion=solicitud.fecha_radicacion,
        total_documentos=len(solicitud.documentos),
        edad=solicitud.edad,
        es_menor_de_edad=solicitud.es_menor_de_edad,
    )


def to_documento_out(documento: DocumentoInscripcion) -> DocumentoOut:
    return DocumentoOut(
        id=documento.id,
        nombre_archivo=documento.nombre_archivo,
        tipo_documento=documento.tipo_documento,
        requisito=documento.requisito,
        requisito_nombre=documento.requisito_info.nombre if documento.requisito_info else None,
        fecha_subida=documento.fecha_subida,
    )


def _orden_documento(documento: DocumentoInscripcion) -> tuple[int, int]:
    """Los documentos se muestran en el orden de los requisitos; los antiguos (sin requisito) al final."""
    orden = documento.requisito_info.orden if documento.requisito_info else 10_000
    return orden, documento.id


def to_detalle(solicitud: SolicitudInscripcion) -> SolicitudDetalle:
    acudiente = None
    if solicitud.acudiente_nombre:
        acudiente = AcudienteOut(
            nombre=solicitud.acudiente_nombre,
            documento=solicitud.acudiente_documento,
            telefono=solicitud.acudiente_telefono,
            parentesco=solicitud.acudiente_parentesco,
        )
    return SolicitudDetalle(
        **to_resumen(solicitud).model_dump(),
        justificacion_respuesta=solicitud.justificacion_respuesta,
        fecha_evaluacion=solicitud.fecha_evaluacion,
        evaluado_por=solicitud.evaluador.nombre_com if solicitud.evaluador else None,
        fecha_nacimiento=solicitud.fecha_nacimiento,
        acudiente=acudiente,
        documentos=[to_documento_out(documento) for documento in sorted(solicitud.documentos, key=_orden_documento)],
    )


class SolicitudService:
    """Casos de uso del módulo de radicación."""

    def __init__(self, repository: SolicitudRepository, configuracion: ConfiguracionSistemaService) -> None:
        self._repository = repository
        self._configuracion = configuracion

    # ---- Catálogos públicos --------------------------------------------------
    def list_programas(self) -> list[ProgramaOut]:
        return [ProgramaOut.model_validate(programa) for programa in self._repository.list_programas()]

    def list_tipos_documento(self) -> list[TipoDocumentoOut]:
        return [TipoDocumentoOut.model_validate(tipo) for tipo in self._repository.list_tipos_documento()]

    def list_parentescos(self) -> list[ParentescoOut]:
        return [ParentescoOut.model_validate(parentesco) for parentesco in self._repository.list_parentescos()]

    def list_requisitos(self) -> list[RequisitoOut]:
        return [RequisitoOut.model_validate(requisito) for requisito in self._repository.list_requisitos()]

    # ---- Radicación ----------------------------------------------------------
    def verificar_inscripciones_abiertas(self) -> None:
        """Rechaza de entrada una radicación si las inscripciones están cerradas.

        Raises:
            InscripcionesCerradasError: Las inscripciones están cerradas (403).
        """
        if not self._configuracion.estado_publico().inscripciones_abiertas:
            raise InscripcionesCerradasError()

    def _validar_documentos(self, documentos: list[DocumentoRecibido]) -> list[DocumentoRecibido]:
        """Comprueba que haya exactamente un archivo por requisito y ninguno faltante.

        Returns:
            Los documentos ordenados según el orden de los requisitos.

        Raises:
            ArchivoInvalidoError: Requisito desconocido, repetido u obligatorio faltante.
        """
        requisitos = {requisito.codigo: requisito for requisito in self._repository.list_requisitos()}
        if len(documentos) > MAX_FILES_PER_REQUEST:
            raise ArchivoInvalidoError(f"Puede adjuntar como máximo {MAX_FILES_PER_REQUEST} documentos.")

        recibidos: set[str] = set()
        for codigo, archivo in documentos:
            requisito = requisitos.get(codigo)
            if requisito is None:
                raise ArchivoInvalidoError(
                    f"El archivo «{archivo.nombre_original}» no corresponde a ninguno de los documentos solicitados."
                )
            if codigo in recibidos:
                raise ArchivoInvalidoError(f"Adjunte un solo archivo para «{requisito.nombre}».")
            recibidos.add(codigo)

        faltantes = [
            requisito.nombre
            for requisito in requisitos.values()
            if requisito.obligatorio and requisito.codigo not in recibidos
        ]
        if faltantes:
            raise ArchivoInvalidoError(f"Falta adjuntar: {', '.join(faltantes)}.")

        return sorted(documentos, key=lambda documento: requisitos[documento[0]].orden)

    def radicar(self, data: SolicitudCreate, documentos: list[DocumentoRecibido]) -> RadicadoResponse:
        """Registra una solicitud con sus documentos y devuelve el radicado asignado.

        Args:
            data: Datos del aspirante, ya validados (incluidas edad y acudiente).
            documentos: Pares (código del requisito, archivo).

        Raises:
            InscripcionesCerradasError: Las inscripciones están cerradas.
            ArchivoInvalidoError: Faltan documentos o alguno no corresponde a un requisito.
            DatosInvalidosError: El programa, el tipo de documento o el parentesco no existen.
        """
        self.verificar_inscripciones_abiertas()
        documentos = self._validar_documentos(documentos)

        # Fase 5: solo programas de categorías activas (los programas sin categoría no se ofrecen).
        encontrado = self._repository.get_programa_para_radicar(data.programa_id)
        if encontrado is None:
            raise DatosInvalidosError("El programa seleccionado no existe.")
        programa, categoria_activa = encontrado
        if not categoria_activa:
            raise DatosInvalidosError("El programa seleccionado no está disponible para inscripciones.")
        if not self._repository.tipo_documento_exists(data.tipo_documento):
            raise DatosInvalidosError("El tipo de documento seleccionado no es válido.")

        # Los datos del acudiente solo se guardan si el aspirante es menor de edad.
        menor = data.es_menor_de_edad
        if menor and not self._repository.parentesco_exists(data.acudiente_parentesco or ""):
            raise DatosInvalidosError("El parentesco seleccionado no es válido.")

        written: list[Path] = []
        try:
            # Se vuelve a leer con bloqueo compartido, dentro de la transacción: si el
            # Administrador cierra las inscripciones en este instante, espera a que termine.
            periodo = self._configuracion.periodo_para_radicar()
            numero_radicado = self._repository.next_numero_radicado()
            solicitud = self._repository.add(
                SolicitudInscripcion(
                    numero_radicado=numero_radicado,
                    nombres=data.nombres,
                    apellidos=data.apellidos,
                    tipo_documento=data.tipo_documento,
                    numero_documento=data.numero_documento,
                    correo_electronico=data.correo_electronico,
                    telefono=data.telefono,
                    programa_id=programa.id,
                    estado=ESTADO_PENDIENTE,
                    fecha_nacimiento=data.fecha_nacimiento,
                    edad=data.edad,
                    acudiente_nombre=data.acudiente_nombre if menor else None,
                    acudiente_documento=data.acudiente_documento if menor else None,
                    acudiente_telefono=data.acudiente_telefono if menor else None,
                    acudiente_parentesco=data.acudiente_parentesco if menor else None,
                    periodo=periodo,
                )
            )
            for codigo, archivo in documentos:
                path, ruta_relativa = save_document(numero_radicado, archivo)
                written.append(path)
                self._repository.add_documento(
                    DocumentoInscripcion(
                        solicitud_id=solicitud.id,
                        nombre_archivo=archivo.nombre_original,
                        ruta_archivo=ruta_relativa,
                        tipo_documento=archivo.mime_type,
                        requisito=codigo,
                    )
                )
            self._repository.commit()
        except Exception:
            # Base y disco quedan como estaban: sin solicitud, sin consecutivo consumido, sin archivos.
            self._repository.rollback()
            delete_files(written)
            raise

        logger.info("Solicitud radicada: %s (%d documento(s))", numero_radicado, len(documentos))
        return RadicadoResponse(
            id=solicitud.id,
            numero_radicado=numero_radicado,
            nombre_completo=f"{data.nombres} {data.apellidos}",
            correo_electronico=data.correo_electronico,
            programa=programa.programa,
            estado=ESTADO_PENDIENTE,
            fecha_radicacion=self._repository.refresh(solicitud).fecha_radicacion,
            total_documentos=len(documentos),
        )

    # ---- BackOffice ----------------------------------------------------------
    def listar(self, *, estado: str | None, buscar: str | None, limit: int, offset: int) -> SolicitudListResponse:
        buscar = buscar.strip() if buscar else None
        total, solicitudes = self._repository.search(estado=estado, buscar=buscar or None, limit=limit, offset=offset)
        return SolicitudListResponse(total=total, items=[to_resumen(solicitud) for solicitud in solicitudes])

    def detalle(self, solicitud_id: int) -> SolicitudDetalle:
        solicitud = self._repository.get_by_id(solicitud_id)
        if solicitud is None:
            raise RecursoNoEncontradoError("La solicitud no existe.")
        return to_detalle(solicitud)

    def evaluar(self, solicitud_id: int, data: EvaluacionRequest, usuario: Usuario) -> SolicitudDetalle:
        """Aprueba o rechaza una solicitud pendiente.

        La fila se bloquea (SELECT ... FOR UPDATE) para que dos funcionarios no
        puedan evaluar la misma solicitud al mismo tiempo.

        Raises:
            RecursoNoEncontradoError: La solicitud no existe.
            EstadoSolicitudError: La solicitud ya fue evaluada.
        """
        solicitud = self._repository.get_by_id(solicitud_id, for_update=True)
        if solicitud is None:
            raise RecursoNoEncontradoError("La solicitud no existe.")
        if solicitud.estado != ESTADO_PENDIENTE:
            self._repository.rollback()
            raise EstadoSolicitudError(
                f"La solicitud {solicitud.numero_radicado} ya fue evaluada ({solicitud.estado})."
            )

        solicitud.estado = data.estado
        solicitud.justificacion_respuesta = data.justificacion
        solicitud.evaluado_por = usuario.id
        solicitud.fecha_evaluacion = func.localtimestamp()
        self._repository.commit()

        logger.info("Solicitud %s evaluada como %s por el usuario %s", solicitud.numero_radicado, data.estado, usuario.id)
        return to_detalle(self._repository.refresh(solicitud))

    def documento(self, solicitud_id: int, documento_id: int) -> tuple[Path, str, str]:
        """Ubica el archivo de un documento para enviarlo al navegador.

        Returns:
            Tupla (ruta en disco, tipo MIME, nombre original).

        Raises:
            RecursoNoEncontradoError: El documento no existe o su archivo ya no está en el servidor.
        """
        documento = self._repository.get_documento(solicitud_id, documento_id)
        if documento is None:
            raise RecursoNoEncontradoError("El documento no existe.")
        path = resolve_stored(documento.ruta_archivo)
        if path is None:
            logger.error("Archivo no encontrado en disco: %s", documento.ruta_archivo)
            raise RecursoNoEncontradoError("El archivo del documento no se encuentra en el servidor.")
        media_type = documento.tipo_documento or ALLOWED_EXTENSIONS.get(path.suffix.lower(), "application/octet-stream")
        return path, media_type, documento.nombre_archivo

    def kpis(self) -> DashboardKpis:
        return DashboardKpis(**self._repository.count_by_estado())

    # ---- Inventario de documentos --------------------------------------------
    def buscar_inventario(self, metodo: str, valor: str, limit: int) -> InventarioResponse:
        """Busca solicitudes (con sus documentos) por documento de identidad o por radicado.

        Raises:
            DatosInvalidosError: El texto buscado tiene menos de MIN_BUSQUEDA caracteres.
        """
        valor = normalizar_busqueda(metodo, valor)
        if len(valor) < MIN_BUSQUEDA:
            raise DatosInvalidosError(f"Escriba al menos {MIN_BUSQUEDA} caracteres para buscar.")
        total, solicitudes = self._repository.search_inventario(metodo=metodo, valor=valor, limit=limit)
        items = [
            InventarioSolicitud(
                solicitud_id=solicitud.id,
                numero_radicado=solicitud.numero_radicado,
                nombre_completo=solicitud.nombre_completo,
                tipo_documento=solicitud.tipo_documento,
                numero_documento=solicitud.numero_documento,
                programa=solicitud.programa.programa,
                estado=solicitud.estado,
                fecha_radicacion=solicitud.fecha_radicacion,
                documentos=[
                    to_documento_out(documento) for documento in sorted(solicitud.documentos, key=_orden_documento)
                ],
            )
            for solicitud in solicitudes
        ]
        return InventarioResponse(
            metodo=metodo,
            valor=valor,
            total=total,
            total_documentos=sum(len(item.documentos) for item in items),
            items=items,
        )

    def sugerencias_inventario(self, metodo: str, valor: str, limit: int) -> list[SugerenciaOut]:
        """Opciones del autocompletado; lista vacía si el texto es demasiado corto."""
        valor = normalizar_busqueda(metodo, valor)
        if len(valor) < MIN_BUSQUEDA:
            return []
        return [
            SugerenciaOut(valor=encontrado, nombre=nombre, solicitudes=cantidad)
            for encontrado, nombre, cantidad in self._repository.sugerencias_inventario(
                metodo=metodo, valor=valor, limit=limit
            )
        ]
