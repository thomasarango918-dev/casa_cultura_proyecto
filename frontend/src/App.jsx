/**
 * Componente raíz: proveedores globales y tabla de rutas.
 *
 * Orden de los proveedores (de afuera hacia adentro):
 *   1. BrowserRouter: habilita la navegación por URL.
 *   2. ToastProvider: notificaciones flotantes disponibles en toda la app.
 *   3. AuthProvider:  estado de la sesión. Va dentro de ToastProvider porque
 *                     muestra avisos (por ejemplo, "Su sesión expiró").
 *
 * Rutas:
 *   /login                  Pública. Si ya hay sesión, redirige al panel.
 *   /inscripcion            Pública y aislada: formulario de inscripción sin sesión ni MainLayout.
 *   /forgot-password        Pública (Fase 4): pide el enlace de recuperación de contraseña.
 *   /reset-password         Pública (Fase 4): nueva contraseña con el token del enlace (?token=...).
 *   /dashboard              Protegida. Requiere sesión y se muestra dentro de MainLayout.
 *   /dashboard/solicitudes  Protegida. Gestión de solicitudes radicadas.
 *   /dashboard/documentos   Protegida. Inventario de documentos (búsqueda por documento o radicado).
 *   /dashboard/usuarios     Protegida. Usuarios y roles (Administrador y Coordinador).
 *   /dashboard/configuracion Protegida. Configuración de la cuenta (todos los roles).
 *
 * Las rutas restringidas por rol van dentro de RoleRoute: si el rol no está permitido
 * se muestra "Careces de los suficientes permisos" sin montar la página ni llamar a la API.
 *   /                       Redirige a /dashboard.
 *   *                       Cualquier otra URL redirige al inicio.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'
import RoleRoute from './components/routing/RoleRoute'
import { ROL, ROLES_GESTION_USUARIOS } from './config/roles'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ConfiguracionPage from './pages/ConfiguracionPage'
import DashboardBasePage from './pages/DashboardBasePage'
import DocumentosPage from './pages/DocumentosPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import InscripcionPage from './pages/InscripcionPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SolicitudesPage from './pages/SolicitudesPage'
import UsuariosPage from './pages/UsuariosPage'

/** Roles del BackOffice de radicación (BACKOFFICE_ROLES en config/navigation.js). */
const ROLES_RADICACION = [ROL.ADMINISTRADOR, ROL.COORDINADOR]

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* Formulario público: accesible con o sin sesión, fuera del marco del BackOffice. */}
            <Route path="/inscripcion" element={<InscripcionPage />} />

            {/* Fase 4: recuperación de contraseña. Accesibles con o sin sesión (el enlace llega por correo). */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Rutas protegidas dentro del marco principal. Las páginas nuevas se agregan aquí. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<DashboardBasePage />} />
                <Route path="/dashboard/configuracion" element={<ConfiguracionPage />} />
                <Route element={<RoleRoute roles={ROLES_RADICACION} />}>
                  <Route path="/dashboard/solicitudes" element={<SolicitudesPage />} />
                  <Route path="/dashboard/documentos" element={<DocumentosPage />} />
                </Route>
                <Route element={<RoleRoute roles={ROLES_GESTION_USUARIOS} />}>
                  <Route path="/dashboard/usuarios" element={<UsuariosPage />} />
                </Route>
              </Route>
            </Route>

            {/* Redirecciones */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
