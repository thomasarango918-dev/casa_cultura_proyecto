"""
Utilidades de seguridad.

Contraseñas:
    Se guardan como hash bcrypt (algoritmo lento a propósito, resistente a ataques
    de fuerza bruta). Nunca se almacena ni se compara la contraseña en texto plano.

Tokens JWT:
    Tras un login correcto se emite un token firmado con JWT_SECRET_KEY. El
    frontend lo envía en cada petición y la API verifica su firma, su vencimiento
    y su emisor antes de aceptarlo.
"""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config.settings import settings
from app.utils.exceptions import TokenInvalidoError

# Contexto de hashing: bcrypt con factor de costo 12 (2^12 iteraciones).
# Passlib reconoce los prefijos $2a$, $2b$ y $2y$, por lo que también valida el
# hash del administrador inicial generado con pgcrypto en schema.sql.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

# Hash de referencia para igualar los tiempos de respuesta cuando el usuario no
# existe. Sin esto, una respuesta más rápida revelaría a un atacante qué correos
# o documentos están registrados (ataque de temporización).
_DUMMY_HASH: str = pwd_context.hash("casa-cultura-usuario-inexistente")


# --------------------------------------------------------------------------- #
# Contraseñas
# --------------------------------------------------------------------------- #
def hash_password(plain_password: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano.

    Args:
        plain_password: Contraseña escrita por el usuario.

    Returns:
        Hash en formato "$2b$12$...", listo para guardar en TBL_Usuarios.Password_Hash.
    """
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Comprueba si una contraseña corresponde a un hash bcrypt.

    Args:
        plain_password: Contraseña recibida en el login.
        hashed_password: Hash guardado en la base de datos.

    Returns:
        True si coinciden. False si no coinciden o si el hash está corrupto.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, TypeError):
        return False


def verify_password_dummy(plain_password: str) -> None:
    """Consume el mismo tiempo que una verificación real sin comparar contra un usuario.

    Se llama cuando el identificador no existe, para que la respuesta tarde lo
    mismo que con un usuario real y no revele su existencia.
    """
    pwd_context.verify(plain_password, _DUMMY_HASH)


def password_needs_rehash(hashed_password: str) -> bool:
    """Indica si el hash usa parámetros obsoletos (por ejemplo, un costo menor a 12).

    Si devuelve True, el servicio regenera el hash con la configuración actual
    aprovechando que en el login se conoce la contraseña en texto plano.
    """
    try:
        return pwd_context.needs_update(hashed_password)
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
# JWT
# --------------------------------------------------------------------------- #
def create_access_token(
    subject: str | int,
    extra_claims: dict[str, Any] | None = None,
    expires_minutes: int | None = None,
) -> tuple[str, int]:
    """Firma un JWT de acceso.

    Args:
        subject: Identificador del dueño del token (el ID del usuario).
        extra_claims: Datos adicionales a incluir, por ejemplo rol y nombre.
        expires_minutes: Vigencia personalizada; si se omite se usa JWT_EXPIRE_MINUTES.

    Returns:
        Tupla (token, vigencia en segundos).
    """
    lifetime = timedelta(minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES)
    issued_at = datetime.now(timezone.utc)

    # Los claims estándar se escriben al final para que extra_claims no pueda sobrescribirlos.
    payload: dict[str, Any] = {
        **(extra_claims or {}),
        "sub": str(subject),
        "iat": issued_at,
        "exp": issued_at + lifetime,
        "iss": settings.JWT_ISSUER,
        "type": "access",
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, int(lifetime.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    """Valida un JWT y devuelve su contenido.

    Comprueba la firma, el vencimiento, el emisor y que sea un token de acceso.
    Solo acepta el algoritmo configurado, lo que bloquea tokens sin firma
    ("alg": "none") o firmados con otro algoritmo.

    Args:
        token: Token recibido en el encabezado Authorization.

    Returns:
        Diccionario con los claims del token.

    Raises:
        TokenInvalidoError: Si el token venció, fue alterado o no es de acceso.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenInvalidoError("Su sesión expiró. Inicie sesión nuevamente.") from exc
    except jwt.PyJWTError as exc:
        raise TokenInvalidoError() from exc

    if payload.get("type") != "access":
        raise TokenInvalidoError()
    return payload


# --------------------------------------------------------------------------- #
# Fase 4: token de recuperación de contraseña
# --------------------------------------------------------------------------- #
# Tipo propio: decode_access_token rechaza este token, así que un enlace de
# recuperación nunca sirve para iniciar sesión (y viceversa).
PASSWORD_RESET_TOKEN_TYPE = "password_reset"


def password_fingerprint(hashed_password: str) -> str:
    """Huella corta del hash actual de la contraseña.

    Va dentro del token de recuperación. Cuando la contraseña cambia, la huella
    deja de coincidir y el enlace ya no sirve: así cada enlace se usa una sola vez.
    """
    return hashlib.sha256(hashed_password.encode("utf-8")).hexdigest()[:16]


def create_password_reset_token(documento: str, password_hash: str) -> str:
    """Firma un JWT de recuperación de contraseña (vence en PASSWORD_RESET_EXPIRE_MINUTES, 15 por defecto).

    Args:
        documento: Número de documento del usuario (queda en "sub").
        password_hash: Hash actual de la contraseña, para calcular la huella de un solo uso.
    """
    issued_at = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": documento,
        "pwd": password_fingerprint(password_hash),
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        "iss": settings.JWT_ISSUER,
        "type": PASSWORD_RESET_TOKEN_TYPE,
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_password_reset_token(token: str) -> dict[str, Any]:
    """Valida un token de recuperación y devuelve sus datos (sub = documento, pwd = huella).

    Raises:
        TokenInvalidoError: El token venció, fue alterado o no es de recuperación.
    """
    mensaje = "El enlace de recuperación no es válido o ya expiró. Solicite uno nuevo."
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            options={"require": ["sub", "exp", "iat", "iss"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenInvalidoError(mensaje) from exc

    if payload.get("type") != PASSWORD_RESET_TOKEN_TYPE or not payload.get("pwd"):
        raise TokenInvalidoError(mensaje)
    return payload
