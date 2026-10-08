/**
 * Guarda de rutas solo públicas (por ejemplo, el login).
 *
 * Si el usuario ya tiene sesión, no tiene sentido mostrarle el login: se le
 * redirige a la página que intentaba abrir o, por defecto, al panel general.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import ScreenLoader from '../ui/ScreenLoader'

export default function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'checking') return <ScreenLoader message="Verificando su sesión…" />
  if (status === 'authenticated') {
    // ProtectedRoute guarda en state.from la página que el usuario quería abrir.
    const destination = location.state?.from?.pathname ?? '/dashboard'
    return <Navigate to={destination === '/login' ? '/dashboard' : destination} replace />
  }
  return <Outlet />
}
