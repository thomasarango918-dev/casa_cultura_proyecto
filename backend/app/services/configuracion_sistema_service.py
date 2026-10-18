"""
Servicio de la configuración del sistema (Fase 3): control de inscripciones
públicas y periodo académico vigente.

    obtener()                  Estado actual (Administrador).
    actualizar()               Abre o cierra las inscripciones y cambia el periodo (Administrador).
    estado_publico()           Solo si hay inscripciones abiertas (formulario público, sin token).
    periodo_para_radicar()     Lo usa la radicación: 403 si están cerradas; si no, el periodo vigente.

Si la tabla existe pero no tiene la fila semilla, se usan los valores por defecto
(inscripciones abiertas, periodo '2026') y el primer guardado crea la fila.
"""

import logging

from app.models.configuracion_model import (
    CONFIGURACION_ID,
    INSCRIPCIONES_ABIERTAS_DEFECTO,
    PERIODO_ACADEMICO_DEFECTO,
    ConfiguracionSistema,
)
from app.models.user_model import Usuario
from app.repositories.configuracion_sistema_repository import ConfiguracionSistemaRepository
from app.schemas.configuracion_schema import (
    ConfiguracionPublicaOut,
    ConfiguracionSistemaOut,
    ConfiguracionSistemaUpdate,
)
from app.utils.exceptions import InscripcionesCerradasError

logger = logging.getLogger("casacultura.configuracion")


def _por_defecto() -> ConfiguracionSistema:
    return ConfiguracionSistema(
        id=CONFIGURACION_ID,
        inscripciones_abiertas=INSCRIPCIONES_ABIERTAS_DEFECTO,
        periodo_academico=PERIODO_ACADEMICO_DEFECTO,
    )


def to_configuracion_out(configuracion: ConfiguracionSistema) -> ConfiguracionSistemaOut:
    return ConfiguracionSistemaOut(
        inscripciones_abiertas=configuracion.inscripciones_abiertas,
        periodo_academico=configuracion.periodo_academico,
    )


class ConfiguracionSistemaService:
    def __init__(self, repository: ConfiguracionSistemaRepository) -> None:
        self._repository = repository

    def _vigente(self, *, bloquear: str | None = None) -> ConfiguracionSistema:
        return self._repository.get(bloquear=bloquear) or _por_defecto()

    def obtener(self) -> ConfiguracionSistemaOut:
        return to_configuracion_out(self._vigente())

    def estado_publico(self) -> ConfiguracionPublicaOut:
        return ConfiguracionPublicaOut(inscripciones_abiertas=self._vigente().inscripciones_abiertas)

    def actualizar(self, data: ConfiguracionSistemaUpdate, usuario: Usuario) -> ConfiguracionSistemaOut:
        configuracion = self._repository.get(bloquear="exclusivo")
        if configuracion is None:
            configuracion = self._repository.add(_por_defecto())
        configuracion.inscripciones_abiertas = data.inscripciones_abiertas
        configuracion.periodo_academico = data.periodo_academico
        self._repository.commit()
        self._repository.refresh(configuracion)
        logger.info(
            "El usuario %s actualizó la configuración: inscripciones %s, periodo %s.",
            usuario.id,
            "abiertas" if configuracion.inscripciones_abiertas else "cerradas",
            configuracion.periodo_academico,
        )
        return to_configuracion_out(configuracion)

    def periodo_para_radicar(self) -> str:
        """Verifica que las inscripciones estén abiertas y devuelve el periodo vigente.

        Se llama dentro de la transacción de la radicación con un bloqueo compartido:
        si el Administrador cierra las inscripciones en ese instante, su cambio espera
        a que termine la radicación en curso y las siguientes ya se rechazan.

        Raises:
            InscripcionesCerradasError: Las inscripciones están cerradas (403).
        """
        configuracion = self._vigente(bloquear="compartido")
        if not configuracion.inscripciones_abiertas:
            raise InscripcionesCerradasError()
        return configuracion.periodo_academico
