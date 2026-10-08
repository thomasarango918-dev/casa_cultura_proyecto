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
 *   /login      Pública. Si ya hay sesión, redirige al panel.
 *   /dashboard  Protegida. Requiere sesión y se muestra dentro de MainLayout.
 *   /           Redirige a /dashboard.
 *   *           Cualquier otra URL redirige al inicio.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/routing/ProtectedRoute'
import PublicOnlyRoute from './components/routing/PublicOnlyRoute'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import DashboardBasePage from './pages/DashboardBasePage'
import LoginPage from './pages/LoginPage'

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

            {/* Rutas protegidas dentro del marco principal. Las páginas nuevas se agregan aquí. */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<DashboardBasePage />} />
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
