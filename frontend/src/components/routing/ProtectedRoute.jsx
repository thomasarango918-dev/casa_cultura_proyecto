/**
 * Guarda de rutas protegidas.
 *
 *   - Mientras se valida la sesión: muestra la pantalla de carga.
 *   - Sin sesión: redirige a /login y recuerda la página solicitada (state.from)
 *     para volver a ella después de iniciar sesión.
 *   - Con sesión: renderiza la ruta hija mediante <Outlet />.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ScreenLoader from '../ui/ScreenLoader'

export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <ScreenLoader message="Verificando su sesión…" />
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
