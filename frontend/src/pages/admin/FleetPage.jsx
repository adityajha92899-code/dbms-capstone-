import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { Plus, Search, MoreHorizontal, Truck, Wrench, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../../components/ui/dropdown-menu';

const STATUS_CHIPS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'available' },
  { label: 'Maintenance', value: 'maintenance' },
  { label: 'Inactive', value: 'inactive' },
];

export function FleetPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [maintOpen, setMaintOpen] = useState(false);

  const [form, setForm] = useState({
    reg_number: '',
    vin: '',
    make: '',
    model: '',
    year: 2024,
    vehicle_type: 'semi_truck',
    capacity_kg: 18000,
    fuel_type: 'diesel',
    insurance_expiry: '2028-12-31',
  });

  const [maintForm, setMaintForm] = useState({
    maintenance_type: 'routine',
    description: '',
    cost: 0,
    status: 'in_progress',
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const queryKey = ['vehicles', { status: statusFilter, type: typeFilter, search: debouncedSearch }];
  const { data: vehiclesData, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const { data } = await api.get('/api/v1/vehicles', { params });
      return data.data || [];
    },
  });

  const { data: vehicleDetail } = useQuery({
    queryKey: ['vehicle-detail', selectedVehicle?.id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/vehicles/${selectedVehicle.id}`);
      return data;
    },
    enabled: Boolean(selectedVehicle?.id),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/vehicles', payload);
      return data;
    },
    onMutate: async (newVehicle) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey) || [];
      qc.setQueryData(queryKey, [{ id: 'temp-' + Date.now(), ...newVehicle, status: 'available' }, ...prev]);
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error(err.response?.data?.error || 'Failed to add vehicle');
    },
    onSuccess: () => {
      toast.success('Vehicle added to fleet');
      setNewOpen(false);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/api/v1/vehicles/${id}`);
      return data;
    },
    onSuccess: () => {
      toast.success('Vehicle deactivated');
      setConfirmDeactivate(null);
      setSelectedVehicle(null);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to deactivate vehicle'),
  });

  const maintMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.post(`/api/v1/vehicles/${id}/maintenance`, payload);
      return data;
    },
    onSuccess: () => {
      toast.success('Maintenance logged');
      setMaintOpen(false);
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['vehicle-detail', selectedVehicle?.id] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to log maintenance'),
  });

  const columns = [
    {
      key: 'reg_number',
      label: 'Reg#',
      render: (r) => <span className="font-mono font-semibold">{r.reg_number}</span>,
    },
    {
      key: 'vehicle_type',
      label: 'Type',
      render: (r) => <span className="capitalize">{String(r.vehicle_type || '').replace(/_/g, ' ')}</span>,
    },
    {
      key: 'capacity_kg',
      label: 'Capacity',
      render: (r) => `${Number(r.capacity_kg || 0).toLocaleString()} kg`,
    },
    {
      key: 'insurance_expiry',
      label: 'Insurance Expiry',
      render: (r) => {
        if (!r.insurance_expiry) return '—';
        const days = differenceInDays(new Date(r.insurance_expiry), new Date());
        return (
          <span className={days < 30 ? 'font-semibold text-status-danger' : ''}>
            {format(new Date(r.insurance_expiry), 'MMM d, yyyy')}
          </span>
        );
      },
    },
    {
      key: 'fitness_expiry',
      label: 'Fitness Expiry',
      render: (r) =>
        r.fitness_expiry ? format(new Date(r.fitness_expiry), 'MMM d, yyyy') : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded p-1 hover:bg-obsidian-100">
                <MoreHorizontal className="h-4 w-4 text-obsidian-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setSelectedVehicle(r); setActiveTab('overview'); }}>
                <Truck className="h-4 w-4" />
                <span>View Details</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSelectedVehicle(r); setMaintOpen(true); }}>
                <Wrench className="h-4 w-4" />
                <span>Log Maintenance</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-status-danger"
                onClick={() => setConfirmDeactivate(r)}
              >
                <PowerOff className="h-4 w-4" />
                <span>Deactivate</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Management"
        description="Monitor vehicles, compliance expiries, and maintenance logs."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>New Vehicle</span>
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="card flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => setStatusFilter(c.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === c.value
                  ? 'bg-obsidian-900 text-white'
                  : 'bg-obsidian-100 text-obsidian-700 hover:bg-obsidian-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input w-auto"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="semi_truck">Semi Truck</option>
            <option value="box_truck">Box Truck</option>
            <option value="van">Van</option>
            <option value="flatbed">Flatbed</option>
            <option value="reefer">Reefer</option>
          </select>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-obsidian-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search reg#, make, model..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={vehiclesData || []}
        loading={isLoading}
        onRowClick={(row) => {
          setSelectedVehicle(row);
          setActiveTab('overview');
        }}
        empty={{
          icon: Truck,
          title: 'No vehicles found',
          description: 'Add your first vehicle or adjust your search filters.',
          actionLabel: 'New Vehicle',
          onAction: () => setNewOpen(true),
        }}
      />

      {/* New Vehicle Modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="Add New Vehicle" description="Register a vehicle into FleetFlow.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Reg Number</label>
                <input
                  className="input"
                  required
                  value={form.reg_number}
                  onChange={(e) => setForm({ ...form, reg_number: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">VIN</label>
                <input
                  className="input"
                  required
                  value={form.vin}
                  onChange={(e) => setForm({ ...form, vin: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Make</label>
                <input
                  className="input"
                  required
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Model</label>
                <input
                  className="input"
                  required
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Type</label>
                <select
                  className="input"
                  value={form.vehicle_type}
                  onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
                >
                  <option value="semi_truck">Semi Truck</option>
                  <option value="box_truck">Box Truck</option>
                  <option value="van">Van</option>
                  <option value="flatbed">Flatbed</option>
                  <option value="reefer">Reefer</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Capacity (kg)</label>
                <input
                  type="number"
                  className="input"
                  required
                  value={form.capacity_kg}
                  onChange={(e) => setForm({ ...form, capacity_kg: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Year</label>
                <input
                  type="number"
                  className="input"
                  required
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Insurance Expiry</label>
                <input
                  type="date"
                  className="input"
                  required
                  value={form.insurance_expiry}
                  onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Create Vehicle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Drawer */}
      <Dialog
        open={Boolean(selectedVehicle) && !maintOpen}
        onOpenChange={(open) => !open && setSelectedVehicle(null)}
      >
        <DialogContent
          className="max-w-2xl"
          title={selectedVehicle?.reg_number || 'Vehicle Details'}
          description={`${selectedVehicle?.make || ''} ${selectedVehicle?.model || ''} (${selectedVehicle?.year || ''})`}
        >
          <div className="mb-4 flex gap-2 border-b border-obsidian-200 pb-2">
            {['overview', 'maintenance', 'trips', 'fuel'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                  activeTab === tab
                    ? 'bg-obsidian-900 text-white'
                    : 'text-obsidian-600 hover:bg-obsidian-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-obsidian-500">VIN:</span> <span className="font-mono">{selectedVehicle?.vin}</span></div>
              <div><span className="text-obsidian-500">Status:</span> <StatusBadge status={selectedVehicle?.status} /></div>
              <div><span className="text-obsidian-500">Capacity:</span> {selectedVehicle?.capacity_kg} kg</div>
              <div><span className="text-obsidian-500">Odometer:</span> {selectedVehicle?.odometer_km} km</div>
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-2 text-xs">
              {(vehicleDetail?.recent_maintenance || []).length === 0 ? (
                <p className="text-obsidian-500">No maintenance records found.</p>
              ) : (
                vehicleDetail.recent_maintenance.map((m) => (
                  <div key={m.id} className="flex justify-between rounded border border-obsidian-100 p-2">
                    <span>{m.maintenance_type}: {m.description}</span>
                    <span className="font-mono">₹{m.cost}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'trips' && (
            <div className="space-y-2 text-xs">
              {(vehicleDetail?.recent_trips || []).length === 0 ? (
                <p className="text-obsidian-500">No trips recorded for this vehicle.</p>
              ) : (
                vehicleDetail.recent_trips.map((t) => (
                  <div key={t.id} className="flex justify-between rounded border border-obsidian-100 p-2">
                    <span>{t.trip_number}: {t.origin} → {t.destination}</span>
                    <StatusBadge status={t.status} />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'fuel' && (
            <p className="text-xs text-obsidian-500">
              Fuel efficiency metrics are aggregated in Reports → Fuel Efficiency.
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-obsidian-100 pt-4">
            <Button size="sm" variant="secondary" onClick={() => setMaintOpen(true)}>
              Log Maintenance
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => setConfirmDeactivate(selectedVehicle)}
            >
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Maintenance Modal */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent title="Log Maintenance" description={`Vehicle: ${selectedVehicle?.reg_number || ''}`}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              maintMutation.mutate({ id: selectedVehicle.id, payload: maintForm });
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-medium">Type</label>
              <select
                className="input"
                value={maintForm.maintenance_type}
                onChange={(e) => setMaintForm({ ...maintForm, maintenance_type: e.target.value })}
              >
                <option value="routine">Routine</option>
                <option value="repair">Repair</option>
                <option value="inspection">Inspection</option>
                <option value="tire">Tire</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Description</label>
              <textarea
                className="input"
                required
                rows={3}
                value={maintForm.description}
                onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Cost (₹)</label>
              <input
                type="number"
                className="input"
                value={maintForm.cost}
                onChange={(e) => setMaintForm({ ...maintForm, cost: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setMaintOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={maintMutation.isPending}>
                Save Record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDeactivate)}
        onOpenChange={(open) => !open && setConfirmDeactivate(null)}
        title="Deactivate Vehicle"
        description={`Are you sure you want to mark ${confirmDeactivate?.reg_number} as inactive?`}
        confirmLabel="Deactivate"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(confirmDeactivate.id)}
      />
    </div>
  );
}
