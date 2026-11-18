import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import { ArrowLeft, Truck, User, Package, Wallet, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { joinRoom } from '../../lib/socket';
import { useSocket } from '../../hooks/useSocket';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { Button } from '../../components/ui/button';

export function TripDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [livePos, setLivePos] = useState(null);

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip-detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/trips/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (id) joinRoom(`trip:${id}`);
  }, [id]);

  useSocket('location:update', (payload) => {
    if (payload?.tripId === id) {
      setLivePos([Number(payload.lat), Number(payload.lng)]);
    }
  });

  const statusMutation = useMutation({
    mutationFn: async (status) => {
      const { data } = await api.patch(`/api/v1/trips/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      toast.success('Trip status updated');
      qc.invalidateQueries({ queryKey: ['trip-detail', id] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update status'),
  });

  if (isLoading) {
    return <SkeletonLoader variant="table" rows={8} />;
  }

  if (!trip) {
    return (
      <div className="card">
        <p className="text-sm text-obsidian-500">Trip not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>
          Back
        </Button>
      </div>
    );
  }

  const currentPos = livePos || [
    Number(trip.current_lat) || 20.59,
    Number(trip.current_lng) || 78.96,
  ];
  const polyline = [
    [28.6139, 77.209],
    currentPos,
    [19.076, 72.8777],
  ];

  const bookingRevenue = (trip.bookings || []).reduce(
    (sum, b) => sum + Number(b.quoted_price || 0),
    0
  );
  const fuelEst = Math.round((Number(trip.distance_km || 300) / 3.2) * 95);
  const tollEst = Math.round(Number(trip.distance_km || 300) * 1.4);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Trip ${trip.trip_number}`}
        description={`${trip.origin} → ${trip.destination}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={trip.status} />
            <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 cols: Map + Timeline */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-0 overflow-hidden">
            <div className="h-80 w-full">
              <MapContainer center={currentPos} zoom={5} className="h-full w-full z-0">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Polyline positions={polyline} color="#F59E0B" weight={4} />
                <Marker position={currentPos}>
                  <Popup>{trip.trip_number} — Current Location</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>

          <div className="card">
            <h2 className="mb-4 text-base font-semibold text-obsidian-900">
              Tracking Timeline
            </h2>
            {(trip.tracking_events || []).length === 0 ? (
              <p className="text-xs text-obsidian-500">No tracking events recorded yet.</p>
            ) : (
              <ol className="relative border-l border-obsidian-200 ml-3 space-y-4">
                {trip.tracking_events.map((evt) => (
                  <li key={evt.id} className="ml-5">
                    <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-obsidian-900">
                      <MapPin className="h-3 w-3" />
                    </span>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize text-obsidian-900">
                        {evt.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-obsidian-400">
                        {format(new Date(evt.occurred_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-obsidian-600">
                      {evt.notes || evt.location_name || 'Telemetry update'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Right col: Resource cards + Financials + Actions */}
        <div className="space-y-4">
          <div className="card space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-obsidian-900">
              <Truck className="h-4 w-4 text-accent" />
              <span>Vehicle</span>
            </div>
            <p className="font-mono font-bold">{trip.vehicle_reg}</p>
            <p className="text-obsidian-500">
              {trip.vehicle_make} {trip.vehicle_model}
            </p>
          </div>

          <div className="card space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-obsidian-900">
              <User className="h-4 w-4 text-accent" />
              <span>Driver</span>
            </div>
            <p className="font-semibold">{trip.driver_name}</p>
            <p className="text-obsidian-500">
              {trip.driver_phone} • {trip.license_number}
            </p>
          </div>

          <div className="card space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-obsidian-900">
              <Package className="h-4 w-4 text-accent" />
              <span>Linked Bookings ({(trip.bookings || []).length})</span>
            </div>
            {(trip.bookings || []).map((b) => (
              <div key={b.id} className="flex justify-between border-t border-obsidian-100 pt-1.5">
                <span className="font-mono">{b.booking_reference}</span>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>

          <div className="card space-y-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-obsidian-900">
              <Wallet className="h-4 w-4 text-accent" />
              <span>Financials</span>
            </div>
            <div className="flex justify-between">
              <span className="text-obsidian-500">Fuel Est.</span>
              <span className="font-mono">₹{fuelEst.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-obsidian-500">Toll Est.</span>
              <span className="font-mono">₹{tollEst.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Booking Revenue</span>
              <span className="font-mono text-status-success">
                ₹{bookingRevenue.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="card space-y-2">
            <label className="block text-xs font-semibold text-obsidian-900">
              Update Status
            </label>
            <select
              className="input"
              value=""
              onChange={(e) => e.target.value && statusMutation.mutate(e.target.value)}
            >
              <option value="">Select new status...</option>
              {trip.status === 'scheduled' && (
                <>
                  <option value="in_progress">Start Trip (In Progress)</option>
                  <option value="cancelled">Cancel Trip</option>
                </>
              )}
              {trip.status === 'in_progress' && (
                <>
                  <option value="completed">Complete Trip</option>
                  <option value="cancelled">Cancel Trip</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
