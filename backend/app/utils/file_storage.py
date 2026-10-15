"""
Almacenamiento en disco de los documentos de inscripción.

    read_upload        Lee y valida un archivo recibido (extensión, tamaño y contenido real).
    save_documents     Escribe los archivos en uploads/documentos/<radicado>/.
    delete_files       Borra archivos ya escritos (se usa si la transacción falla).
    resolve_stored     Convierte la ruta guardada en la base en una ruta segura del disco.

Los archivos se guardan con un nombre aleatorio (uuid) para que el nombre que
escribió el aspirante nunca forme parte de la ruta en el servidor.
"""

import re
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import BinaryIO

from app.config.uploads import (
    ALLOWED_EXTENSIONS,
    BACKEND_DIR,
    MAX_FILE_SIZE_BYTES,
    UPLOAD_DIR,
)
from app.utils.exceptions import ArchivoInvalidoError

# Firmas binarias (primeros bytes) de cada tipo admitido. Evitan que un archivo
# con otra naturaleza (por ejemplo, HTML o un ejecutable) se suba renombrado como .pdf.
_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "application/pdf": (b"%PDF-",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
}

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_CHUNK_SIZE = 64 * 1024


@dataclass(frozen=True)
class ArchivoAdjunto:
    """Archivo ya leído y validado, listo para guardarse."""

    nombre_original: str
    extension: str
    mime_type: str
    contenido: bytes


def _matches_signature(content: bytes, mime_type: str) -> bool:
    if mime_type == "image/webp":
        return content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    return any(content.startswith(signature) for signature in _SIGNATURES[mime_type])


def _clean_filename(filename: str) -> str:
    """Conserva solo el nombre (sin carpetas) y quita caracteres de control."""
    name = PurePosixPath(filename.replace("\\", "/")).name
    name = _CONTROL_CHARS.sub("", name).strip()
    return name[-255:] if len(name) > 255 else name


def read_upload(filename: str | None, stream: BinaryIO) -> ArchivoAdjunto:
    """Lee un archivo recibido y valida su extensión, su tamaño y su contenido.

    Raises:
        ArchivoInvalidoError: Si el archivo no cumple alguna de las reglas.
    """
    nombre = _clean_filename(filename or "")
    if not nombre:
        raise ArchivoInvalidoError("Uno de los archivos no tiene nombre.")

    extension = Path(nombre).suffix.lower()
    mime_type = ALLOWED_EXTENSIONS.get(extension)
    if mime_type is None:
        raise ArchivoInvalidoError(
            f"El archivo «{nombre}» no está permitido. Solo se admiten PDF, JPG, PNG o WEBP."
        )

    # Se lee por bloques y se detiene apenas supera el límite, sin cargar archivos enormes.
    chunks: list[bytes] = []
    size = 0
    while chunk := stream.read(_CHUNK_SIZE):
        size += len(chunk)
        if size > MAX_FILE_SIZE_BYTES:
            limit_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise ArchivoInvalidoError(f"El archivo «{nombre}» supera el tamaño máximo de {limit_mb} MB.")
        chunks.append(chunk)
    content = b"".join(chunks)

    if not content:
        raise ArchivoInvalidoError(f"El archivo «{nombre}» está vacío.")
    if not _matches_signature(content, mime_type):
        raise ArchivoInvalidoError(
            f"El contenido del archivo «{nombre}» no corresponde a un {extension.lstrip('.').upper()} válido."
        )

    return ArchivoAdjunto(nombre_original=nombre, extension=extension, mime_type=mime_type, contenido=content)


def save_document(numero_radicado: str, archivo: ArchivoAdjunto) -> tuple[Path, str]:
    """Escribe un archivo en la carpeta del radicado.

    Returns:
        Tupla (ruta absoluta en disco, ruta relativa a la carpeta backend para la base de datos).
    """
    folder = UPLOAD_DIR / numero_radicado
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{uuid.uuid4().hex}{archivo.extension}"
    # "xb": falla si el archivo ya existiera en lugar de sobrescribirlo.
    with path.open("xb") as output:
        output.write(archivo.contenido)
    return path, path.relative_to(BACKEND_DIR).as_posix()


def delete_files(paths: list[Path]) -> None:
    """Borra los archivos indicados y su carpeta si queda vacía. Ignora los que ya no existen."""
    for path in paths:
        path.unlink(missing_ok=True)
    for folder in {path.parent for path in paths}:
        try:
            folder.rmdir()  # Solo funciona si la carpeta quedó vacía.
        except OSError:
            pass


def resolve_stored(ruta_archivo: str) -> Path | None:
    """Convierte la ruta guardada en la base en una ruta absoluta dentro de UPLOAD_DIR.

    Devuelve None si la ruta apunta fuera de la carpeta de documentos (protección
    contra rutas manipuladas como "../../.env") o si el archivo ya no existe.
    """
    path = (BACKEND_DIR / ruta_archivo).resolve()
    if not path.is_relative_to(UPLOAD_DIR.resolve()) or not path.is_file():
        return None
    return path
