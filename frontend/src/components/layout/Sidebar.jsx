import { NavLink } from 'react-router-dom';
import {
  Truck,
  LayoutDashboard,
  Route as RouteIcon,
  Package,
  Users,
  ShieldCheck,
  BarChart3,
  Settings,
  MapPin,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  Navigation,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_BY_ROLE = {
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, end: true },
    { label: 'Trips', to: '/admin/trips', icon: Navigation },
    { label: 'Bookings', to: '/admin/bookings', icon: Package },
    { label: 'Fleet', to: '/admin/fleet', icon: Truck },
    { label: 'Drivers', to: '/admin/drivers', icon: Users },
    { label: 'Routes', to: '/admin/routes', icon: RouteIcon },
    { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
    { label: 'Users', to: '/admin/users', icon: UserCircle },
    { label: 'Audit', to: '/admin/audit', icon: ShieldCheck },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
  ],
  dispatcher: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, end: true },
    { label: 'Trips', to: '/admin/trips', icon: Navigation },
    { label: 'Bookings', to: '/admin/bookings', icon: Package },
    { label: 'Fleet', to: '/admin/fleet', icon: Truck },
    { label: 'Drivers', to: '/admin/drivers', icon: Users },
    { label: 'Routes', to: '/admin/routes', icon: RouteIcon },
  ],
  driver: [
    { label: 'Dashboard', to: '/driver/dashboard', icon: LayoutDashboard, end: true },
    { label: 'My Trips', to: '/driver/trips', icon: Navigation },
    { label: 'Profile', to: '/driver/profile', icon: UserCircle },
  ],
  customer: [
    { label: 'Dashboard', to: '/customer/dashboard', icon: LayoutDashboard, end: true },
    { label: 'My Bookings', to: '/customer/bookings', icon: Package },
    { label: 'Track', to: '/customer/track', icon: MapPin },
    { label: 'Profile', to: '/customer/profile', icon: UserCircle },
  ],
};

export function Sidebar({ role, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.customer;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-obsidian-900/50 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-obsidian-900 text-white transition-all duration-300 lg:static',
          collapsed ? 'w-[72px]' : 'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-obsidian-800 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-obsidian-900">
              <Truck className="h-5 w-5" />
            </div>
            {!collapsed && (
              <span className="truncate text-lg font-bold tracking-tight">FleetFlow</span>
            )}
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden rounded-lg p-1.5 text-obsidian-400 hover:bg-obsidian-800 hover:text-white lg:inline-flex"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-l-4 border-accent bg-accent/10 text-accent'
                      : 'text-obsidian-300 hover:bg-obsidian-800 hover:text-white'
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
