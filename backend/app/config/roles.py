"""
Roles del sistema y reglas de control de acceso (RBAC) de la Fase 3.

Los nombres de rol están en TBL_Roles. En la base inicial el rol docente se llama
"Profesor"; en la interfaz se muestra como "Maestro". Para no depender del texto
exacto, cada nombre se traduce a una clave canónica:

    Administrador        -> ADMINISTRADOR
    Coordinador          -> COORDINADOR
    Profesor / Maestro   -> MAESTRO
    Estudiante           -> ESTUDIANTE

Debe coincidir con frontend/src/config/roles.js.
"""

ADMINISTRADOR = "ADMINISTRADOR"
COORDINADOR = "COORDINADOR"
MAESTRO = "MAESTRO"
ESTUDIANTE = "ESTUDIANTE"

# Nombres aceptados en TBL_Roles (en minúsculas) para cada clave.
_ALIAS: dict[str, str] = {
    "administrador": ADMINISTRADOR,
    "coordinador": COORDINADOR,
    "profesor": MAESTRO,
    "maestro": MAESTRO,
    "docente": MAESTRO,
    "estudiante": ESTUDIANTE,
}

# Nombre que se muestra en pantalla para cada clave.
_ETIQUETAS: dict[str, str] = {
    ADMINISTRADOR: "Administrador",
    COORDINADOR: "Coordinador",
    MAESTRO: "Maestro",
    ESTUDIANTE: "Estudiante",
}

# Roles que pueden entrar al módulo de usuarios.
ROLES_GESTION_USUARIOS = ("Administrador", "Coordinador")

# Fase 5: roles que administran categorías y programas.
ROLES_GESTION_PROGRAMAS = ("Administrador", "Coordinador")

# Único rol que puede cambiar la configuración del sistema (inscripciones y periodo).
ROL_ADMINISTRADOR = "Administrador"

# Claves de los roles que cada rol puede ver, crear y asignar en el módulo de usuarios.
ROLES_ADMINISTRABLES: dict[str, frozenset[str]] = {
    ADMINISTRADOR: frozenset({ADMINISTRADOR, COORDINADOR, MAESTRO, ESTUDIANTE}),
    COORDINADOR: frozenset({MAESTRO, ESTUDIANTE}),
}


def clave_rol(nombre: str | None) -> str | None:
    """'Profesor' -> 'MAESTRO'. Devuelve None si el rol no es uno de los cuatro conocidos."""
    return _ALIAS.get((nombre or "").strip().lower())


def etiqueta_rol(nombre: str) -> str:
    """Nombre del rol para mostrar: 'Profesor' -> 'Maestro'; un rol desconocido se deja igual."""
    clave = clave_rol(nombre)
    return _ETIQUETAS[clave] if clave else nombre


def nombres_de_rol(claves: frozenset[str]) -> list[str]:
    """Nombres de TBL_Roles (en minúsculas) que corresponden a un conjunto de claves."""
    return [nombre for nombre, clave in _ALIAS.items() if clave in claves]


def roles_administrables(nombre_rol_actor: str) -> frozenset[str]:
    """Claves de rol que el usuario con ese rol puede gestionar (vacío si no gestiona usuarios)."""
    return ROLES_ADMINISTRABLES.get(clave_rol(nombre_rol_actor) or "", frozenset())


# Fase 6: roles que entran al módulo de grupos. Se usan los alias porque el Maestro
# puede llamarse Profesor, Maestro o Docente en TBL_Roles.
ROLES_GRUPOS = tuple(nombres_de_rol(frozenset({ADMINISTRADOR, COORDINADOR, MAESTRO})))
