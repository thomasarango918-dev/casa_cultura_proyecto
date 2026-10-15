"""
Configuración del almacenamiento de documentos adjuntos.

Los archivos que suben los aspirantes se guardan en `backend/uploads/documentos`,
en una subcarpeta por número de radicado. En la base de datos se registra la ruta
relativa a la carpeta backend (por ejemplo, "uploads/documentos/RAD-2026-0001/<uuid>.pdf").
"""

from pathlib import Path

# Carpeta backend (dos niveles por encima de app/config).
BACKEND_DIR: Path = Path(__file__).resolve().parents[2]

# Carpeta raíz de los documentos de inscripción.
UPLOAD_DIR: Path = BACKEND_DIR / "uploads" / "documentos"

# Límites de la carga desde el formulario público.
MAX_FILES_PER_REQUEST: int = 5
MAX_FILE_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB por archivo.

# Extensiones admitidas y el tipo MIME con el que se sirven al navegador.
ALLOWED_EXTENSIONS: dict[str, str] = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
