"""
Excepciones de dominio (errores de negocio).

Los servicios lanzan estas excepciones sin saber nada de HTTP; los controladores
las capturan y las traducen al código de estado correspondiente (401, 403...).
Así las reglas de negocio no dependen del framework web.

Cada excepción trae un mensaje por defecto en español, listo para mostrarse al
usuario final.
"""


class DomainError(Exception):
    """Base de los errores de negocio de la aplicación."""

    default_message = "Ocurrió un error al procesar la solicitud."

    def __init__(self, message: str | None = None) -> None:
        """Crea el error con un mensaje propio o, si no se indica, con el mensaje por defecto."""
        self.message = message or self.default_message
        super().__init__(self.message)


class CredencialesInvalidasError(DomainError):
    """El usuario no existe o la contraseña no coincide. El controlador responde 401."""

    default_message = (
        "Las credenciales no son válidas. Verifique su correo o documento y la contraseña."
    )


class UsuarioInactivoError(DomainError):
    """La cuenta existe pero está inhabilitada (State = FALSE). El controlador responde 403."""

    default_message = (
        "Su cuenta está inactiva. Comuníquese con la coordinación de la Casa de la Cultura."
    )


class TokenInvalidoError(DomainError):
    """El JWT está vencido, alterado o mal formado. El controlador responde 401."""

    default_message = "La sesión no es válida o ha expirado. Inicie sesión nuevamente."


class PermisoDenegadoError(DomainError):
    """El usuario está autenticado pero su rol no permite la acción. Se responde 403."""

    default_message = "No tiene permisos para realizar esta acción."


# --------------------------------------------------------------------------- #
# Fase 2: radicación de solicitudes
# --------------------------------------------------------------------------- #
class RecursoNoEncontradoError(DomainError):
    """La solicitud, el documento o el archivo pedido no existe. El controlador responde 404."""

    default_message = "El recurso solicitado no existe."


class DatosInvalidosError(DomainError):
    """Los datos son correctos en forma pero no en contenido (programa inexistente...). Se responde 400."""

    default_message = "Los datos enviados no son válidos."


class ArchivoInvalidoError(DatosInvalidosError):
    """Un archivo adjunto no cumple el formato, el tamaño o la cantidad permitidos. Se responde 400."""

    default_message = "Uno de los archivos adjuntos no es válido."


class EstadoSolicitudError(DomainError):
    """La solicitud ya fue evaluada y no admite otra decisión. El controlador responde 409."""

    default_message = "La solicitud ya fue evaluada y no admite cambios."


# --------------------------------------------------------------------------- #
# Fase 3: usuarios, roles y configuración
# --------------------------------------------------------------------------- #
class RegistroDuplicadoError(DomainError):
    """Ya existe un usuario con el mismo correo o número de documento. Se responde 409."""

    default_message = "Ya existe un registro con esos datos."


class InscripcionesCerradasError(DomainError):
    """El Administrador cerró las inscripciones públicas. El controlador responde 403."""

    default_message = "En este momento no hay convocatorias abiertas."
