import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const { role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useSocket('alert:maintenance', (alert) => {
    setUnreadCount((c) => c + 1);
    toast.warning(alert?.message || 'Vehicle maintenance alert');
  });

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        role={role}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          onOpenMobile={() => setMobileOpen(true)}
          unreadCount={unreadCount}
        />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
