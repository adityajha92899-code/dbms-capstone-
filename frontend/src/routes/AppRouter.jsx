import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { ROLE_HOME } from '../lib/constants';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../pages/auth/LoginPage';
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { FleetPage } from '../pages/admin/FleetPage';
import { DriversPage } from '../pages/admin/DriversPage';
import { RoutesPage } from '../pages/admin/RoutesPage';
import { TripsPage } from '../pages/admin/TripsPage';
import { TripDetailPage } from '../pages/admin/TripDetailPage';
import { BookingsPage } from '../pages/admin/BookingsPage';
import { ReportsPage } from '../pages/admin/ReportsPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { AuditPage } from '../pages/admin/AuditPage';
import { SettingsPage } from '../pages/admin/SettingsPage';
import { DriverDashboard } from '../pages/driver/DriverDashboard';
import { MyTripsPage } from '../pages/driver/MyTripsPage';
import { CustomerDashboard } from '../pages/customer/CustomerDashboard';
import { NewBookingPage } from '../pages/customer/NewBookingPage';
import { BookingDetailPage } from '../pages/customer/BookingDetailPage';
import { ProfilePage } from '../pages/shared/ProfilePage';
import { NotFoundPage, ForbiddenPage, ServerErrorPage } from '../pages/ErrorPages';

function RoleRedirect() {
  const { isAuthenticated, role } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={ROLE_HOME[role] || '/login'} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/500" element={<ServerErrorPage />} />
      <Route path="/" element={<RoleRedirect />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<RoleRoute allowedRoles={['admin', 'dispatcher']} />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/trips" element={<TripsPage />} />
            <Route path="/admin/trips/:id" element={<TripDetailPage />} />
            <Route path="/admin/bookings" element={<BookingsPage />} />
            <Route path="/admin/fleet" element={<FleetPage />} />
            <Route path="/admin/drivers" element={<DriversPage />} />
            <Route path="/admin/routes" element={<RoutesPage />} />
            <Route path="/admin/reports" element={<ReportsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/audit" element={<AuditPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={['driver']} />}>
            <Route path="/driver" element={<Navigate to="/driver/dashboard" replace />} />
            <Route path="/driver/dashboard" element={<DriverDashboard />} />
            <Route path="/driver/trips" element={<MyTripsPage />} />
            <Route path="/driver/profile" element={<ProfilePage title="Driver Profile" />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={['customer']} />}>
            <Route path="/customer" element={<Navigate to="/customer/dashboard" replace />} />
            <Route path="/customer/dashboard" element={<CustomerDashboard />} />
            <Route path="/customer/bookings" element={<CustomerDashboard />} />
            <Route path="/customer/bookings/new" element={<NewBookingPage />} />
            <Route path="/customer/bookings/:id" element={<BookingDetailPage />} />
            <Route path="/customer/track" element={<CustomerDashboard />} />
            <Route path="/customer/profile" element={<ProfilePage title="Customer Profile" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
