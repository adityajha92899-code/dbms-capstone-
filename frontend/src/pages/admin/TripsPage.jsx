import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, LayoutGrid, List, Navigation, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';

const KANBAN_COLS = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

export function TripsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState('kanban');
  const [statusFilter, setStatusFilter] = useState('');
  const [draggedTripId, setDraggedTripId] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [routeSearch, setRouteSearch] = useState('');
  const [conflictError, setConflictError] = useState('');
  const [tripForm, setTripForm] = useState({
    route_id: '',
    vehicle_id: '',
    driver_id: '',
    scheduled_start: '',
    scheduled_end: '',
    booking_ids: [],
  });

  const queryKey = ['trips', statusFilter];
  const { data: trips = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/api/v1/trips', { params });
      return data.data || [];
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes-select'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/routes', { params: { limit: 100 } });
      return data.data || [];
    },
    enabled: modalOpen,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-select'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/vehicles', {
        params: { status: 'available', limit: 100 },
      });
      return data.data || [];
    },
    enabled: modalOpen,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['drivers-select'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/drivers', {
        params: { status: 'available', limit: 100 },
      });
      return data.data || [];
    },
    enabled: modalOpen,
  });

  const { data: pendingBookings = [] } = useQuery({
    queryKey: ['pending-bookings-select'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/bookings', {
        params: { status: 'pending', limit: 50 },
      });
      return data.data || [];
    },
    enabled: modalOpen,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/api/v1/trips/${id}/status`, { status });
      return data;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey) || [];
      qc.setQueryData(
        queryKey,
        prev.map((t) => (t.id === id ? { ...t, status } : t))
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error(err.response?.data?.error || 'Invalid status transition');
    },
    onSuccess: () => toast.success('Trip status updated'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/trips', payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Trip scheduled');
      setModalOpen(false);
      setStep(1);
      setConflictError('');
      qc.invalidateQueries({ queryKey: ['trips'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error || 'Failed to schedule trip';
      setConflictError(msg);
      toast.error(msg);
    },
  });

  const filteredRoutes = routes.filter((r) =>
    `${r.code} ${r.origin} ${r.destination}`
      .toLowerCase()
      .includes(routeSearch.toLowerCase())
  );

  const selectedDriverObj = drivers.find((d) => d.id === tripForm.driver_id);

  const columns = [
    {
      key: 'trip_number',
      label: 'Trip#',
      render: (r) => <span className="font-mono text-xs font-semibold">{r.trip_number}</span>,
    },
    { key: 'vehicle_reg', label: 'Vehicle' },
    { key: 'driver_name', label: 'Driver' },
    {
      key: 'route',
      label: 'Route',
      render: (r) => `${r.origin} → ${r.destination}`,
    },
    {
      key: 'scheduled_start',
      label: 'Scheduled',
      render: (r) => format(new Date(r.scheduled_start), 'MMM d, h:mm a'),
    },
    {
      key: 'booking_count',
      label: 'Bookings',
      render: (r) => (
        <span className="badge bg-obsidian-100 text-obsidian-700">{r.booking_count ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trips & Dispatch"
        description="Schedule trips, track progress, and manage active dispatches."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-obsidian-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setView('kanban')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                  view === 'kanban' ? 'bg-obsidian-900 text-white' : 'text-obsidian-600'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
                  view === 'table' ? 'bg-obsidian-900 text-white' : 'text-obsidian-600'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
            <Button
              onClick={() => {
                setStep(1);
                setConflictError('');
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Schedule Trip</span>
            </Button>
          </div>
        }
      />

      {view === 'table' && (
        <div className="flex items-center gap-2">
          {['', 'scheduled', 'in_progress', 'completed', 'cancelled'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                statusFilter === s
                  ? 'bg-obsidian-900 text-white'
                  : 'bg-obsidian-100 text-obsidian-700'
              }`}
            >
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <SkeletonLoader variant="table" rows={6} />
      ) : trips.length === 0 ? (
        <EmptyState
          icon={Navigation}
          title="No trips found"
          description="Schedule a new trip to dispatch a vehicle and driver."
          actionLabel="Schedule Trip"
          onAction={() => setModalOpen(true)}
        />
      ) : view === 'table' ? (
        <DataTable
          columns={columns}
          data={trips}
          onRowClick={(row) => navigate(`/admin/trips/${row.id}`)}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {KANBAN_COLS.map((col) => {
            const colTrips = trips.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedTripId) {
                    statusMutation.mutate({ id: draggedTripId, status: col.key });
                    setDraggedTripId(null);
                  }
                }}
                className="flex flex-col gap-3 rounded-lg border border-obsidian-200 bg-obsidian-50/70 p-3 min-h-[420px]"
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-obsidian-700">
                    {col.label}
                  </h3>
                  <span className="badge bg-white text-obsidian-700 shadow-sm">
                    {colTrips.length}
                  </span>
                </div>

                {colTrips.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDraggedTripId(t.id)}
                    onClick={() => navigate(`/admin/trips/${t.id}`)}
                    className="card cursor-pointer space-y-2 p-3 hover:border-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-obsidian-900">
                        {t.trip_number}
                      </span>
                      <span className="badge bg-amber-100 text-amber-800">
                        {t.booking_count ?? 0} bookings
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-obsidian-800">
                      {t.origin} → {t.destination}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-obsidian-500">
                      <span>{t.vehicle_reg}</span>
                      <span>{t.driver_name}</span>
                    </div>
                    <p className="text-[11px] text-obsidian-400">
                      {format(new Date(t.scheduled_start), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Trip 3-Step Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="max-w-lg"
          title={`Schedule Trip — Step ${step} of 3`}
          description="Select route, assign fleet resources, and set schedule window."
        >
          {step === 1 && (
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Search routes..."
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
              />
              <select
                className="input"
                value={tripForm.route_id}
                onChange={(e) => setTripForm({ ...tripForm, route_id: e.target.value })}
              >
                <option value="">Select a route...</option>
                {filteredRoutes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code}: {r.origin} → {r.destination} ({r.distance_km} km)
                  </option>
                ))}
              </select>
              <div className="flex justify-end pt-2">
                <Button disabled={!tripForm.route_id} onClick={() => setStep(2)}>
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Available Vehicle</label>
                <select
                  className="input"
                  value={tripForm.vehicle_id}
                  onChange={(e) => setTripForm({ ...tripForm, vehicle_id: e.target.value })}
                >
                  <option value="">Select vehicle...</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.reg_number} — {v.make} {v.model} ({v.capacity_kg} kg)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Available Driver</label>
                <select
                  className="input"
                  value={tripForm.driver_id}
                  onChange={(e) => setTripForm({ ...tripForm, driver_id: e.target.value })}
                >
                  <option value="">Select driver...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.license_class}) — {d.active_trips_count} active
                    </option>
                  ))}
                </select>
              </div>
              {selectedDriverObj?.active_trips_count > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Driver currently has {selectedDriverObj.active_trips_count} active trip(s).
                </p>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button
                  disabled={!tripForm.vehicle_id || !tripForm.driver_id}
                  onClick={() => setStep(3)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Scheduled Start</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={tripForm.scheduled_start}
                    onChange={(e) =>
                      setTripForm({ ...tripForm, scheduled_start: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Scheduled End</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={tripForm.scheduled_end}
                    onChange={(e) =>
                      setTripForm({ ...tripForm, scheduled_end: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">
                  Attach Pending Bookings (optional)
                </label>
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-obsidian-200 p-2 text-xs">
                  {pendingBookings.length === 0 ? (
                    <p className="text-obsidian-400">No pending bookings available.</p>
                  ) : (
                    pendingBookings.map((b) => (
                      <label key={b.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tripForm.booking_ids.includes(b.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...tripForm.booking_ids, b.id]
                              : tripForm.booking_ids.filter((id) => id !== b.id);
                            setTripForm({ ...tripForm, booking_ids: next });
                          }}
                        />
                        <span>
                          {b.booking_reference}: {b.origin} → {b.destination}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {conflictError && (
                <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{conflictError}</span>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  ← Back
                </Button>
                <Button
                  disabled={
                    !tripForm.scheduled_start ||
                    !tripForm.scheduled_end ||
                    createMutation.isPending
                  }
                  onClick={() => createMutation.mutate(tripForm)}
                >
                  {createMutation.isPending ? 'Scheduling...' : 'Create Trip'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
