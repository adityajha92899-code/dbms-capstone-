import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Users } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';

export function DriversPage() {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [suspendTarget, setSuspendTarget] = useState(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: 'Driver@123',
    phone: '',
    license_number: '',
    license_class: 'CDL-A',
    license_expiry: '2029-12-31',
  });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/drivers', { params: { limit: 50 } });
      return data.data || [];
    },
  });

  const { data: driverDetail } = useQuery({
    queryKey: ['driver-detail', selectedDriver?.id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/drivers/${selectedDriver.id}`);
      return data;
    },
    enabled: Boolean(selectedDriver?.id),
  });

  const { data: driverPerf } = useQuery({
    queryKey: ['driver-perf', selectedDriver?.id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/drivers/${selectedDriver.id}/performance`);
      return data;
    },
    enabled: Boolean(selectedDriver?.id),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/drivers', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Driver created');
      setNewOpen(false);
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create driver'),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/api/v1/drivers/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      toast.success('Driver status updated');
      setSuspendTarget(null);
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update status'),
  });

  const initials = (name = '') =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Manage driver roster, licenses, availability, and performance."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>New Driver</span>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
          <SkeletonLoader variant="card" />
        </div>
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No drivers found"
          description="Add a driver to start assigning trips."
          actionLabel="New Driver"
          onAction={() => setNewOpen(true)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drivers.map((d) => (
            <div key={d.id} className="card flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-obsidian-900 text-sm font-bold text-accent">
                    {initials(d.full_name)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-obsidian-900">{d.full_name}</h3>
                    <p className="font-mono text-xs text-obsidian-500">{d.license_number}</p>
                  </div>
                </div>
                <StatusBadge status={d.status} />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="badge bg-obsidian-100 text-obsidian-700">{d.license_class}</span>
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {d.rating}
                </span>
                <span className="text-obsidian-500">
                  {d.active_trips_count > 0 ? `${d.active_trips_count} active trips` : 'Available'}
                </span>
              </div>

              <div className="flex items-center gap-2 border-t border-obsidian-100 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setSelectedDriver(d);
                    setDrawerTab('overview');
                  }}
                >
                  View
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setSelectedDriver(d);
                    setDrawerTab('performance');
                  }}
                >
                  Performance
                </Button>
                {d.status !== 'suspended' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setSuspendTarget(d)}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Driver Modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="New Driver" description="Create a driver user and profile.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <input
              className="input"
              placeholder="Full Name"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
            <input
              type="email"
              className="input"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="input"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="License Number"
                required
                value={form.license_number}
                onChange={(e) => setForm({ ...form, license_number: e.target.value })}
              />
              <select
                className="input"
                value={form.license_class}
                onChange={(e) => setForm({ ...form, license_class: e.target.value })}
              >
                <option value="CDL-A">CDL-A</option>
                <option value="CDL-B">CDL-B</option>
                <option value="CDL-C">CDL-C</option>
                <option value="LMV">LMV</option>
              </select>
            </div>
            <input
              type="date"
              className="input"
              required
              value={form.license_expiry}
              onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create Driver
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Driver View Drawer */}
      <Dialog
        open={Boolean(selectedDriver)}
        onOpenChange={(open) => !open && setSelectedDriver(null)}
      >
        <DialogContent
          className="max-w-xl"
          title={selectedDriver?.full_name || 'Driver Profile'}
          description={`License: ${selectedDriver?.license_number || ''} (${selectedDriver?.license_class || ''})`}
        >
          <div className="mb-4 flex gap-2 border-b border-obsidian-200 pb-2">
            {['overview', 'trips', 'performance'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDrawerTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                  drawerTab === tab
                    ? 'bg-obsidian-900 text-white'
                    : 'text-obsidian-600 hover:bg-obsidian-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {drawerTab === 'overview' && (
            <div className="space-y-2 text-sm">
              <p><span className="text-obsidian-500">Email:</span> {selectedDriver?.email}</p>
              <p><span className="text-obsidian-500">Phone:</span> {selectedDriver?.phone || '—'}</p>
              <p><span className="text-obsidian-500">License Expiry:</span> {selectedDriver?.license_expiry}</p>
            </div>
          )}

          {drawerTab === 'trips' && (
            <div className="space-y-2 text-xs">
              {(driverDetail?.upcoming_trips || []).length === 0 ? (
                <p className="text-obsidian-500">No upcoming trips assigned.</p>
              ) : (
                driverDetail.upcoming_trips.map((t) => (
                  <div key={t.id} className="flex justify-between rounded border border-obsidian-100 p-2">
                    <span>{t.trip_number}: {t.origin} → {t.destination}</span>
                    <StatusBadge status={t.status} />
                  </div>
                ))
              )}
            </div>
          )}

          {drawerTab === 'performance' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-obsidian-50 p-2">
                  <p className="text-obsidian-500">Total Trips</p>
                  <p className="font-mono text-lg font-bold">{driverPerf?.total_trips ?? 0}</p>
                </div>
                <div className="rounded bg-obsidian-50 p-2">
                  <p className="text-obsidian-500">On-Time %</p>
                  <p className="font-mono text-lg font-bold">{driverPerf?.on_time_pct ?? 100}%</p>
                </div>
                <div className="rounded bg-obsidian-50 p-2">
                  <p className="text-obsidian-500">Rating</p>
                  <p className="font-mono text-lg font-bold">{driverPerf?.avg_rating ?? 5.0}</p>
                </div>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { metric: 'Trips', value: Number(driverPerf?.total_trips || 0) },
                      { metric: 'On-Time %', value: Number(driverPerf?.on_time_pct || 100) },
                    ]}
                  >
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(suspendTarget)}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title="Suspend Driver"
        description={`Suspend ${suspendTarget?.full_name}? They will not be assignable to new trips.`}
        confirmLabel="Suspend"
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate({ id: suspendTarget.id, status: 'suspended' })}
      />
    </div>
  );
}
