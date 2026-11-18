import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export function RoleRoute({ allowedRoles = [] }) {
  const role = useAuthStore((s) => s.role);
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/403" replace />;
  }
  return <Outlet />;
}
