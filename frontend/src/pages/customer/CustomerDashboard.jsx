import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Package, Truck, CheckCircle2, PlusCircle, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/shared/PageHeader';
import { KpiCard } from '../../components/shared/KpiCard';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';

export function CustomerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedBooking, setSelectedBooking] = useState(null);

  const { data: bookings = [], isLoading, isError } = useQuery({
    queryKey: ['customer-bookings'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/bookings', { params: { limit: 50 } });
      return data.data || [];
    },
  });

  const companyName = user?.profile?.company_name || user?.full_name || 'Customer';
  const activeBookings = bookings.filter((b) =>
    ['pending', 'confirmed', 'in_transit'].includes(b.status)
  );
  const inTransitCount = bookings.filter((b) => b.status === 'in_transit').length;
  const deliveredBookings = bookings.filter((b) => b.status === 'delivered');

  const columns = [
    {
      key: 'booking_reference',
      label: 'Booking#',
      render: (row) => (
        <span className="font-mono text-xs font-semibold">{row.booking_reference}</span>
      ),
    },
    {
      key: 'route',
      label: 'From → To',
      render: (row) => `${row.origin} → ${row.destination}`,
    },
    {
      key: 'created_at',
      label: 'Date',
      render: (row) => format(new Date(row.created_at), 'MMM d, yyyy'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setSelectedBooking(row)}>
          Track
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${companyName}`}
        description="Track your active shipments and manage transport requests."
      />

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load bookings. Please try refreshing.</span>
        </div>
      )}

      {/* Row 1: 3 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {isLoading ? (
          <>
            <SkeletonLoader variant="kpi" />
            <SkeletonLoader variant="kpi" />
            <SkeletonLoader variant="kpi" />
          </>
        ) : (
          <>
            <KpiCard label="Total Bookings" value={bookings.length} icon={Package} />
            <KpiCard label="In Transit" value={inTransitCount} icon={Truck} accent />
            <KpiCard label="Delivered" value={deliveredBookings.length} icon={CheckCircle2} />
          </>
        )}
      </div>

      {/* Row 2: Active Bookings + New Booking CTA */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-base font-semibold text-obsidian-900">Active Bookings</h2>
          <DataTable
            columns={columns}
            data={activeBookings}
            loading={isLoading}
            empty={{
              title: 'No active bookings',
              description: 'Create a new transport request to get started.',
            }}
          />
        </div>

        <div className="card flex flex-col justify-between bg-obsidian-900 text-white">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <PlusCircle className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">New Booking</h2>
            <p className="text-xs text-obsidian-300">
              Schedule a pickup, get an instant quote, and track your cargo end-to-end.
            </p>
          </div>
          <Button
            className="mt-6 w-full"
            onClick={() => navigate('/customer/bookings/new')}
          >
            Create a transport request →
          </Button>
        </div>
      </div>

      {/* Row 3: Recent Deliveries */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-obsidian-900">Recent Deliveries</h2>
        <DataTable
          columns={columns.filter((c) => c.key !== 'actions')}
          data={deliveredBookings.slice(0, 5)}
          loading={isLoading}
          empty={{
            title: 'No completed deliveries yet',
            description: 'Delivered shipments will appear here.',
          }}
        />
      </div>

      {/* Booking Detail Modal */}
      <Dialog
        open={Boolean(selectedBooking)}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
      >
        <DialogContent
          title={selectedBooking?.booking_reference || 'Booking Details'}
          description={`${selectedBooking?.origin || ''} → ${selectedBooking?.destination || ''}`}
        >
          {selectedBooking && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-obsidian-500">Status</span>
                <StatusBadge status={selectedBooking.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-obsidian-500">Cargo</span>
                <span className="font-medium text-obsidian-900">
                  {selectedBooking.cargo_description}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-obsidian-500">Weight</span>
                <span className="font-mono">{selectedBooking.weight_kg} kg</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-obsidian-500">Quoted Price</span>
                <span className="font-mono font-semibold">
                  ₹{Number(selectedBooking.quoted_price || 0).toLocaleString()}
                </span>
              </div>
              {selectedBooking.invoice_number && (
                <div className="flex items-center justify-between">
                  <span className="text-obsidian-500">Invoice</span>
                  <span className="font-mono text-xs">{selectedBooking.invoice_number}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
