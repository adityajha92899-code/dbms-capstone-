import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { ArrowLeft, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { Button } from '../../components/ui/button';

const STEPS = ['pending', 'confirmed', 'in_transit', 'delivered'];

export function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/bookings/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });

  if (isLoading) return <SkeletonLoader variant="card" />;
  if (!booking) return <div className="card">Booking not found.</div>;

  const currentIdx = STEPS.indexOf(booking.status);

  const handleDownloadInvoice = () => {
    const content = `FleetFlow TMS Invoice\nInvoice#: ${booking.invoice_number || 'PENDING'}\nBooking#: ${booking.booking_reference}\nRoute: ${booking.origin} -> ${booking.destination}\nAmount: INR ${booking.quoted_price}\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${booking.invoice_number || booking.booking_reference}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Invoice downloaded');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={booking.booking_reference}
        description={`${booking.origin} → ${booking.destination}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} />
            {booking.status === 'delivered' && (
              <Button size="sm" onClick={handleDownloadInvoice}>
                <Download className="h-4 w-4" />
                Download Invoice
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      {/* Status Timeline */}
      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-obsidian-900">Shipment Progress</h2>
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((s, idx) => {
            const done = currentIdx >= idx;
            return (
              <div key={s} className="flex flex-col items-center text-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    done ? 'bg-status-success text-white' : 'bg-obsidian-100 text-obsidian-400'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="mt-1.5 text-xs font-medium capitalize">
                  {s.replace('_', ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {booking.status === 'in_transit' && (
        <div className="card p-0 overflow-hidden">
          <div className="border-b border-obsidian-200 px-5 py-3 text-sm font-semibold">
            Live Shipment Map
          </div>
          <div className="h-72 w-full">
            <MapContainer center={[20.59, 78.96]} zoom={5} className="h-full w-full z-0">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[20.59, 78.96]}>
                <Popup>{booking.booking_reference} — In Transit</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}
    </div>
  );
}
