"""
Conexión a PostgreSQL mediante SQLAlchemy.

Define los tres elementos que el resto de la aplicación usa para trabajar con
la base de datos:

    engine        Motor con el pool de conexiones a PostgreSQL.
    SessionLocal  Fábrica de sesiones; cada petición HTTP recibe una sesión propia.
    Base          Clase base de la que heredan todos los modelos ORM.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config.settings import settings

# Motor de conexión.
#   pool_pre_ping: verifica cada conexión antes de usarla y descarta las caídas
#                  (por ejemplo, si PostgreSQL se reinició).
#   pool_recycle:  renueva las conexiones cada 30 minutos para evitar que el
#                  servidor las cierre por inactividad.
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=1800,
)

# Fábrica de sesiones.
#   autoflush=False:        los cambios se envían a la base solo al hacer commit.
#   expire_on_commit=False: los objetos siguen siendo legibles después del commit,
#                           lo que permite devolverlos en la respuesta HTTP.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Clase base de todos los modelos ORM (capa Modelo del MVC)."""


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI que entrega una sesión de base de datos por petición.

    Flujo:
        1. Abre la sesión y la entrega al endpoint (yield).
        2. Si ocurre un error, revierte la transacción para no dejar cambios a medias.
        3. Siempre cierra la sesión y devuelve la conexión al pool.

    Uso en un endpoint:
        def endpoint(db: Session = Depends(get_db)): ...
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_database_connection() -> bool:
    """Ejecuta `SELECT 1` para comprobar que PostgreSQL responde.

    Returns:
        True si la consulta funciona; False si la base no está disponible.
    """
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
