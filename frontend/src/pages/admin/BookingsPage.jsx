import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';

const TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
];

export function BookingsPage() {
  const qc = useQueryClient();
  const [statusTab, setStatusTab] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [viewBooking, setViewBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', statusTab],
    queryFn: async () => {
      const params = { limit: 100 };
      if (statusTab) params.status = statusTab;
      const { data } = await api.get('/api/v1/bookings', { params });
      return data.data || [];
    },
  });

  const { data: scheduledTrips = [] } = useQuery({
    queryKey: ['scheduled-trips-assign'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/trips', {
        params: { status: 'scheduled', limit: 50 },
      });
      return data.data || [];
    },
    enabled: Boolean(assignTarget),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ bookingId, tripId }) => {
      const { data } = await api.patch(`/api/v1/bookings/${bookingId}/assign`, {
        trip_id: tripId,
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Booking assigned to trip');
      setAssignTarget(null);
      setSelectedTripId('');
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to assign booking'),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await api.patch(`/api/v1/bookings/${id}/status`, {
        status: 'cancelled',
      });
      return data;
    },
    onSuccess: () => {
      toast.success('Booking cancelled');
      setCancelTarget(null);
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to cancel booking'),
  });

  const columns = [
    {
      key: 'booking_reference',
      label: 'Booking#',
      render: (r) => <span className="font-mono text-xs font-semibold">{r.booking_reference}</span>,
    },
    { key: 'company_name', label: 'Customer' },
    {
      key: 'route',
      label: 'From → To',
      render: (r) => `${r.origin} → ${r.destination}`,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (r) => format(new Date(r.created_at), 'MMM d, yyyy'),
    },
    {
      key: 'weight_kg',
      label: 'Weight',
      render: (r) => `${r.weight_kg} kg`,
    },
    {
      key: 'quoted_price',
      label: 'Price',
      render: (r) => <span className="font-mono">₹{Number(r.quoted_price || 0).toLocaleString()}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {r.status === 'pending' && (
            <Button size="sm" onClick={() => setAssignTarget(r)}>
              Assign
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setViewBooking(r)}>
            View
          </Button>
          {['pending', 'confirmed'].includes(r.status) && (
            <Button size="sm" variant="danger" onClick={() => setCancelTarget(r)}>
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        description="Manage customer shipment requests and assign them to scheduled trips."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setStatusTab(t.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              statusTab === t.value
                ? 'bg-obsidian-900 text-white'
                : 'bg-obsidian-100 text-obsidian-700 hover:bg-obsidian-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={bookings}
        loading={isLoading}
        empty={{
          icon: Package,
          title: 'No bookings found',
          description: 'No bookings match the selected status filter.',
        }}
      />

      {/* Assign Modal */}
      <Dialog
        open={Boolean(assignTarget)}
        onOpenChange={(open) => !open && setAssignTarget(null)}
      >
        <DialogContent
          title="Assign Booking to Trip"
          description={`Booking ${assignTarget?.booking_reference || ''}: ${assignTarget?.origin || ''} → ${assignTarget?.destination || ''}`}
        >
          <div className="space-y-4">
            <select
              className="input"
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
            >
              <option value="">Select scheduled trip...</option>
              {scheduledTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trip_number}: {t.origin} → {t.destination} ({t.vehicle_reg})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAssignTarget(null)}>
                Cancel
              </Button>
              <Button
                disabled={!selectedTripId || assignMutation.isPending}
                onClick={() =>
                  assignMutation.mutate({
                    bookingId: assignTarget.id,
                    tripId: selectedTripId,
                  })
                }
              >
                Confirm Assignment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog
        open={Boolean(viewBooking)}
        onOpenChange={(open) => !open && setViewBooking(null)}
      >
        <DialogContent
          title={viewBooking?.booking_reference || 'Booking'}
          description={`${viewBooking?.origin || ''} → ${viewBooking?.destination || ''}`}
        >
          {viewBooking && (
            <div className="space-y-2 text-sm">
              <p><span className="text-obsidian-500">Customer:</span> {viewBooking.company_name}</p>
              <p><span className="text-obsidian-500">Cargo:</span> {viewBooking.cargo_description}</p>
              <p><span className="text-obsidian-500">Weight:</span> {viewBooking.weight_kg} kg</p>
              <p><span className="text-obsidian-500">Price:</span> ₹{viewBooking.quoted_price}</p>
              <p><span className="text-obsidian-500">Status:</span> <StatusBadge status={viewBooking.status} /></p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel Booking"
        description={`Cancel booking ${cancelTarget?.booking_reference}? This cannot be undone.`}
        confirmLabel="Cancel Booking"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(cancelTarget.id)}
      />
    </div>
  );
}
