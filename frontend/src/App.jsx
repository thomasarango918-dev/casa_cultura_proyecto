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
 *   /dashboard              Protegida. Requiere sesión y se muestra dentro de MainLayout.
 *   /dashboard/solicitudes  Protegida. Gestión de solicitudes radicadas.
 *   /dashboard/documentos   Protegida. Inventario de documentos (búsqueda por documento o radicado).
 *   /                       Redirige a /dashboard.
 *   *                       Cualquier otra URL redirige al inicio.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import DashboardBasePage from './pages/DashboardBasePage'
import DocumentosPage from './pages/DocumentosPage'
import InscripcionPage from './pages/InscripcionPage'
import LoginPage from './pages/LoginPage'
import SolicitudesPage from './pages/SolicitudesPage'

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

            {/* Rutas protegidas dentro del marco principal. Las páginas nuevas se agregan aquí. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<DashboardBasePage />} />
                <Route path="/dashboard/solicitudes" element={<SolicitudesPage />} />
                <Route path="/dashboard/documentos" element={<DocumentosPage />} />
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
