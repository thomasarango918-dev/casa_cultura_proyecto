"""
Paquete principal de la API de la Casa de la Cultura de San Pedro de los Milagros.

Organización por capas (MVC adaptado a una API REST):

    config/        Configuración y conexión a la base de datos.
    models/        Modelo: entidades ORM que representan las tablas de PostgreSQL.
    schemas/       Contratos de entrada y salida de la API (Pydantic).
    repositories/  Acceso a datos: consultas sobre los modelos.
    services/      Reglas de negocio.
    controllers/   Controlador: endpoints HTTP que reciben y responden peticiones.
    dependencies/  Piezas inyectables de FastAPI (servicios, usuario autenticado).
    utils/         Utilidades transversales: seguridad, excepciones y errores.

La Vista del MVC es el frontend en React, que consume esta API mediante JSON.
"""
