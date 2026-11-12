# Guía de lanzamiento — Fase 8: PWA y asistencias sin conexión

## 1. Base de datos

**No hay script nuevo.** El UPSERT usa el índice único `(grupo_id, solicitud_id, fecha_clase)` de `tbl_asistencia_estudiante`, que ya creó `database/fase6_asistencias.sql`. Si ese script ya se ejecutó, no hay nada que hacer.

Para comprobar que el índice existe:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'tbl_asistencia_estudiante' AND indexdef ILIKE '%UNIQUE%';
```

## 2. Backend

1. Detenga el servidor (Ctrl+C en la terminal de Uvicorn).
2. Vuelva a iniciarlo:

```bash
cd backend
.venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```

No hay dependencias nuevas de Python ni cambios en `.env`.

### Cambio en `POST /api/v1/admin/asistencias/grupo/{grupo_id}`

| Campo nuevo | Tipo | Descripción |
|---|---|---|
| `sincronizacion_offline` (entrada) | bool, por defecto `false` | Lo envía `true` el motor de sincronización del frontend. |
| `omitidos` (respuesta) | int | Estudiantes de una toma offline que ya no estaban en el grupo y no se guardaron. |

- **Sin el campo (o en `false`):** todo sigue igual que en la Fase 6. Solo se acepta la fecha de hoy y un estudiante que ya no está en el grupo da 400.
- **Con `true`:**
  - Se acepta una fecha pasada de hasta **7 días** (`DIAS_SINCRONIZACION_OFFLINE`), siempre que ese día haya sido una sesión real del grupo (según su horario, sin festivos y después de su creación). Si no, responde 400.
  - Una fecha futura o de hace más de 7 días también da 400.
  - Los estudiantes que ya no pertenecen al grupo se omiten y la respuesta los cuenta en `omitidos`.
- **Idempotencia:** el guardado es un UPSERT (`INSERT … ON CONFLICT (grupo_id, solicitud_id, fecha_clase) DO UPDATE SET estado = EXCLUDED.estado, modificado_por = EXCLUDED.modificado_por, fecha_modificacion = now()`). Si la misma toma llega dos veces (reintento, dos pestañas o doble clic), no se duplican filas.

**Archivos modificados:** `schemas/asistencia_schema.py`, `services/asistencia_service.py` y `repositories/asistencia_repository.py` (solo documentación; el UPSERT ya existía).

## 3. Frontend

### 3.1 Instalar dependencias

Detenga `npm run dev` (Ctrl+C) y ejecute:

```bash
cd frontend
npm install
```

`package.json` ya incluye `idb` (dependencia) y `vite-plugin-pwa` (dependencia de desarrollo). Si se instalan a mano, el comando es `npm install idb` y `npm install -D vite-plugin-pwa`.

### 3.2 Desarrollo normal

```bash
npm run dev
```

En `npm run dev` **no hay service worker** (`devOptions.enabled: false`), así que no hay caché que estorbe mientras se programa. Aun así, en desarrollo funcionan:

- el indicador Online/Offline,
- el bloqueo de botones,
- la cola en IndexedDB,
- la sincronización automática.

Para simularlo: DevTools → pestaña **Network** → lista "No throttling" → **Offline**.

### 3.3 Probar la PWA (versión compilada)

El service worker solo existe en la versión compilada. El backend solo acepta peticiones (CORS) desde el puerto 5173, así que se sirve el build en ese puerto y no hay que tocar el `.env`:

```bash
# 1. Detener npm run dev (libera el puerto 5173)
cd frontend
npm run build
npm run preview -- --port 5173 --strictPort
```

1. Abra `http://localhost:5173` e inicie sesión. Chrome muestra el ícono **Instalar** en la barra de direcciones.
2. En DevTools → **Application**, revise lo siguiente:
   - **Manifest:** debe aparecer "Casa de la Cultura" con sus íconos.
   - **Service workers:** `sw.js` debe figurar como *activated and running*.
   - **Storage → IndexedDB:** `CasaCulturaDB`, con los stores `pending_attendances` y `cached_snapshots`.
3. Abra **Asistencia** con conexión. Así se guardan en el equipo el listado de grupos y la matriz de cada grupo con clase hoy.
4. Active **Offline** (DevTools → Network) y recargue la página. La aplicación debe abrir igual, con la sesión intacta.

> **Importante al volver a `npm run dev`:** el service worker del build queda registrado en `localhost:5173` y seguiría sirviendo la versión compilada. Antes de volver a desarrollar:
>
> 1. Confirme que la cola esté vacía: el contador de la nube no debe aparecer.
> 2. Vaya a DevTools → Application → Service workers → **Unregister**.
> 3. Recargue con Ctrl+Shift+R.
>
> No use "Clear site data" si hay asistencias pendientes: también borra IndexedDB y con él la cola.

**Alternativa:** servir el build en su puerto propio (`npm run preview`, puerto 4173). Para eso hay que agregar `"http://localhost:4173"` a `CORS_ORIGINS` en `backend/.env` y reiniciar el backend. Solo hágalo si el equipo lo aprueba: el `.env` es un archivo protegido de la Fase 1.

### 3.4 Producción

- El service worker exige **HTTPS**. La única excepción es `localhost`.
- Sirva `dist/` con *fallback* a `index.html` para las rutas del SPA.
- Configure `Cache-Control: no-cache` para `sw.js`, `registerSW.js`, `manifest.webmanifest` e `index.html`. Así cada versión nueva se detecta enseguida (`registerType: 'autoUpdate'`).
- Agregue el dominio del frontend a `CORS_ORIGINS` del backend de producción.

## 4. Qué hace cada pieza

| Pieza | Archivo | Comportamiento |
|---|---|---|
| PWA | `vite.config.js`, `public/pwa-*.png`, `public/apple-touch-icon.png` | Manifiesto "Casa de la Cultura" (`start_url /dashboard`, `standalone`). Workbox precarga JS, CSS, HTML, fuentes e íconos, y `navigateFallback` responde con `index.html` (salvo `/api/`). **La API no se guarda en la caché del service worker.** |
| Sesión resistente | `services/apiClient.js` | La sesión solo se cierra con un HTTP **401** real. Network Error, timeout o cancelación no borran el token. `isOffline()` e `isNetworkError()` son auxiliares nuevos, y `getApiErrorMessage` explica que no hay conexión. |
| Indicador de red | `hooks/useOnlineStatus.js`, `components/layout/NetworkStatus.jsx`, `Topbar.jsx` | Círculo verde + "Online" o círculo rojo + "Offline". El tooltip muestra cuántas asistencias faltan por sincronizar. |
| Bloqueo global | `context/OfflineBlockContext.jsx`, `MainLayout.jsx`, `ui/Button.jsx`, `ui/ConfirmDialog.jsx` | Sin red, y en cualquier ruta que no sea `/dashboard/asistencias`, se deshabilitan los `Button type="submit"`, los botones marcados con `requiresNetwork` ("Asignar Seleccionados", "Guardar Cambios" de categorías), el botón de confirmar de todo `ConfirmDialog` (deshabilitar, eliminar, desasignar) y "Aprobar"/"Rechazar" de solicitudes. Además aparece un aviso rojo bajo el encabezado. Fuera de `MainLayout` (login, inscripción pública) no se bloquea nada. |
| Cola local | `utils/offlineSync.js` | IndexedDB `CasaCulturaDB` v1 con `idb`. Store `pending_attendances` (clave `usuario:grupo:fecha`; volver a guardar la misma fecha reemplaza la entrada). Funciones: `saveToQueue`, `getQueue`, `removeFromQueue`, `getQueueCount` y `getQueueItem`. Store `cached_snapshots` (copias del listado y de las matrices): `saveSnapshot`, `getSnapshot` y `clearSnapshots`. Cada cambio emite `QUEUE_CHANGED_EVENT`. |
| Asistencia offline | `pages/AsistenciasPage.jsx`, `components/asistencias/MatrizAsistencia.jsx` | Sin red, "Guardar Asistencia de Hoy" guarda en la cola y muestra el toast **"Sin conexión: Guardado localmente"**. Lo mismo ocurre si hay red pero la API no responde. Mientras haya pendientes aparece una **nube** con el contador junto al botón. Sin red, la vista se arma con la copia local. |
| Auto-sync | `hooks/useOfflineSync.js` (montado en `MainLayout`) | Envía la cola del usuario al montar, al volver la red (`online`), al volver a la pestaña y cada 60 s. Si la API responde 200, quita la entrada y muestra **"Asistencias offline sincronizadas con éxito"** (toast corto). Ante un error de red, 5xx o 401, conserva la entrada. Ante 400/403/404/422, la quita y avisa del motivo. |

## 5. Pruebas manuales sugeridas

1. **Indicador:** con DevTools en Offline, el encabezado cambia a rojo "Offline" y aparece el aviso. Al volver la red, cambia a verde "Online".
2. **Bloqueo global:** sin red, verifique estos botones:
   - Usuarios: "Crear Usuario" abre el modal, pero su botón de guardar queda deshabilitado (tooltip "Sin conexión: esta acción requiere internet.").
   - Programas, Grupos y Configuración (Mi Perfil, Seguridad, Sistema): los botones de guardar quedan deshabilitados.
   - Las confirmaciones de deshabilitar o eliminar: el botón de confirmar queda deshabilitado.
   - En Asistencia, "Guardar Asistencia de Hoy" sigue habilitado.
3. **Sesión:** sin red, recargue `/dashboard` (en el build) o navegue entre vistas. La sesión no se cierra.
4. **Guardar offline:**
   1. Abra un grupo con clase hoy (con red) y pase a Offline.
   2. Marque asistencias y pulse Guardar. Debe aparecer el toast "Sin conexión: Guardado localmente", la nube con "1" y el subtítulo "guardada en este equipo, pendiente de sincronizar".
   3. En Application → IndexedDB → `pending_attendances` debe estar la entrada.
5. **Auto-sync:** vuelva a Online. Debe aparecer el toast "Asistencias offline sincronizadas con éxito", desaparecer la nube y recargarse la matriz con los datos del servidor. Compruébelo en la BD:
   ```sql
   SELECT * FROM tbl_asistencia_estudiante ORDER BY fecha_modificacion DESC LIMIT 10;
   ```
6. **Idempotencia:** guarde la misma toma offline dos veces y sincronice. El conteo de filas de ese grupo y fecha no cambia.
7. **Copia de otro día:** con una matriz guardada ayer y sin red hoy, la vista muestra la copia como solo lectura. El aviso dice que no se puede tomar la asistencia sin conexión porque la copia no es de hoy.
8. **Cerrar sesión:** `cached_snapshots` queda vacío y `pending_attendances` se conserva. Al volver a entrar el mismo usuario, se sincroniza.

## 6. Limitaciones conocidas

- **Hay que abrir la app con red el día de clase.** Para tomar asistencia sin conexión, el equipo debe tener la matriz de **hoy**, que se descarga al abrir el listado de Asistencia o el grupo con red. Sin esa copia no se puede saber, sin conexión, si hoy hay clase ni quiénes están en el grupo.
- **Plazo de 7 días.** Una toma offline se puede sincronizar hasta 7 días después. Pasado ese plazo, la API la rechaza (400), la entrada se quita de la cola y se muestra un aviso con el motivo.
- **Gana la última escritura.** Si otro usuario guarda en línea la misma fecha antes de que llegue la sincronización, la toma offline la sobrescribe (no hay detección de conflictos).
- **Por usuario.** La cola es por usuario y por navegador: solo la sincroniza quien la guardó, con su propio token. Si el token vence sin red, la entrada espera hasta el siguiente inicio de sesión de ese usuario.
- **Bloqueo selectivo.** Solo se bloquean los botones de envío, los marcados con `requiresNetwork` y las confirmaciones. Los botones que solo abren modales siguen activos; lo que se bloquea es su acción final.
- **`navigator.onLine` no es infalible.** Puede decir "online" sin internet real. Por eso un error de red al guardar también pasa la toma a la cola, y el motor reintenta cada 60 s.
- **Verificación pendiente.** No se probó visualmente en un navegador la instalación de la PWA ni el modo offline. La lógica se probó de forma automatizada (ver `CLAUDE.md`).
