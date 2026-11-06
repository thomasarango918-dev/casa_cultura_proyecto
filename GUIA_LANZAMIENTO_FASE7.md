# Guía de lanzamiento — Fase 7: Estadísticas contextuales y exportación CSV

## 1. Base de datos

**No hay script nuevo.** Esta fase solo lee datos (consultas con `GROUP BY` y `COUNT`) sobre las tablas existentes.

## 2. Backend

```bash
cd backend
.venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```

No hay dependencias nuevas de Python.

### Endpoints nuevos (prefijo `/api/v1`, JWT)

| Método | Ruta | Roles | Respuesta |
|---|---|---|---|
| GET | `/admin/estadisticas/solicitudes` | Admin, Coord | `[{estado, total}]` de `tbl_solicitudinscripcion`. Siempre trae los tres estados en orden APROBADO, PENDIENTE, RECHAZADO, aunque alguno esté en 0. |
| GET | `/admin/estadisticas/categorias` | Admin, Coord | `[{categoria_id, categoria, activa, total, programas: [{programa_id, programa, total}]}]`: todas las categorías y **todos** sus programas con los aprobados de cada uno (`tbl_programas` ⟕ `tbl_solicitudinscripcion` con `estado = 'APROBADO'`). Los programas y categorías nuevos aparecen en 0. Los programas sin categoría salen en "Sin categoría" (`categoria_id: null`). |
| GET | `/admin/estadisticas/maestros` | Admin, Coord, Maestro | `[{id, nombre_completo, activo}]`. Administrador y Coordinador reciben todos los usuarios con rol Maestro/Profesor; el Maestro, solo a sí mismo. |
| GET | `/admin/estadisticas/ocupacion-grupos?maestro_id=N` | Admin, Coord, Maestro | `[{grupo_id, grupo, programa, total}]`: grupos de los programas asignados al maestro (`tbl_programa_maestro`, la misma regla del módulo de grupos) ⟕ `tbl_grupo_estudiante` (solo `activo = TRUE`). Incluye los grupos vacíos. `maestro_id` es obligatorio (422 si falta). |

- Sin token, **401**. Estudiante, **403** en todo; Maestro, **403** en `solicitudes` y `categorias`.
- Un Maestro que pide `ocupacion-grupos` con otro `maestro_id` recibe **403** ("Solo puede consultar las estadísticas de sus propios grupos."). Un `maestro_id` que no es maestro recibe **404**.
- Un grupo cuyo programa tiene dos maestros cuenta para los dos.
- Los filtros (`estado = 'APROBADO'`, `activo = TRUE`) van en el `ON` del `LEFT JOIN`, para que las categorías y los grupos sin estudiantes aparezcan con 0.

**Archivos nuevos:** `schemas/estadistica_schema.py`, `repositories/estadistica_repository.py`, `services/estadistica_service.py`, `dependencies/estadistica_dependencies.py`, `controllers/estadistica_controller.py`.
**Modificados:** `config/roles.py` (`ROLES_ESTADISTICAS`, `ROLES_ESTADISTICAS_GRUPOS`) y `main.py` (registro del router).

## 3. Frontend

```bash
cd frontend
npm install      # agrega recharts
npm run dev
```

| Vista | Botón "Estadísticas" | Gráfico |
|---|---|---|
| `/dashboard` (Panel general) | Junto a la etiqueta del rol | Dona: verde = Aprobado, ámbar = Pendiente, rojo = Rechazado. El total va en el centro. |
| `/dashboard/programas` | Junto a "Actualizar" / "Crear Categoría" | **Columnas apiladas**: cada columna es una categoría y se divide en un segmento por programa con sus estudiantes aprobados. El total va encima de la columna. Debajo hay una leyenda por categoría y el tooltip muestra el desglose de todos los programas (también los que están en 0). |
| `/dashboard/grupos` | Junto a "Horario Semanal" | Primero se elige un **maestro** en la lista desplegable; después aparecen las barras horizontales (`layout="vertical"`) con los estudiantes activos de cada grupo que maneja. El programa sale en el tooltip. |

- **RBAC:**
  - Panel general y Programas: los botones y modales solo se renderizan para Administrador y Coordinador (`ROLES_ESTADISTICAS` en `config/roles.js`).
  - Grupos (`ROLES_ESTADISTICAS_GRUPOS`): Administrador y Coordinador eligen cualquier maestro (los inactivos se marcan "(inactivo)"). El Maestro también ve el botón, pero la lista solo lo trae a él, ya seleccionado y bloqueado.
- **Colores de las columnas apiladas:** paleta categórica de 8 colores, validada. Cada programa toma el color de su posición alfabética dentro de su categoría, así que el mismo color se repite en columnas distintas. Por eso la identificación la dan la leyenda por categoría, el tooltip y la tabla. Si una categoría llegara a tener más de 8 programas, los colores se repiten dentro de la columna.
- **Tabla/CSV de Programas:** una fila por programa (Categoría, Programa, Estudiantes aprobados, % de la categoría). Una categoría sin programas aparece como "Sin programas registrados" y una inhabilitada, con "(inhabilitada)".
- **Tabla/CSV de Grupos:** incluye la columna Maestro. El archivo se llama `estadisticas-ocupacion-<maestro>-AAAA-MM-DD.csv`.
- **`<EstadisticaModal />`** (`components/estadisticas/EstadisticaModal.jsx`) es el componente base. Recibe `isOpen`, `onClose`, `titulo`, `children` (el gráfico), `data` (filas de la tabla) y `onExport`. Muestra el gráfico, luego la tabla HTML con los datos exactos y, abajo, "Exportar a CSV". Tiene estado de carga, de error (con "Reintentar") y vacío (si el total es 0, el botón de exportar se deshabilita).
- **La tabla y el CSV salen de las mismas filas:** lo que se ve es lo que se descarga.
- **`exportToCsv(filename, rows)`** (`utils/exportUtils.js`), con JavaScript nativo:
  - Las cabeceras son las claves del primer objeto. El archivo empieza con el BOM `﻿`, va separado por comas y usa fin de línea `\r\n`.
  - Escapa comillas, comas y saltos de línea.
  - Antepone `'` a los textos que empiezan por `= + - @`, para que Excel no los ejecute como fórmula.
  - Descarga con un `<a>` temporal, `Blob` y `URL.createObjectURL`. Nombre: `estadisticas-<tema>-AAAA-MM-DD.csv`.
- **Rendimiento:** los tres modales se cargan con `React.lazy`, así que Recharts solo se descarga la primera vez que se abre un modal de estadísticas.

## 4. Pruebas manuales sugeridas

1. Como Administrador, en el Panel general → Estadísticas: la dona, la leyenda y la tabla deben coincidir con las tarjetas de indicadores. Exportar y abrir en Excel: las tildes deben verse bien.
2. En Programas → Estadísticas: cada columna suma sus segmentos y la tabla lista todos los programas. Crear un programa nuevo y volver a abrir el modal: aparece en la tabla con 0. Al aprobar una solicitud de ese programa, aparece su segmento.
3. En Grupos → Estadísticas (Administrador): sin elegir maestro no hay gráfico. Al elegir uno, solo aparecen los grupos de sus programas. Un grupo sin estudiantes aparece con barra vacía. Crear un usuario Maestro: aparece en la lista.
4. Como Maestro: en Grupos → Estadísticas solo se ve él mismo, bloqueado. No aparece el botón en el Panel general. `GET /admin/estadisticas/ocupacion-grupos?maestro_id=<otro>` desde `/docs` → **403**.
5. Con el backend apagado, abrir un modal: debe mostrar el error y el botón "Reintentar".

## 5. Limitaciones conocidas

- **Excel en español:** el CSV usa coma, como pide la especificación. En un Excel configurado con `;` como separador de lista (habitual en Colombia), abrirlo con doble clic lo deja en una sola columna. En ese caso use Datos → Desde texto/CSV, o cambie `SEPARADOR` en `exportUtils.js`.
- Las estadísticas son del momento de abrir el modal: no se filtran por periodo académico ni por rango de fechas.
