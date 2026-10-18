/**
 * Guarda de rutas por rol (RBAC).
 *
 * Va dentro de ProtectedRoute (la sesión ya está validada). Si el rol del usuario
 * no está en `roles`, NO monta la página —por lo tanto no se hace ninguna petición
 * a la API— y muestra la vista "Careces de los suficientes permisos" dentro del
 * marco del BackOffice. Así, escribir la URL a mano nunca muestra un 403 crudo.
 *
 * Uso en App.jsx:
 *   <Route element={<RoleRoute roles={ROLES_GESTION_USUARIOS} />}>
 *     <Route path="/dashboard/usuarios" element={<UsuariosPage />} />
 *   </Route>
 *
 * @param {object} props
 * @param {string[]} props.roles Claves de rol permitidas (config/roles.js).
 */
import { Outlet } from 'react-router-dom'
import AccessDenied from '../ui/AccessDenied'
import { tieneRol } from '../../config/roles'
import { useAuth } from '../../context/AuthContext'

export default function RoleRoute({ roles }) {
  const { user } = useAuth()
  return tieneRol(user?.rol, roles) ? <Outlet /> : <AccessDenied />
}
