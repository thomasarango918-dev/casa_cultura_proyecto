# Contexto General del Proyecto: Casa de la Cultura

## Visión del Sistema
Sistema Web FullStack para la gestión administrativa de programas y el módulo público de inscripciones de la Casa de la Cultura de San Pedro de los Milagros.

## Pila Tecnológica
- **Backend:** Python 3.12+ / FastAPI / SQLAlchemy / Uvicorn.
- **Base de Datos:** PostgreSQL local en puerto 5432 (`casacultura`).
- **Frontend:** React + Vite / React Router DOM / Tailwind CSS.
- **Autenticación:** Tokens JWT (exclusivo para administradores del BackOffice).

---

## Estado Actual Completo: FASE 1 (100% Funcional y Estable)

### Estructura y Responsabilidad de Archivos en Backend:
- `backend/main.py`: Punto de entrada de la API en FastAPI. Configura CORS, monta las rutas base y levanta el servidor Uvicorn en el puerto 8000.
- `backend/app/config/database.py`: Configura la conexión a PostgreSQL con SQLAlchemy (`create_engine`, `SessionLocal`). Incluye la función de verificación de conexión.
- `backend/app/config/settings.py`: Carga las variables de entorno desde `.env` (credenciales de BD, clave secreta JWT, puerto).
- `backend/app/core/security.py`: Utilidades para encriptar contraseñas (`passlib/bcrypt`) y generar/validar tokens JWT.
- `backend/app/models/user.py`: Modelo SQLAlchemy para la tabla `TBL_Usuario` (Administradores del sistema).
- `backend/app/routers/auth.py`: Endpoint `/api/v1/auth/login` que autentica credenciales y emite el token JWT.

### Estructura y Responsabilidad de Archivos en Frontend:
- `frontend/src/App.jsx`: Enrutador principal de la aplicación React usando React Router.
- `frontend/src/pages/Login.jsx`: Formulario de inicio de sesión administrativo con notificaciones toast y almacenamiento de token.
- `frontend/src/pages/Dashboard.jsx`: Layout principal del BackOffice administrativo con barra lateral, encabezado y tarjetas de KPIs base.
- `frontend/src/components/`: Componentes reutilizables de UI estilizados con Tailwind CSS.

### Nota: nombres reales de los archivos de la Fase 1
La lista anterior describe la Fase 1 de forma general; en el código los archivos tienen estos nombres (arquitectura por capas: controlador → servicio → repositorio → modelo):

| Descrito arriba | Archivo real |
|---|---|
| `app/core/security.py` | `backend/app/utils/security.py` |
| `app/models/user.py` (`TBL_Usuario`) | `backend/app/models/user_model.py` (tablas `tbl_usuarios`, `tbl_roles`, `tbl_tipodocumento`) |
| `app/routers/auth.py` | `backend/app/controllers/auth_controller.py` + `services/auth_service.py` + `repositories/user_repository.py` + `dependencies/auth_dependencies.py` |
| `pages/Login.jsx` | `frontend/src/pages/LoginPage.jsx` |
| `pages/Dashboard.jsx` | `frontend/src/pages/DashboardBasePage.jsx` (el layout está en `components/layout/MainLayout.jsx`) |

Convenciones a seguir en archivos nuevos:
- Backend: `*_model.py`, `*_schema.py`, `*_repository.py`, `*_service.py`, `*_controller.py`, `*_dependencies.py`.
- Las tablas y columnas se escriben sin comillas en SQL, por lo que PostgreSQL las guarda en minúsculas (`TBL_Usuarios` → `tbl_usuarios`). Los modelos SQLAlchemy usan los nombres en minúsculas.
- Los servicios lanzan excepciones de dominio (`app/utils/exceptions.py`) y los controladores las traducen a códigos HTTP.
- Frontend: los componentes no usan Axios directamente; llaman funciones de `src/services/*.js`, que usan el cliente compartido `services/apiClient.js`.

---

## Estado Actual Completo: FASE 2 (Implementada) — Radicación pública de solicitudes

Guía paso a paso para poner en marcha esta fase: **`GUIA_LANZAMIENTO_FASE2.md`** (raíz del proyecto).

### Resumen funcional
1. Un aspirante, sin iniciar sesión, llena el formulario público `/inscripcion` en 3 pasos (datos personales → programa → documentos) y recibe un número de radicado `RAD-AAAA-XXXX`.
2. Un Administrador o Coordinador revisa las solicitudes en `/dashboard/solicitudes`, abre cada documento adjunto en una pestaña nueva y, solo después de abrirlos todos, puede aprobar o rechazar con una justificación obligatoria.
3. El panel general (`/dashboard`) muestra los conteos reales de solicitudes y las 5 más recientes.
4. No existe envío de correos electrónicos (restricción explícita de la fase).

### Base de datos: `database/fase2_solicitudes.sql`
Script de actualización que se ejecuta **después** de `casacultura.sql`. Es idempotente (se puede ejecutar varias veces sin efecto adicional) y no toca `tbl_usuarios`, `tbl_roles` ni `tbl_tipodocumento`.

- **Reemplazo de la estructura anterior:** `casacultura.sql` creaba `TBL_SolicitudInscripcion` (con `Num_Rad`, `Estado_ID`, etc.) y `TBL_ArchivosSolicitud`, que nunca se usaron. El script las elimina y las recrea con la estructura de la Fase 2 **solo si están vacías**; si tienen registros, lanza un error y no cambia nada. La estructura nueva se reconoce por la columna `numero_radicado`.
- **`TBL_SolicitudInscripcion`**: `id` (identity), `numero_radicado` VARCHAR(50) UNIQUE, `nombres` VARCHAR(100), `apellidos` VARCHAR(100), `tipo_documento` VARCHAR(20) (FK a `tbl_tipodocumento.tipo_doc`, guarda la sigla: CC, TI...), `numero_documento` VARCHAR(20), `correo_electronico` VARCHAR(150) (CHECK en minúsculas), `telefono` VARCHAR(20) NULL, `programa_id` INT (FK a `tbl_programas`), `estado` VARCHAR(20) DEFAULT 'PENDIENTE' (CHECK: `PENDIENTE`, `APROBADO`, `RECHAZADO`), `justificacion_respuesta` TEXT NULL (CHECK: obligatoria si el estado no es PENDIENTE), `fecha_radicacion` TIMESTAMP DEFAULT LOCALTIMESTAMP, y dos columnas de auditoría agregadas: `fecha_evaluacion` TIMESTAMP NULL y `evaluado_por` INT NULL (FK a `tbl_usuarios`, ON DELETE SET NULL). Índices por estado, programa, documento y fecha.
- **`TBL_DocumentoInscripcion`**: `id`, `solicitud_id` (FK, ON DELETE CASCADE), `nombre_archivo` VARCHAR(255) (nombre original), `ruta_archivo` VARCHAR(500) UNIQUE (ruta relativa a `backend/`), `tipo_documento` VARCHAR(50) (tipo MIME: `application/pdf`, `image/jpeg`...), `fecha_subida` TIMESTAMP.
- **`TBL_ConsecutivoRadicado`**: `anio` INT PK, `ultimo` INT. Un registro por año con el último consecutivo emitido.
- **Datos semilla:** 6 programas en `tbl_programas` (Música, Danza, Teatro, Artes plásticas, Literatura y escritura creativa, Artesanías y oficios) con `ON CONFLICT DO NOTHING`.
- `tbl_estadosolicitud` (catálogo antiguo) quedó sin uso; el estado se guarda como texto en la solicitud.

### Generación atómica del número de radicado
En `SolicitudRepository.next_numero_radicado()` (`backend/app/repositories/solicitud_repository.py`):
```sql
INSERT INTO tbl_consecutivoradicado AS c (anio, ultimo)
VALUES (EXTRACT(YEAR FROM LOCALTIMESTAMP)::INT, 1)
ON CONFLICT (anio) DO UPDATE SET ultimo = c.ultimo + 1
RETURNING 'RAD-' || c.anio || '-' || LPAD(c.ultimo::TEXT, GREATEST(4, LENGTH(c.ultimo::TEXT)), '0')
```
- Se ejecuta dentro de la misma transacción que inserta la solicitud. La fila del año queda bloqueada hasta el COMMIT, así que dos radicaciones simultáneas nunca obtienen el mismo número (probado con 12 envíos concurrentes).
- Si la transacción falla (ROLLBACK), el incremento también se revierte: no quedan huecos.
- El año sale del reloj de PostgreSQL. Desde el 10000 el número crece a 5 dígitos sin truncarse. La numeración reinicia en 0001 cada año.

### Backend: archivos nuevos
- `backend/app/config/uploads.py`: carpeta de documentos (`backend/uploads/documentos`), límites (máx. 5 archivos por solicitud, 5 MB por archivo) y extensiones permitidas con su tipo MIME (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`).
- `backend/app/models/programa_model.py`: modelo `Programa` (`tbl_programas`).
- `backend/app/models/solicitud_model.py`: modelos `SolicitudInscripcion`, `DocumentoInscripcion`, `ConsecutivoRadicado` y las constantes `ESTADO_PENDIENTE`, `ESTADO_APROBADO`, `ESTADO_RECHAZADO`. El programa se carga con `lazy="joined"` y los documentos con `lazy="selectin"`.
- `backend/app/schemas/solicitud_schema.py`: esquemas Pydantic. `SolicitudCreate` normaliza los datos (espacios en nombres, documento sin puntos ni guiones, correo en minúsculas, teléfono vacío → NULL) y los valida. `EvaluacionRequest` exige `estado` ∈ {APROBADO, RECHAZADO} y `justificacion` de 10 a 2000 caracteres. Las respuestas nunca exponen la ruta física de los archivos.
- `backend/app/repositories/solicitud_repository.py`: consultas de catálogos, consecutivo, inserción, búsqueda con filtros (escapa `%` y `_` del texto buscado), bloqueo `SELECT ... FOR UPDATE` para evaluar y conteo por estado en una sola consulta. No hace commit por su cuenta: expone `commit()`, `rollback()` y `refresh()` para el servicio.
- `backend/app/services/solicitud_service.py`: reglas de negocio.
  - `radicar()`: valida cantidad de archivos, programa y tipo de documento; reserva el radicado; inserta la solicitud; escribe los archivos; registra los documentos; confirma todo junto. Si algo falla, hace rollback y borra los archivos ya escritos.
  - `evaluar()`: bloquea la fila, exige estado PENDIENTE (si no, `EstadoSolicitudError` → 409) y guarda estado, justificación, evaluador y fecha.
  - `documento()`: ubica el archivo en disco de forma segura.
  - `kpis()`: conteos.
- `backend/app/utils/file_storage.py`: lectura por bloques con corte al superar 5 MB, verificación de la firma binaria real del archivo (un HTML renombrado a `.pdf` se rechaza), limpieza del nombre original, guardado en `uploads/documentos/<RAD>/<uuid>.<ext>` (abre con modo `xb`, nunca sobrescribe) y `resolve_stored()`, que impide servir rutas fuera de la carpeta de documentos.
- `backend/app/dependencies/solicitud_dependencies.py`: `get_solicitud_service` y `require_backoffice` (= `require_roles("Administrador", "Coordinador")`, constante `ROLES_BACKOFFICE`).
- `backend/app/controllers/public_controller.py`: rutas públicas (sin token).
- `backend/app/controllers/solicitud_controller.py`: rutas del BackOffice de solicitudes.
- `backend/app/controllers/dashboard_controller.py`: KPIs.

### Backend: archivos de la Fase 1 modificados (solo adiciones)
- `backend/main.py`: se registran `public_controller`, `solicitud_controller` y `dashboard_controller` en el router `/api/v1`. CORS y manejadores de errores sin cambios.
- `backend/app/models/__init__.py`: reexporta los modelos nuevos.
- `backend/app/utils/exceptions.py`: nuevas excepciones `RecursoNoEncontradoError` (404), `DatosInvalidosError` (400), `ArchivoInvalidoError` (400) y `EstadoSolicitudError` (409).
- `backend/requirements.txt`: se agregó `python-multipart>=0.0.18` (necesario para recibir `multipart/form-data`).
- `backend/.gitignore`: se agregó `uploads/` (los documentos contienen datos personales y no se versionan).
- **Sin cambios:** `database.py`, `settings.py`, `security.py`, `auth_*`, `.env`.

### Endpoints de la Fase 2 (prefijo `/api/v1`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/public/programas` | No | Programas `[{id, nombre}]` ordenados por nombre. |
| GET | `/public/tipos-documento` | No | Tipos `[{id, sigla}]`. |
| POST | `/public/solicitudes` | No | `multipart/form-data`: `nombres`, `apellidos`, `tipo_documento` (sigla), `numero_documento`, `correo_electronico`, `telefono` (opcional), `programa_id` y de 1 a 5 archivos en el campo `archivos`. Responde 201 con `numero_radicado`, `nombre_completo`, `programa`, `estado`, `fecha_radicacion`, `total_documentos`. |
| GET | `/admin/solicitudes` | JWT + rol | Query: `estado` (PENDIENTE/APROBADO/RECHAZADO), `buscar` (radicado, nombre, documento o correo), `limit` (1-500, por defecto 100), `offset`. Responde `{total, items}`. |
| GET | `/admin/solicitudes/{id}` | JWT + rol | Detalle con `documentos`, `justificacion_respuesta`, `fecha_evaluacion`, `evaluado_por` (nombre). |
| POST | `/admin/solicitudes/{id}/evaluar` | JWT + rol | JSON `{estado, justificacion}`. 409 si ya fue evaluada. |
| GET | `/admin/solicitudes/{id}/documentos/{doc_id}/archivo` | JWT + rol | Archivo con `Content-Disposition: inline`, `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`. 404 si el documento no pertenece a la solicitud o el archivo no está en disco. |
| GET | `/admin/dashboard/kpis` | JWT + rol | `{total, pendientes, aprobadas, rechazadas}`. |

"JWT + rol" = token válido y rol Administrador o Coordinador (403 para otros roles, 401 sin token).

Códigos de error: 400 (archivo o dato no válido, programa o tipo inexistente), 401, 403, 404, 409, 422 (formato del manejador global: `{detail, errores: [{campo, mensaje}]}`), 500/503 (manejadores globales de la Fase 1).

### Frontend: archivos nuevos
- `frontend/src/services/publicService.js`: `fetchProgramas`, `fetchTiposDocumento` y `radicarSolicitud` (FormData, timeout de 120 s, progreso de carga). Todas las llamadas usan `skipAuth` y `skipAuthRedirect`: el formulario nunca envía token ni cierra la sesión del BackOffice. Exporta `UPLOAD_LIMITS`, que **debe coincidir** con `backend/app/config/uploads.py`.
- `frontend/src/services/solicitudesService.js`: `listSolicitudes`, `getSolicitud`, `evaluarSolicitud`, `fetchDocumentoBlob` y `getDashboardKpis`.
- `frontend/src/pages/InscripcionPage.jsx` (ruta `/inscripcion`): vista pública aislada (sin `MainLayout`, sin barra lateral, sin token), con encabezado institucional (`BrandMark` + `TopographicPattern`).
  - Paso 1, datos personales: nombres, apellidos, tipo y número de documento, correo obligatorio y teléfono opcional.
  - Paso 2: tarjetas de programas con icono según el nombre.
  - Paso 3: zona de arrastrar y soltar con validación local (formato, tamaño, duplicados, máximo), lista de archivos, resumen y barra de progreso.
  - Tarjeta final con el radicado destacado, botón para copiarlo y "Radicar otra solicitud".
  - Los errores 422 del servidor regresan al paso del campo con error.
- `frontend/src/pages/SolicitudesPage.jsx` (ruta `/dashboard/solicitudes`, dentro de `MainLayout`):
  - Filtros por estado con conteos (abre en **Pendientes**) y buscador con espera de 350 ms que cancela la búsqueda anterior.
  - Tabla responsiva, "Cargar más" de 50 en 50, botones "Actualizar" y "Formulario público".
  - Al evaluar, la fila se actualiza (o sale del filtro) y se recargan los conteos.
- `frontend/src/components/solicitudes/EvaluacionModal.jsx`: datos del aspirante y lista de documentos con estado "sin abrir / Revisado".
  - Cada documento se descarga con el token y se abre como URL `blob:` en una pestaña nueva; la pestaña se abre dentro del clic para evitar el bloqueo de ventanas emergentes.
  - Textarea de justificación obligatoria (mín. 10, máx. 2000 caracteres) y botones "Aprobar" / "Rechazar", **deshabilitados hasta abrir todos los documentos**.
  - Muestra una notificación toast al guardar. Ante un 409 recarga la decisión vigente.
  - Si la solicitud ya fue evaluada, muestra la decisión, la justificación, el evaluador y la fecha.
- `frontend/src/components/solicitudes/EstadoBadge.jsx`: etiqueta de estado (Pendiente ámbar, Aprobada pradera, Rechazada rose) y constante `ESTADOS`.
- `frontend/src/components/ui/SelectField.jsx`: lista desplegable con el mismo estilo y accesibilidad que `TextField`.

### Frontend: archivos de la Fase 1 modificados
- `frontend/src/App.jsx`: ruta pública `/inscripcion` (fuera de `PublicOnlyRoute` y de `ProtectedRoute`, accesible con o sin sesión) y ruta protegida `/dashboard/solicitudes` dentro de `MainLayout`.
- `frontend/src/config/navigation.js`: constante `BACKOFFICE_ROLES = ['Administrador', 'Coordinador']` (debe coincidir con `ROLES_BACKOFFICE` del backend). El grupo "Radicación" solo se muestra a esos roles, "Solicitudes" quedó habilitado y apunta a `/dashboard/solicitudes`, y se registró su título y sus migas de pan. "Documentos" sigue deshabilitado.
- `frontend/src/pages/DashboardBasePage.jsx`:
  - Las tarjetas KPI se conectan a `/admin/dashboard/kpis`: Solicitudes radicadas (`total`), Pendientes, Aprobadas y Rechazadas. Reemplazaron a "Estudiantes inscritos" y "Grupos activos", que no tienen fuente de datos todavía.
  - **Regla de diseño obligatoria** (componente `KpiValue`): la cifra solo se muestra si es `> 0`; con 0, nulo, vacío o error se mantiene la raya gris `—` (`text-pizarra-200`).
  - "Solicitudes recientes" muestra las 5 últimas con enlace a la gestión, y el módulo "Radicación pública de inscripciones" aparece como Disponible.
  - Solo consulta la API si el rol está en `BACKOFFICE_ROLES`.
- `frontend/src/utils/formatters.js`: nuevas funciones `formatDateTime`, `formatShortDate` y `formatFileSize`.
- No se agregaron dependencias npm.

### Limitaciones conocidas y pendientes
- La regla "abrir todos los documentos antes de evaluar" se aplica solo en la interfaz; la API no registra qué documentos se abrieron.
- El endpoint público no tiene límite de solicitudes por usuario (rate limiting); conviene agregarlo antes de producción.
- La URL `blob:` de un documento abierto se libera a los 5 minutos o al cerrar el modal; recargar esa pestaña después no muestra el archivo (se vuelve a abrir desde el modal).
- `docker-compose.yml` monta `database/schema.sql`, que no existe (el archivo es `casacultura.sql`). Es un error previo a la Fase 2, sin corregir.
- No hay envío de correos (restricción de la fase); el aspirante debe guardar su número de radicado.

---

## FASE 2 — AJUSTES DEL FORMULARIO DE INSCRIPCIÓN (Implementado)

Guía paso a paso para aplicar estos ajustes: **`GUIA_AJUSTES_INSCRIPCION.md`** (raíz del proyecto).
Estos ajustes **reemplazan** parte de lo descrito en la sección anterior. Donde haya diferencias, vale lo de esta sección.

### Cambios funcionales
1. **Corrección visual:** el formulario de `/inscripcion` aparecía cortado arriba. El `<main>` tenía `-mt-16` para montarse sobre el encabezado azul, y el `<header>` (que es `relative isolate`, es decir, posicionado) se pintaba encima de la parte superior del formulario. Ahora el encabezado termina con `pb-10 sm:pb-12` y el formulario empieza debajo con `py-8 sm:py-10`, sin superposición. **No volver a usar márgenes negativos** para montar contenido sobre ese encabezado.
2. **Fecha de nacimiento y edad (Paso 1):** el aspirante elige su fecha de nacimiento (`<input type="date">`, entre 1900-01-01 y hoy). La **edad se calcula sola** y se muestra en un campo de solo lectura. El cálculo usa año, mes y día, sin `Date.parse`, para evitar desfases de zona horaria.
3. **Acudiente para menores de edad:** si la edad es **menor de 18**, aparece debajo la sección obligatoria "Datos del acudiente", con nombre completo, cédula, número de contacto y una lista desplegable de parentesco. Si el aspirante es mayor de edad, la sección no aparece y la API descarta cualquier dato de acudiente que llegue.
4. **Documentos guiados (Paso 3):** ya no se sube "cualquier documento". Hay un espacio de carga por cada documento requerido, con su título y su descripción, y todos son obligatorios:
   1. `DOCUMENTO_IDENTIDAD`: Documento de identidad escaneado.
   2. `CERTIFICADO_EPS`: Certificado de EPS.
   3. `FORMATO_INSCRIPCION`: Formato de inscripción firmado (entregado por la Oficina de Cultura).

   Cada espacio admite **un solo archivo** (PDF, JPG, PNG o WEBP, máx. 5 MB), con opciones de arrastrar, "Cambiar" y quitar.
5. **BackOffice:**
   - El modal de evaluación muestra la fecha de nacimiento, la edad (con la etiqueta "Menor de edad"), una sección "Acudiente" y, para cada documento, el **nombre del requisito como título** y el nombre original del archivo debajo.
   - La tabla de solicitudes muestra la edad y la etiqueta "Menor".

### Base de datos: `database/fase2_ajustes_inscripcion.sql`
Se ejecuta **después** de `fase2_solicitudes.sql`. Es idempotente, no borra datos y no toca las tablas de la Fase 1.
- **`TBL_Parentesco`**: `id`, `parentesco` VARCHAR(30) UNIQUE, `orden`. Semilla: Madre, Padre, Abuelo(a), Hermano(a), Tío(a), Tutor(a) legal, Otro.
- **`TBL_RequisitoDocumento`**: `codigo` VARCHAR(40) PK (en mayúsculas), `nombre`, `descripcion`, `orden`, `obligatorio`. Semilla con los 3 documentos anteriores. Para agregar, quitar o renombrar un documento requerido basta con modificar esta tabla: el formulario y la validación del backend se ajustan solos, sin cambiar código.
- **`TBL_SolicitudInscripcion`**, columnas nuevas: `fecha_nacimiento` DATE, `edad` SMALLINT, `acudiente_nombre` VARCHAR(150), `acudiente_documento` VARCHAR(20), `acudiente_telefono` VARCHAR(20) y `acudiente_parentesco` VARCHAR(30) (FK a `tbl_parentesco.parentesco`). Restricciones:
  - `ck_solicitud_edad`: la edad va de 0 a 120.
  - `ck_solicitud_fecha_nacimiento`: la fecha de nacimiento no puede ser posterior a la fecha de radicación.
  - `ck_solicitud_acudiente_menor`: si la edad es menor de 18, los cuatro datos del acudiente son obligatorios.

  Las columnas admiten NULL **solo** para no romper solicitudes radicadas antes del ajuste; la API las exige en toda solicitud nueva.
- **`TBL_DocumentoInscripcion`**, columna nueva: `requisito` VARCHAR(40), con FK a `tbl_requisitodocumento.codigo` e índice único parcial `(solicitud_id, requisito)` (un archivo por requisito en cada solicitud). Vale NULL en los archivos anteriores al ajuste; el BackOffice los muestra como "Documento adjunto".

### Backend: archivos nuevos y modificados
- **Nuevo** `backend/app/models/catalogo_model.py`: modelos `Parentesco` y `RequisitoDocumento`.
- `backend/app/models/solicitud_model.py`:
  - Columnas nuevas de la solicitud, constante `MAYORIA_DE_EDAD = 18` y propiedad `es_menor_de_edad`.
  - En `DocumentoInscripcion`: columna `requisito` y relación `requisito_info` (carga `joined`).
- `backend/app/models/__init__.py`: reexporta `Parentesco` y `RequisitoDocumento`.
- `backend/app/schemas/solicitud_schema.py`:
  - Función `calcular_edad(fecha, hoy)`.
  - `SolicitudCreate` incorpora `fecha_nacimiento`, `edad` y `acudiente_*`, normaliza los campos (vacío → NULL; cédula sin puntos ni guiones) y expone `errores_condicionales(hoy)`. Ese método valida que la fecha no sea futura, que la edad coincida con la fecha y que el acudiente esté completo si el aspirante es menor de edad; devuelve pares (campo, mensaje).
  - Esquemas nuevos: `ParentescoOut`, `RequisitoOut` y `AcudienteOut`.
  - `DocumentoOut` agrega `requisito` y `requisito_nombre`; `SolicitudResumen` agrega `edad` y `es_menor_de_edad`; `SolicitudDetalle` agrega `fecha_nacimiento` y `acudiente`.
- `backend/app/repositories/solicitud_repository.py`: `list_parentescos()`, `parentesco_exists()` y `list_requisitos()`.
- `backend/app/services/solicitud_service.py`:
  - `radicar(data, documentos)` recibe pares `(codigo_requisito, ArchivoAdjunto)`.
  - `_validar_documentos()` exige exactamente un archivo por requisito: rechaza un código desconocido o repetido y avisa si falta uno obligatorio ("Falta adjuntar: …"). Después ordena los archivos según el orden de los requisitos.
  - Si el aspirante es menor de edad, valida el parentesco contra el catálogo y guarda el acudiente; si es mayor, guarda NULL.
  - `to_detalle()` ordena los documentos según los requisitos.
- `backend/app/controllers/public_controller.py`:
  - Nuevos `GET /public/parentescos` y `GET /public/requisitos`.
  - `POST /public/solicitudes` recibe además `fecha_nacimiento` (AAAA-MM-DD), `edad`, `acudiente_nombre`, `acudiente_documento`, `acudiente_telefono` y `acudiente_parentesco`. También recibe la lista `requisitos`, con el código de cada archivo en el mismo orden que `archivos`.
  - Los errores entre campos se responden con 422 y el formato del manejador global (`{campo, mensaje}`).
- **Sin cambios:** `main.py`, `requirements.txt`, configuración, autenticación y `.env`. No hay librerías nuevas.

### Contrato actualizado de `POST /api/v1/public/solicitudes` (multipart/form-data)
| Campo | Obligatorio | Notas |
|---|---|---|
| `nombres`, `apellidos`, `tipo_documento`, `numero_documento`, `correo_electronico`, `programa_id` | Sí | Igual que antes. |
| `telefono` | No | |
| `fecha_nacimiento` | Sí | `AAAA-MM-DD`, no futura, edad ≤ 120. |
| `edad` | Sí | Debe coincidir con la fecha (si no: 422 en `edad` con la edad correcta). |
| `acudiente_nombre`, `acudiente_documento`, `acudiente_telefono`, `acudiente_parentesco` | Solo si la edad es menor de 18 | El parentesco debe existir en `tbl_parentesco` (si no: 400). |
| `archivos` + `requisitos` | Sí | Listas paralelas: un archivo por cada requisito obligatorio de `GET /public/requisitos`. |

Errores 400 de documentos: "Falta adjuntar: …", "Adjunte un solo archivo para «…»", "El archivo «…» no corresponde a ninguno de los documentos solicitados." y "Cada archivo debe indicar a qué documento requerido corresponde."

### Frontend: archivos modificados
- `frontend/src/services/publicService.js`:
  - Nuevas funciones `fetchParentescos()` y `fetchRequisitos()`.
  - `radicarSolicitud(datos, documentos, onProgress)` recibe `[{requisito, file}]` y agrega `archivos` y `requisitos` en el mismo orden.
  - Se quitó `UPLOAD_LIMITS.maxFiles`: ahora la cantidad la definen los requisitos.
- `frontend/src/pages/InscripcionPage.jsx`:
  - Corrección del espaciado del encabezado.
  - Funciones `todayIso()` y `calcularEdad()`, constante `MAYORIA_DE_EDAD = 18` (debe coincidir con el backend).
  - Campos de fecha de nacimiento y edad, y sección condicional del acudiente.
  - Nuevo componente interno `RequisitoUpload`, un espacio de carga por requisito.
  - El estado `documentos` es un objeto `{codigo: File}`.
  - El resumen previo muestra la edad y el acudiente.
- `frontend/src/components/solicitudes/EvaluacionModal.jsx`: fecha de nacimiento, edad, sección "Acudiente" y título del requisito en cada documento.
- `frontend/src/pages/SolicitudesPage.jsx`: edad y etiqueta "Menor" en la columna del solicitante.
- `frontend/src/utils/formatters.js`: `formatBirthDate()`, que da formato a una fecha AAAA-MM-DD sin desfase de zona horaria.
- No hay dependencias npm nuevas.

---

## FASE 2 — INVENTARIO DE DOCUMENTOS (Implementado)

Guía para desplegarlo: **`GUIA_INVENTARIO_DOCUMENTOS.md`** (raíz del proyecto).

### Qué hace
Página de **solo consulta**, `Radicación → Documentos` (`/dashboard/documentos`), para ubicar los documentos adjuntos sin recorrer el listado de solicitudes. No aprueba ni rechaza; eso sigue en `/dashboard/solicitudes`.
1. El funcionario elige el **método de búsqueda** con dos botones de opción: **Documento de identidad** o **Número de radicado**.
2. Escribe el valor completo o una parte. Desde 2 caracteres aparecen **sugerencias** con los valores existentes que lo contienen; la parte que coincide se resalta y se pueden elegir con el mouse o con el teclado (↑, ↓, Enter, Escape). Las sugerencias esperan 250 ms sin escribir y cancelan la consulta anterior.
3. Pulsa el botón **Buscar**, que está al lado del campo, o la tecla Enter. Aparecen las solicitudes que coinciden, primero la coincidencia exacta y luego las más recientes. Cada una muestra su radicado, estado, aspirante, documento, programa, fecha y la lista de sus documentos, con el nombre del requisito como título.
4. Cada documento se abre en una **pestaña nueva** con "Abrir"; después muestra "Ver".
- Normalización (igual en backend y frontend):
  - Por documento se ignoran puntos, guiones y espacios ("1.036.123" → "1036123").
  - Por radicado se ignoran los espacios y las minúsculas ("rad-2026-0001" → "RAD-2026-0001").
- La búsqueda es parcial: "0001" encuentra `RAD-2026-0001`. Los caracteres `%` y `_` se buscan literalmente.
- Mínimo 2 caracteres (`MIN_BUSQUEDA` en el backend, `MIN_CARACTERES` en el frontend). Máximo 50 solicitudes por búsqueda; si hay más, se indica que se debe afinar el valor.
- Solo para los roles Administrador y Coordinador (`require_backoffice`, `BACKOFFICE_ROLES`).

### Endpoints nuevos (prefijo `/api/v1`, JWT + rol)
| Método | Ruta | Parámetros | Respuesta |
|---|---|---|---|
| GET | `/admin/documentos` | `metodo` (`documento`\|`radicado`), `valor` (1-50 caracteres), `limit` (1-100, por defecto 50) | `{metodo, valor (normalizado), total, total_documentos, items: [{solicitud_id, numero_radicado, nombre_completo, tipo_documento, numero_documento, programa, estado, fecha_radicacion, documentos: [DocumentoOut]}]}`. 400 si el valor normalizado tiene menos de 2 caracteres; 422 si el método no es válido. |
| GET | `/admin/documentos/sugerencias` | `metodo`, `valor`, `limit` (1-20, por defecto 8) | `[{valor, nombre, solicitudes}]`; lista vacía si el valor tiene menos de 2 caracteres. |

Los archivos se abren con el endpoint que ya existía, `GET /admin/solicitudes/{id}/documentos/{doc_id}/archivo`.

### Archivos
- **Backend (nuevo)** `backend/app/controllers/documento_controller.py`: router `/admin/documentos` con `require_backoffice`.
- **Backend (modificados, solo adiciones):**
  - `backend/main.py`: registra `documento_controller`.
  - `backend/app/schemas/solicitud_schema.py`: `MetodoBusqueda`, `InventarioSolicitud`, `InventarioResponse` y `SugerenciaOut`.
  - `backend/app/repositories/solicitud_repository.py`: `search_inventario()`, que busca con `ILIKE` escapado solo entre solicitudes con al menos un documento, y `sugerencias_inventario()`, que agrupa los valores distintos.
  - `backend/app/services/solicitud_service.py`: `normalizar_busqueda()` (reutiliza `normalizar_documento` de `auth_service`), `MIN_BUSQUEDA = 2`, `buscar_inventario()` y `sugerencias_inventario()`.
- **Frontend (nuevos):**
  - `frontend/src/pages/DocumentosPage.jsx`: la página, con un combobox accesible (`role="combobox"`, `listbox`, `aria-activedescendant`) que se cierra al hacer clic fuera con `useDismiss`.
  - `frontend/src/services/documentViewer.js`: `abrirDocumentoEnPestana(solicitudId, documento)`. Es la lógica para abrir un documento como `blob:` en una pestaña nueva, que antes estaba dentro de `EvaluacionModal`; ahora la comparten el modal y el inventario. Devuelve `false` si el navegador bloquea la ventana.
- **Frontend (modificados):**
  - `frontend/src/services/solicitudesService.js`: `buscarDocumentos()` y `sugerenciasDocumentos()`.
  - `frontend/src/components/solicitudes/EvaluacionModal.jsx`: usa `abrirDocumentoEnPestana` (mismo comportamiento que antes).
  - `frontend/src/config/navigation.js`: "Documentos" quedó habilitado (`/dashboard/documentos`) y se registraron su título y sus migas de pan.
  - `frontend/src/App.jsx`: ruta protegida `/dashboard/documentos` dentro de `MainLayout`.
- **Sin cambios** en la base de datos, `requirements.txt`, `package.json` ni `.env`.

---

## FASE 3 — ADMINISTRACIÓN: USUARIOS, ROLES, PERMISOS Y CONFIGURACIÓN (Implementado)

La Fase 3 se construyó en dos entregas. Todo lo de esta sección está implementado y probado; ninguna tabla de la Fase 1 cambió de estructura, y la autenticación JWT (`security.py`, `auth_*`), `database.py`, `settings.py` y los `.env` siguen intactos. No se agregaron dependencias (ni en `requirements.txt` ni en `package.json`).

| Entrega | Contenido | Guía | Script SQL |
|---|---|---|---|
| 3.1 | RBAC del frontend, módulo de usuarios, configuración de la cuenta (Mi Perfil / Seguridad), nombres de solicitudes en mayúsculas | `GUIA_LANZAMIENTO_FASE3.md` | `database/fase3_administracion.sql` (opcional: solo datos) |
| 3.2 | Configuración del sistema: interruptor de inscripciones públicas y periodo académico (pestaña Sistema) | `GUIA_CONFIGURACION_SISTEMA.md` | `database/fase3_configuracion_sistema.sql` (**obligatorio**) |

### Orden real de los scripts de base de datos
Los nombres reales de los scripts de la Fase 2 son `ajustes_solicitudes.sql` y `ajustes_inscripcion.sql` (las secciones anteriores los mencionan como `fase2_*.sql`):
1. `database/casacultura.sql`
2. `database/ajustes_solicitudes.sql`
3. `database/ajustes_inscripcion.sql`
4. `database/fase3_administracion.sql`
5. `database/fase3_configuracion_sistema.sql`
6. `database/fase4_notificaciones.sql` (Fase 4, solo consultas de verificación)

Todos son idempotentes y no borran datos.

---

### 3.1 Roles y control de acceso (RBAC)

**Nombres de rol.** En `tbl_roles` el rol docente se llama **`Profesor`**, y en todas las pantallas se muestra como **"Maestro"**. **No se renombra en la BD.** Para no depender del texto exacto, cada nombre se traduce a una clave canónica:

| Nombre en `tbl_roles` | Clave | Etiqueta en pantalla |
|---|---|---|
| Administrador | `ADMINISTRADOR` | Administrador |
| Coordinador | `COORDINADOR` | Coordinador |
| Profesor (también Maestro o Docente) | `MAESTRO` | Maestro |
| Estudiante | `ESTUDIANTE` | Estudiante |

- **Backend:** `backend/app/config/roles.py`.
  - Funciones `clave_rol`, `etiqueta_rol`, `nombres_de_rol` y `roles_administrables`.
  - Constantes `ROLES_GESTION_USUARIOS = ("Administrador", "Coordinador")`, `ROL_ADMINISTRADOR = "Administrador"` y `ROLES_ADMINISTRABLES`.
- **Frontend:** `frontend/src/config/roles.js`, su espejo (**deben coincidir**).
  - `ROL`, `TODOS_LOS_ROLES`, `ROLES_GESTION_USUARIOS`, `claveRol`, `etiquetaRol`, `tieneRol(nombre, claves)` y `ROL_BADGE` (colores de la etiqueta).
- **Alcance en el módulo de usuarios** (`ROLES_ADMINISTRABLES`): el Administrador ve, crea y asigna los 4 roles; el Coordinador solo Maestro y Estudiante.

**Barra lateral** (`frontend/src/config/navigation.js`):
- La propiedad `roles` (claves de `roles.js`) se puede poner en un grupo o en un elemento.
- Los elementos sin `roles` los ven todos, y un grupo sin elementos visibles se oculta.

| Rol | Ve |
|---|---|
| Administrador | Todo |
| Coordinador | Todo menos Asistencia |
| Maestro | Gestión Académica (Grupos, Asistencia) + Administración (solo Configuración) |
| Estudiante | Asistencia + Configuración |

"Panel general" (`/dashboard`) es la página de inicio de todos los roles y siempre está visible. Grupos, Asistencia y Programas siguen siendo elementos deshabilitados (módulos futuros).

**Protección de rutas** (`frontend/src/components/routing/RoleRoute.jsx`):
- Es una guarda por rol dentro de `ProtectedRoute` (`<RoleRoute roles={[...]}/>` con `<Outlet/>`).
- Si el rol no está permitido, **no monta la página** (no se hace ninguna petición a la API) y muestra `components/ui/AccessDenied.jsx`, con el texto exacto **"Careces de los suficientes permisos"** y un enlace al panel.
- Protege `/dashboard/usuarios` (`ROLES_GESTION_USUARIOS`), `/dashboard/solicitudes` y `/dashboard/documentos` (`ROLES_RADICACION`).
- **Regla:** nunca mostrar un 403 crudo. Las páginas y pestañas que reciben 403 de la API también muestran `AccessDenied`.

**Backend:** cada router protegido usa `require_roles(...)` de `auth_dependencies.py` (Fase 1, sin cambios). Responde 401 sin token, 403 si el rol no está permitido o la cuenta está inactiva.

---

### 3.2 Ajuste de la Fase 2: nombres en mayúsculas
- `SolicitudCreate._limpiar_nombre` (`backend/app/schemas/solicitud_schema.py`) quita espacios sobrantes y pasa `nombres` y `apellidos` a **MAYÚSCULAS** antes de guardarlos (`" ".join(value.split()).upper()`). Respeta tildes y ñ: "josé ñuñez" queda "JOSÉ ÑUÑEZ".
- Las solicitudes anteriores no cambian. `fase3_administracion.sql` trae comentado un `UPDATE ... SET nombres = UPPER(nombres) ...` opcional.

---

### 3.3 Módulo de usuarios (`/dashboard/usuarios`, Administrador y Coordinador)

**Pantalla** (`frontend/src/pages/UsuariosPage.jsx`):
- Tabla de usuarios con buscador por número de documento (espera de 350 ms, búsqueda parcial normalizada) y botón **"Crear Usuario"**.
- Las filas de cuentas inactivas (`activo === false`) se ven atenuadas: `bg-slate-100/70 text-slate-400 opacity-60 grayscale`.
- Cada fila tiene un botón de lápiz que abre el modal de edición. "Cargar más" trae 50 usuarios a la vez.
- Los catálogos (roles asignables y tipos de documento) se cargan la primera vez que se abre un modal.
- Si la API responde 403, se muestra `AccessDenied`.

**Modal** (`frontend/src/components/usuarios/UsuarioFormModal.jsx`), un mismo componente para crear y editar:
- **Crear:** nombre completo, correo, tipo y número de documento, rol y contraseña inicial. El selector de rol solo ofrece los roles que el usuario actual puede asignar.
- **Editar:**
  - El número de documento aparece bloqueado (es inmutable).
  - **"Guardar cambios"** abre la confirmación "¿Estás seguro de realizar estos cambios?". Al confirmar se envía el PUT, aparece un toast y la fila se actualiza.
  - El botón **Deshabilitar / Habilitar** abre la confirmación "¿Estás seguro de deshabilitar/habilitar este usuario?". Al confirmar se envía el PATCH y aparece un toast; el modal sigue abierto y la fila se actualiza.
- Los errores del servidor se muestran en su campo: 409 (correo o documento duplicado) y 422.
- `onSaved(usuario, 'creado' | 'actualizado' | 'estado')`.
- `components/usuarios/UsuarioBadges.jsx` contiene `RolBadge` y `UsuarioEstadoBadge`.

**Reglas de negocio** (`backend/app/services/usuario_service.py`):
- El Coordinador no puede ver, crear ni editar Administradores ni Coordinadores. Fuera de su alcance recibe 403 y, si el usuario no existe, 404.
- `num_documento` no se puede modificar. Si el PUT trae un documento distinto, se responde 400.
- Nadie puede cambiar su **propio** rol (400) ni deshabilitar su **propia** cuenta (400). Así el último Administrador no se puede dejar fuera por error.
- Un correo o documento duplicado da 409 (`RegistroDuplicadoError`). También se traduce a 409 un `IntegrityError` si dos peticiones chocan.
- La contraseña se guarda con `hash_password` (passlib/bcrypt, `utils/security.py` de la Fase 1).

---

### 3.4 Configuración (`/dashboard/configuracion`, todos los roles)

**Página** `frontend/src/pages/ConfiguracionPage.jsx`:
- La pestaña activa queda en la URL: `?tab=perfil` (por defecto), `?tab=seguridad` o `?tab=sistema`.
- Se puede pasar de una pestaña a otra con las flechas, Inicio y Fin (patrón ARIA de tabs).
- La pestaña **Sistema solo aparece para el Administrador**. Si otro rol escribe `?tab=sistema`, ve Mi Perfil.

| Pestaña | Componente | Contenido |
|---|---|---|
| Mi Perfil | `components/configuracion/PerfilTab.jsx` | Nombre completo y correo, que se pueden editar; documento y rol, bloqueados. Botón "Guardar Cambios". El encabezado se actualiza con `AuthContext.updateUser`. |
| Seguridad | `components/configuracion/SeguridadTab.jsx` | "Nueva Contraseña" y "Confirmar Nueva Contraseña" (`PasswordField`, con botón para mostrar u ocultar), lista de requisitos que se marca en vivo y botón "Guardar Cambios". La sesión sigue abierta después del cambio. |
| Sistema (solo Admin) | `components/configuracion/SistemaTab.jsx` | Ver la sección 3.5. |

El menú de usuario (`UserMenu.jsx`) tiene la opción "Mi perfil", que lleva a `/dashboard/configuracion`.

**Política de contraseñas** (`validar_password` en el backend y `utils/validators.js` en el frontend):
- 8 caracteres o más.
- Máximo 72 bytes UTF-8, el límite de bcrypt.
- Al menos una letra y un número.
- Sin espacios al principio ni al final.
- La API además rechaza una contraseña nueva igual a la actual (400, con `verify_password`).

---

### 3.5 Configuración del sistema: inscripciones públicas y periodo académico (solo Administrador)

**Base de datos** (`database/fase3_configuracion_sistema.sql`, **se debe ejecutar antes de iniciar el backend**, porque el modelo de solicitud ya lee la columna `periodo`):
- `TBL_Configuracion_Sistema`:
  - Columnas: `id` INT PK, `inscripciones_abiertas` BOOLEAN NOT NULL DEFAULT TRUE y `periodo_academico` VARCHAR(20) NOT NULL DEFAULT '2026'.
  - `CHECK (id = 1)`: solo existe una configuración.
  - `CHECK` de periodo no vacío.
  - Fila semilla `(1, TRUE, '2026')` con `ON CONFLICT DO NOTHING`.
- `TBL_SolicitudInscripcion.periodo`:
  - VARCHAR(20) NULL, con el índice `ix_solicitud_periodo`.
  - Es NULL en las solicitudes anteriores al cambio. Hay un `UPDATE` opcional comentado.

**Comportamiento:**
1. En la pestaña **Sistema** hay un interruptor **"Habilitar Inscripciones Públicas"** (`components/ui/Toggle.jsx`, `role="switch"`), un campo **"Periodo Académico Actual"** (ej. 2026-2) y el botón **"Guardar Configuración"**. El botón envía el PUT y muestra un toast de éxito. Arriba se ve una etiqueta con el estado guardado ("Inscripciones abiertas" o "cerradas").
2. **Formulario público `/inscripcion`** (`InscripcionPage.jsx`):
   - Antes de mostrar los pasos consulta `GET /public/configuracion`. El estado `convocatoria` puede ser `loading | abierta | cerrada | error`.
   - Si está **cerrada**, el formulario **no se renderiza**: en su lugar aparece la tarjeta centrada `ConvocatoriaCerrada`, con el título **"En este momento no hay convocatorias abiertas"**.
   - Si la consulta falla, se muestra una tarjeta de error con "Reintentar".
   - Si la radicación responde 403 (inscripciones cerradas mientras se llenaba el formulario), aparece la misma tarjeta.
3. **Radicación** (`POST /public/solicitudes`):
   - La dependencia `_inscripciones_abiertas` (`public_controller.py`) responde **403** `"En este momento no hay convocatorias abiertas."` **antes** de validar el formulario, así que la respuesta es 403 y no 422.
   - Dentro de la transacción, `SolicitudService.radicar()` vuelve a leer la configuración con `SELECT … FOR SHARE` (`periodo_para_radicar()`). Si las inscripciones siguen abiertas, guarda `periodo_academico` en la columna `periodo` de la solicitud.
   - Si el Administrador cierra las inscripciones en ese instante, su UPDATE espera a que terminen las radicaciones en curso.
4. **Periodo académico:**
   - Se normaliza igual en el backend y el frontend: espacios sobrantes fuera, mayúsculas y guiones juntos (`" 2026 - 2 "` queda `2026-2`).
   - Formato `^[0-9A-Z]+([- ][0-9A-Z]+)*$`, máximo 20 caracteres. Los mensajes de error están en español (validadores propios, sin `min_length`).
5. Si la fila semilla falta, la API usa los valores por defecto (abiertas, `2026`) y el primer guardado la crea.

---

### 3.6 Endpoints de la Fase 3 (prefijo `/api/v1`)
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/usuarios` | JWT + Admin/Coord | Query `documento` (parcial, normalizado), `limit` (1-500), `offset`. Responde `{total, items: [UsuarioOut]}`. El Coordinador solo recibe Maestros y Estudiantes. |
| GET | `/admin/usuarios/catalogos` | JWT + Admin/Coord | `{roles (asignables por quien consulta), tipos_documento}`. |
| GET | `/admin/usuarios/{id}` | JWT + Admin/Coord | Detalle. 403 fuera de alcance, 404 si no existe. |
| POST | `/admin/usuarios` | JWT + Admin/Coord | Crear (201). 403 si el rol no es asignable, 409 si el correo o el documento están duplicados. |
| PUT | `/admin/usuarios/{id}` | JWT + Admin/Coord | Cambia nombre, correo, tipo de documento y rol. `num_documento` es inmutable (400). No se puede cambiar el rol propio (400). |
| PATCH | `/admin/usuarios/{id}/estado` | JWT + Admin/Coord | `{activo}`; sin cuerpo, alterna el estado. No se puede deshabilitar la cuenta propia (400). |
| GET | `/admin/configuracion/me` | JWT (todos) | `PerfilOut` = `UsuarioAutenticado` + `rol_etiqueta`. |
| PUT | `/admin/configuracion/me` | JWT (todos) | `{nombre_completo, email}`. 409 si el correo ya existe. |
| PUT | `/admin/configuracion/me/password` | JWT (todos) | `{password_nueva, password_confirmacion}` y responde 204. 400 si la nueva es igual a la actual; 422 si no cumple la política o la confirmación no coincide. |
| GET | `/admin/configuracion/sistema` | JWT + **Administrador** | `{inscripciones_abiertas, periodo_academico}`. |
| PUT | `/admin/configuracion/sistema` | JWT + **Administrador** | `{inscripciones_abiertas: bool, periodo_academico: str}`. Responde con la configuración guardada; 422 si el periodo no es válido. |
| GET | `/public/configuracion` | Sin token | Solo `{inscripciones_abiertas}`. |
| POST | `/public/solicitudes` | Sin token | Igual que en la Fase 2, más dos cambios: **403** con las inscripciones cerradas y la columna `periodo` llena automáticamente. |

- `UsuarioOut`: `id, nombre_completo, email, tipo_documento_id, tipo_documento, num_documento, rol_id, rol, rol_etiqueta, activo`. Nunca incluye el hash de la contraseña.
- Los errores 422 usan el formato del manejador global, `{detail, errores: [{campo, mensaje}]}`. Los mensajes de los validadores propios llegan con el prefijo "Value error, ", que `getApiFieldErrors` (`apiClient.js`) quita en el frontend.

---

### 3.7 Backend: archivos de la Fase 3
**Nuevos:**
- `app/config/roles.py`: claves de rol, etiquetas y alcance (sección 3.1).
- `app/schemas/usuario_schema.py`:
  - Tipos reutilizables `NombreCompleto`, `Correo` y `Password`, hechos con `Annotated` + `BeforeValidator`/`AfterValidator`. `Field` va primero para que los mensajes salgan bien.
  - Modelos `RolOut`, `CatalogosUsuario`, `UsuarioOut`, `UsuarioListResponse`, `UsuarioCreate`, `UsuarioUpdate` y `EstadoUsuarioRequest`.
- `app/schemas/configuracion_schema.py`:
  - `PerfilOut`, `PerfilUpdate` y `CambioPasswordRequest` (validador en `password_confirmacion`).
  - `ConfiguracionSistemaOut`, `ConfiguracionSistemaUpdate`, `ConfiguracionPublicaOut` y el tipo `PeriodoAcademico`.
- `app/models/configuracion_model.py`: `ConfiguracionSistema` y las constantes `CONFIGURACION_ID`, `INSCRIPCIONES_ABIERTAS_DEFECTO` y `PERIODO_ACADEMICO_DEFECTO`.
- `app/repositories/usuario_admin_repository.py`:
  - Complementa a `user_repository.py` y no hace commit por su cuenta.
  - Métodos `list_roles`, `get_rol`, `list_tipos_documento`, `get_tipo_documento`, `get`, `search` (ILIKE escapado), `email_en_uso`, `documento_en_uso`, `add`, `commit`, `rollback` y `refresh`.
- `app/repositories/configuracion_sistema_repository.py`: `get(bloquear=None | "compartido" | "exclusivo")`, `add`, `commit`, `rollback` y `refresh`.
- `app/services/usuario_service.py`: `UsuarioService` con `catalogos`, `listar`, `detalle`, `crear`, `actualizar` y `cambiar_estado` (reglas de la sección 3.3).
- `app/services/configuracion_service.py`: `perfil`, `actualizar_perfil` y `cambiar_password`.
- `app/services/configuracion_sistema_service.py`: `obtener`, `actualizar`, `estado_publico` y `periodo_para_radicar`.
- `app/dependencies/usuario_dependencies.py`: `require_gestion_usuarios`, `require_administrador`, `get_usuario_service`, `get_configuracion_service` y `get_configuracion_sistema_service`.
- `app/controllers/usuario_controller.py`: router `/admin/usuarios`. El mapa `_HTTP_STATUS` traduce las excepciones a 404, 403, 409 y 400.
- `app/controllers/configuracion_controller.py`: router `/admin/configuracion` (`/me`, `/me/password`).
- `app/controllers/configuracion_sistema_controller.py`: router `/admin/configuracion/sistema` con `require_administrador`.

**Modificados (solo adiciones):**
- `main.py`: registra `usuario_controller`, `configuracion_controller` y `configuracion_sistema_controller`.
- `app/utils/exceptions.py`: `RegistroDuplicadoError` (409) e `InscripcionesCerradasError` (403).
- `app/schemas/solicitud_schema.py`: mayúsculas en nombres y apellidos.
- `app/models/solicitud_model.py`: columna `periodo`.
- `app/models/__init__.py`: reexporta `ConfiguracionSistema`.
- `app/services/solicitud_service.py`:
  - El constructor recibe ahora `(repository, configuracion: ConfiguracionSistemaService)`.
  - Nuevo método `verificar_inscripciones_abiertas()`.
  - `radicar()` verifica que las inscripciones estén abiertas y guarda `periodo`.
- `app/dependencies/solicitud_dependencies.py`: `get_solicitud_service` arma también el servicio de configuración.
- `app/controllers/public_controller.py`: `GET /public/configuracion` y la dependencia `_inscripciones_abiertas` en el POST de solicitudes.

---

### 3.8 Frontend: archivos de la Fase 3
**Nuevos:**
- `config/roles.js`: espejo de `roles.py`.
- `components/routing/RoleRoute.jsx`: guarda por rol.
- `components/ui/AccessDenied.jsx`: "Careces de los suficientes permisos".
- `components/ui/Modal.jsx`: contenedor de modales para código nuevo.
  - Se encarga del fondo, de cerrar con Escape, de devolver el foco y de bloquear el desplazamiento de la página.
  - Props: `titleId`, `header`, `footer`, `dismissible`, `size`, `layer` y `role`.
- `components/ui/ConfirmDialog.jsx`: confirmación que se dibuja encima del modal (`z-[60]`), con tonos primary, danger y success, y estado de carga.
- `components/ui/PasswordField.jsx`: `TextField` con botón para mostrar u ocultar la contraseña, `maxLength` 72.
- `components/ui/Toggle.jsx`: interruptor accesible (`role="switch"`, `aria-checked`). Activo en `bg-pradera-600`, inactivo en `bg-slate-300`.
- `components/usuarios/UsuarioFormModal.jsx` y `components/usuarios/UsuarioBadges.jsx`.
- `components/configuracion/PerfilTab.jsx`, `SeguridadTab.jsx` y `SistemaTab.jsx`.
- `pages/UsuariosPage.jsx` y `pages/ConfiguracionPage.jsx`.
- `services/usuariosService.js`: `listUsuarios`, `getCatalogosUsuario`, `crearUsuario`, `actualizarUsuario` y `cambiarEstadoUsuario`.
- `services/configuracionService.js`: `getMiPerfil`, `actualizarMiPerfil`, `cambiarMiPassword`, `getConfiguracionSistema` y `actualizarConfiguracionSistema`.
- `utils/validators.js`: `PASSWORD_REGLAS`, `normalizarDocumento`, `limpiarEspacios`, `validarNombre`, `validarCorreo`, `validarDocumento` y `validarPassword`.

**Modificados:**
- `App.jsx`: rutas `/dashboard/usuarios` y `/dashboard/configuracion`, y `RoleRoute` para usuarios, solicitudes y documentos.
- `config/navigation.js`: `roles` por grupo o por elemento; Usuarios y Configuración habilitados; títulos y migas de pan en `ROUTE_META`.
- `context/AuthContext.jsx`: `updateUser(changes)`.
- `services/apiClient.js`: `getApiFieldErrors(error)`, que convierte los errores 422 en `{campo: mensaje}` sin el prefijo "Value error, ".
- `services/publicService.js`: `fetchConfiguracionPublica()`.
- `components/layout/UserMenu.jsx`: "Mi perfil" lleva a Configuración; el rol se muestra con su etiqueta.
- `pages/DashboardBasePage.jsx`: rol con etiqueta.
- `pages/InscripcionPage.jsx`: estado `convocatoria` y tarjeta `ConvocatoriaCerrada`.

---

### 3.9 Pruebas realizadas
- **Backend:**
  - Reglas de usuarios y de configuración probadas contra la BD real dentro de una transacción revertida (no quedaron datos).
  - Endpoints probados con un servidor temporal: 401, 403 por rol, 400, 409, 422 y 204.
  - Inscripciones cerradas: 403 incluso con el formulario incompleto. Inscripciones abiertas: la solicitud guarda `periodo`.
  - Los usuarios de prueba se borraron y la configuración quedó en `(TRUE, '2026')`.
- **Frontend:** `npm run build` sin errores y revisión de la barra lateral de cada rol. Las pantallas **no** se probaron visualmente en un navegador; las guías tienen la lista de pruebas manuales.

### 3.10 Limitaciones y pendientes conocidos
- **Contraseña:** el cambio de contraseña no pide la contraseña actual (la pantalla se definió con dos campos). Conviene agregarlo antes de producción.
- **Cambio de rol con la sesión abierta:** se refleja en el menú al recargar la página; la API lo aplica de inmediato.
- **Periodo en el BackOffice:**
  - El `periodo` de cada solicitud **todavía no se muestra** en la tabla ni en el modal de solicitudes, ni hay un filtro por periodo.
  - Las solicitudes anteriores tienen `periodo = NULL`.
- **Archivos subidos con inscripciones cerradas:** FastAPI recibe el formulario completo antes de responder 403, así que los archivos alcanzan a subirse, aunque nunca se guardan en disco.
- **Formulario abierto en otra pestaña:** no se entera de un cierre hasta que se recarga o intenta radicar.
- **Panel general:** visible para todos los roles. Si el Maestro y el Estudiante deben ver solo sus módulos, hay que cambiar su página de inicio.

---

## FASE 4 — NOTIFICACIONES POR CORREO Y RECUPERACIÓN DE CONTRASEÑA (Implementado)

Guía de despliegue: **`GUIA_LANZAMIENTO_FASE4.md`** (raíz). Script SQL: **`database/fase4_notificaciones.sql`** (solo consultas de verificación: **no hay cambios de estructura**). Esta fase **reemplaza** la restricción "no hay envío de correos" de la Fase 2.

### Reglas que se respetaron
- Sin Auth0. El login, `create_access_token`/`decode_access_token`, `auth_controller.py`, `auth_service.py`, `database.py` y los `.env` no cambiaron.
- Todo correo se envía con `BackgroundTasks` de FastAPI (después de responder). Las tareas reciben solo textos (la sesión de BD ya está cerrada) y **nunca lanzan excepciones**: un fallo de correo solo queda en el log y no deshace nada.

### Proveedor de correo (`backend/app/services/email_service.py`)
- Se elige solo según el `.env`: `RESEND_API_KEY` → Resend (`import resend` diferido); si no, `SMTP_HOST` → `smtplib` (SSL si `SMTP_USE_SSL`, si no STARTTLS); si no, **modo consola** (`[CORREO SIMULADO]` en el log con el HTML completo). En `ENVIRONMENT=production` sin proveedor no se escribe el cuerpo (lleva el enlace de recuperación): se registra un error.
- `enviar_correo(destinatario, asunto, html) -> bool`.
- 5 plantillas (`plantilla_*` → `(asunto, html)`), con tablas y estilos en línea, encabezado `pizarra-950` y franja de color según el tipo. **Todo dato de usuario pasa por `html.escape`** (la justificación conserva sus saltos de línea):
  1. `plantilla_confirmacion_aspirante(nombre, radicado, programa)`
  2. `plantilla_aviso_backoffice(nombre, radicado, programa)` → a `EMAIL_ADMIN`, con botón a `FRONTEND_URL/dashboard/solicitudes`.
  3. `plantilla_solicitud_aprobada(nombre, radicado, programa)`
  4. `plantilla_solicitud_rechazada(nombre, radicado, justificacion)`
  5. `plantilla_recuperacion_password(nombre, enlace)`
- Tareas para `BackgroundTasks`: `notificar_solicitud_radicada(correo, nombre, radicado, programa)` (aspirante + BackOffice; si `EMAIL_ADMIN` está vacío solo deja un warning), `notificar_solicitud_evaluada(correo, nombre, radicado, programa, estado, justificacion)` y `notificar_recuperacion_password(correo, nombre, enlace)`.

### Variables nuevas en `settings.py` (todas opcionales, con valor por defecto)
`RESEND_API_KEY`, `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_SSL` (False), `EMAIL_FROM` (`Casa de la Cultura <onboarding@resend.dev>`), `EMAIL_ADMIN`, `FRONTEND_URL` (`http://localhost:5173`, sin barra final) y `PASSWORD_RESET_EXPIRE_MINUTES` (15). El `.env` actual sigue funcionando sin agregarlas.

### Disparadores (en los controladores, después de guardar)
- `public_controller.radicar_solicitud`: recibe `background_tasks`; tras `service.radicar()` exitoso programa `notificar_solicitud_radicada` con los datos del `RadicadoResponse`.
- `solicitud_controller.evaluar_solicitud`: tras `service.evaluar()` exitoso programa `notificar_solicitud_evaluada` (APROBADO → aprobación; RECHAZADO → rechazo con `justificacion_respuesta`). Un 404/409 no envía nada.
- `solicitud_service.py` **no cambió**.

### Recuperación de contraseña
- **`security.py` (solo adiciones):** `PASSWORD_RESET_TOKEN_TYPE = "password_reset"`, `password_fingerprint(hash)` (sha256 del hash, 16 caracteres), `create_password_reset_token(documento, password_hash)` y `decode_password_reset_token(token)`.
  - Claims: `sub` = documento, `pwd` = huella del hash actual, `iat`, `exp` (15 min), `iss`, `type`.
  - `decode_access_token` rechaza este token por su `type` (no sirve para iniciar sesión) y viceversa.
  - **Un solo uso sin tabla:** al cambiar la contraseña cambia el hash, la huella deja de coincidir y el enlace queda inválido. También queda inválido si la contraseña se cambia por otro medio (Configuración → Seguridad o el módulo de Usuarios).
- **Nuevos:** `schemas/recuperacion_schema.py` (`ForgotPasswordRequest`, `ResetPasswordRequest` con `nueva_contrasena: Password` de `usuario_schema`, `MensajeOut`), `services/recuperacion_service.py` (`RecuperacionService.solicitar()` → `CorreoRecuperacion | None` y `restablecer()`), `dependencies/recuperacion_dependencies.py` y `controllers/recuperacion_controller.py` (router `/auth`, registrado en `main.py`).
- Busca en `tbl_usuarios` por `num_documento` (normalizado con `normalizar_documento`: "1.036.123" = "1036123") y envía al `email` de esa fila. El enlace es `FRONTEND_URL/reset-password?token=<JWT url-encoded>`.
- `restablecer()` reutiliza `UserRepository.update_password_hash()` (hace commit) y `hash_password` (passlib/bcrypt). Rechaza una contraseña igual a la actual.

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/v1/auth/forgot-password` | No | `{numero_documento}`. **Siempre 200** con `{mensaje: "Si el documento existe en el sistema, hemos enviado las instrucciones al correo asociado."}`. Solo envía correo si el usuario existe **y está activo**. 422 si el documento tiene menos de 3 caracteres. |
| POST | `/api/v1/auth/reset-password` | No | `{token, nueva_contrasena}`. 200 `{mensaje}`. 400 "El enlace de recuperación no es válido o ya expiró. Solicite uno nuevo." (vencido, alterado, ya usado, token de sesión, usuario inexistente o inactivo) o "La nueva contraseña debe ser diferente a la actual.". 422 si no cumple la política. |

### Frontend
- **Nuevos:**
  - `components/layout/AuthShell.jsx`: marco de dos columnas idéntico al del login (panel `pizarra-950` con `BrandMark` y `TopographicPattern`). `LoginPage` no se refactorizó para usarlo.
  - `pages/ForgotPasswordPage.jsx` (`/forgot-password`): solo "Número de Documento" (`validarDocumento`, se envía normalizado) y botón "Solicitar Recuperación". Al responder: toast de éxito con el mensaje genérico y tarjeta de confirmación (vence en 15 min, revisar spam).
  - `pages/ResetPasswordPage.jsx` (`/reset-password`): lee `token` con `useSearchParams`; "Nueva Contraseña" y "Confirmar Contraseña" (`PasswordField`), lista de requisitos en vivo (`PASSWORD_REGLAS`), valida coincidencia y política. Éxito → toast y `navigate('/login', {replace: true})`. Sin token o con 400 cuyo mensaje menciona "enlace" → pantalla "Enlace no válido" con "Solicitar un nuevo enlace"; otro 400 → error en el campo.
- **Modificados:**
  - `services/authService.js`: `solicitarRecuperacion(numeroDocumento)` y `restablecerPassword(token, nuevaContrasena)` (con `skipAuth` y `skipAuthRedirect`).
  - `App.jsx`: rutas `/forgot-password` y `/reset-password` **fuera** de `PublicOnlyRoute` (accesibles con o sin sesión, el enlace llega por correo).
  - `pages/LoginPage.jsx`: enlace "¿Olvidaste tu contraseña?" debajo del botón "Iniciar sesión"; el recuadro de ayuda ahora dice "¿Ya no tiene acceso al correo registrado? Solicite el restablecimiento a la coordinación…".
- No hay dependencias npm nuevas.

### Dependencias
- `backend/requirements.txt`: `resend>=2.0.0` (instalado en `.venv`: resend 2.50.0, trae `requests`). SMTP usa la librería estándar.

### Pruebas realizadas
- Backend, con servidor temporal y un usuario y una solicitud temporales (borrados al final), capturando los correos en vez de enviarlos:
  - forgot-password: documento inexistente → 200 sin correo; documento con puntos → 200 y correo al email de la BD; usuario inactivo → 200 sin correo.
  - reset-password: contraseña débil → 422; igual a la actual → 400; token alterado → 400; correcto → 200 y login con la nueva; mismo enlace otra vez → 400; token de sesión → 400.
  - Radicación (con `radicar()` simulado para no consumir consecutivo) → 201 y correo al aspirante; con `EMAIL_ADMIN` también al BackOffice.
  - Evaluar: RECHAZADO → correo con el motivo; segunda evaluación → 409 sin correo; APROBADO → correo de aprobación.
  - Escape HTML de nombres y justificación; modo consola.
- Frontend: `npm run build` sin errores. **Las pantallas no se probaron visualmente en un navegador**, ni se probó un envío real con Resend o SMTP (no hay credenciales en el `.env`).

### Limitaciones y pendientes
- `forgot-password` no tiene límite de peticiones (rate limiting): alguien podría pedir muchos correos para un mismo documento. Conviene agregarlo antes de producción.
- Las `BackgroundTasks` corren en el mismo proceso: si el servidor se reinicia justo después de responder, ese correo se pierde (no hay cola ni reintentos).
- No se guarda historial de correos enviados en la BD; solo queda en el log.
- Un enlace sigue siendo válido hasta 15 minutos aunque se pida otro nuevo (ambos funcionan hasta que se use uno).
- Sin dominio verificado, Resend solo entrega al correo dueño de la cuenta.
- Los aspirantes no tienen cuenta: la recuperación aplica solo a usuarios de `tbl_usuarios`.

---

## REGLAS DE ORO DE DESARROLLO (ESTRICTAS)

1. **NO ALTERAR LA FASE 1:** No modificar las tablas existentes en PostgreSQL (`TBL_Usuario`), la configuración en `database.py`, la autenticación JWT en `auth.py`/`security.py`, ni los archivos `.env`, ten en cuenta que ya existe uan base de datos en pgadmin el archivo es `casacultura.sql` y si se debe hacer alguna actualizacion por favor añadir un archivo con las lineas de comando para actualziar las tablas para poder continuar con el proyecto
3. **MANTENER EL ESTILO Y PALETA DE COLORES:** Todos los componentes nuevos del Frontend deben conservar las clases de Tailwind CSS y el diseño ya establecido.
4. **MANEJO ROBUSTO DE ERRORES:** Todo endpoint debe retornar respuestas legibles (`HTTP 400`, `404`, `500`) y manejar excepciones explícitas.