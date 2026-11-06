"""
Festivos de Colombia y calendario de clases (Fase 6, asistencias).

Usa la librería `holidays` (holidays.CO): calcula los festivos sin conexión,
incluida la Ley Emiliani (festivos trasladados al lunes), sin APIs externas.

"Hoy" siempre es la fecha de Colombia (UTC-5, sin horario de verano), no la
del servidor: así el corte de la asistencia no depende de dónde corra la API.
"""

from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

import holidays

ZONA_COLOMBIA = timezone(timedelta(hours=-5), "America/Bogota")


def hoy_colombia() -> date:
    return datetime.now(ZONA_COLOMBIA).date()


@lru_cache(maxsize=16)
def _festivos_del_anio(anio: int) -> holidays.HolidayBase:
    return holidays.CO(years=anio, language="es")


def nombre_festivo(fecha: date) -> str | None:
    """Nombre del festivo (en español) o None si es un día hábil."""
    return _festivos_del_anio(fecha.year).get(fecha)


def es_festivo(fecha: date | None = None) -> bool:
    """¿La fecha (por defecto, hoy en Colombia) es festivo en Colombia?"""
    return nombre_festivo(fecha or hoy_colombia()) is not None


def fechas_de_clase(
    desde: date, hasta: date, dias_semana: Iterable[int]
) -> tuple[list[date], list[tuple[date, str]]]:
    """Fechas entre `desde` y `hasta` (incluidas) cuyo día ISO (1=Lunes ... 7=Domingo) está en
    `dias_semana`, sin los festivos.

    Devuelve (sesiones, festivos_omitidos), ambas en orden cronológico.
    """
    dias = set(dias_semana)
    sesiones: list[date] = []
    omitidos: list[tuple[date, str]] = []
    if not dias or desde > hasta:
        return sesiones, omitidos

    fecha = desde
    while fecha <= hasta:
        if fecha.isoweekday() in dias:
            festivo = nombre_festivo(fecha)
            if festivo is None:
                sesiones.append(fecha)
            else:
                omitidos.append((fecha, festivo))
        fecha += timedelta(days=1)
    return sesiones, omitidos
