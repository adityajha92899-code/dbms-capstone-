import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Menu, Search, Bell, LogOut, User, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { Dialog, DialogContent } from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

export function Topbar({ onOpenMobile }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumb = segments.length ? segments.join(' / ') : 'home';

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/notifications');
      return data;
    },
  });

  const notifications = notifData?.data || [];
  const unreadCount = notifData?.unreadCount || 0;

  useSocket('notification:new', (notif) => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast.info(notif?.message || 'New notification');
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.patch('/api/v1/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Notifications marked as read');
    },
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/v1/search', { params: { q: searchQuery } });
        setSearchResults(data);
      } catch (_err) {
        setSearchResults(null);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-obsidian-200 bg-white/80 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="rounded-lg p-2 text-obsidian-600 hover:bg-obsidian-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-sm font-medium capitalize text-obsidian-600">
            {breadcrumb}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-obsidian-200 bg-obsidian-50 px-3 py-1.5 text-xs text-obsidian-500 hover:border-accent sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
            <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-obsidian-500 shadow-sm">
              ⌘K
            </kbd>
          </button>

          {/* Notifications Bell Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative rounded-lg p-2 text-obsidian-600 hover:bg-obsidian-100"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-xs font-semibold text-obsidian-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead.mutate()}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-hover hover:underline"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-obsidian-400">
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 5).map((n) => (
                  <DropdownMenuItem
                    key={n.notif_id}
                    className={`flex-col items-start gap-0.5 ${!n.read ? 'bg-amber-50/50' : ''}`}
                    onClick={() => api.patch(`/api/v1/notifications/${n.notif_id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))}
                  >
                    <span className="text-xs font-medium text-obsidian-800">{n.message}</span>
                    <span className="text-[10px] text-obsidian-400">{n.type}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-obsidian-100"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-obsidian-900 text-xs font-semibold text-accent">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="hidden text-left md:block">
                  <p className="text-xs font-semibold text-obsidian-900">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-[11px] capitalize text-obsidian-500">
                    {user?.role || 'guest'}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  navigate(
                    user?.role === 'admin' || user?.role === 'dispatcher'
                      ? '/admin/settings'
                      : `/${user?.role || 'customer'}/profile`
                  )
                }
              >
                <User className="h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-status-danger">
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Global Search Command Palette */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent title="Global Search" description="Search trips, vehicles, drivers, and bookings.">
          <div className="space-y-3">
            <input
              autoFocus
              className="input"
              placeholder="Type trip#, reg#, driver name, or booking#..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchResults && (
              <div className="max-h-72 space-y-3 overflow-y-auto text-xs">
                {searchResults.trips?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold uppercase text-obsidian-400">Trips</p>
                    {searchResults.trips.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate(`/admin/trips/${t.id}`);
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left hover:bg-obsidian-100"
                      >
                        <span className="font-mono font-semibold">{t.trip_number}</span> ({t.status})
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.vehicles?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold uppercase text-obsidian-400">Vehicles</p>
                    {searchResults.vehicles.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate('/admin/fleet');
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left hover:bg-obsidian-100"
                      >
                        <span className="font-mono font-semibold">{v.reg_number}</span> — {v.make} {v.model}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.drivers?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold uppercase text-obsidian-400">Drivers</p>
                    {searchResults.drivers.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate('/admin/drivers');
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left hover:bg-obsidian-100"
                      >
                        {d.full_name} ({d.license_number})
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.bookings?.length > 0 && (
                  <div>
                    <p className="mb-1 font-semibold uppercase text-obsidian-400">Bookings</p>
                    {searchResults.bookings.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          navigate('/admin/bookings');
                        }}
                        className="block w-full rounded px-2 py-1.5 text-left hover:bg-obsidian-100"
                      >
                        <span className="font-mono font-semibold">{b.booking_reference}</span>: {b.origin} → {b.destination}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
