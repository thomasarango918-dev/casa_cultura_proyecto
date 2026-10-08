"""
Genera el hash bcrypt de una contraseña para crear usuarios manualmente.

Mientras no exista el módulo de gestión de usuarios, este script permite crear
cuentas nuevas: se genera el hash y se inserta en TBL_Usuarios.Password_Hash.

Uso (desde la carpeta backend, con el entorno virtual activo):
    python -m scripts.generar_hash

La contraseña se pide sin mostrarla en pantalla y se solicita dos veces para
evitar errores de digitación.
"""

from getpass import getpass

from passlib.context import CryptContext


def main() -> None:
    """Pide la contraseña, la confirma e imprime su hash bcrypt."""
    # Mismos parámetros que app/utils/security.py para que la API reconozca el hash.
    context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12)
    password = getpass("Contraseña: ")
    confirmation = getpass("Confirme la contraseña: ")
    if not password or password != confirmation:
        raise SystemExit("Las contraseñas no coinciden o están vacías.")
    # bcrypt ignora todo lo que exceda 72 bytes; se rechaza para no dar una falsa sensación de seguridad.
    if len(password.encode("utf-8")) > 72:
        raise SystemExit("bcrypt admite como máximo 72 bytes por contraseña.")
    print(context.hash(password))


if __name__ == "__main__":
    main()
