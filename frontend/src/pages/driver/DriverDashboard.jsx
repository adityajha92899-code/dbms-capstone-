import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import { Navigation, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { Button } from '../../components/ui/button';

export function DriverDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const {
    data: tripsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['driver-trips'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/trips', { params: { limit: 20 } });
      return data.data || [];
    },
  });

  const trips = tripsData || [];
  const activeTrip = trips.find((t) => t.status === 'in_progress');
  const todayTrips = trips.filter((t) =>
    ['scheduled', 'in_progress'].includes(t.status)
  );

  const { data: trackingEvents = [] } = useQuery({
    queryKey: ['driver-tracking', activeTrip?.id],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/trips/${activeTrip.id}/tracking`);
      return data.data || [];
    },
    enabled: Boolean(activeTrip?.id),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/api/v1/trips/${id}/status`, { status });
      return data;
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'in_progress' ? 'Trip started' : 'Trip marked as delivered'
      );
      qc.invalidateQueries({ queryKey: ['driver-trips'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update trip status');
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${user?.full_name || 'Driver'}`}
        description={format(new Date(), 'EEEE, MMMM d, yyyy')}
        actions={<StatusBadge status={user?.profile?.status || 'available'} />}
      />

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Unable to load your assigned trips.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's Trips */}
        <div className="card lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-obsidian-900">Today&apos;s Trips</h2>
            <span className="text-xs text-obsidian-500">{todayTrips.length} assigned</span>
          </div>

          {isLoading ? (
            <SkeletonLoader variant="table" rows={4} />
          ) : todayTrips.length === 0 ? (
            <EmptyState
              icon={Navigation}
              title="No trips scheduled — enjoy the day!"
              description="You have no active or upcoming trips assigned right now."
            />
          ) : (
            <div className="space-y-3">
              {todayTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-obsidian-200 p-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-obsidian-500">
                        {trip.trip_number}
                      </span>
                      <StatusBadge status={trip.status} />
                    </div>
                    <p className="text-sm font-semibold text-obsidian-900">
                      {trip.origin} → {trip.destination}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-obsidian-500">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(trip.scheduled_start), 'MMM d, h:mm a')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {trip.status === 'scheduled' && (
                      <Button
                        size="sm"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: trip.id, status: 'in_progress' })
                        }
                      >
                        Start Trip
                      </Button>
                    )}
                    {trip.status === 'in_progress' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: trip.id, status: 'completed' })
                        }
                      >
                        Mark Delivered
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Assignment */}
        <div className="card flex flex-col gap-4">
          <h2 className="text-base font-semibold text-obsidian-900">Current Assignment</h2>
          {activeTrip ? (
            <>
              <div className="h-56 overflow-hidden rounded-lg border border-obsidian-200">
                <MapContainer
                  center={[
                    Number(activeTrip.current_lat) || 20.59,
                    Number(activeTrip.current_lng) || 78.96,
                  ]}
                  zoom={6}
                  className="h-full w-full z-0"
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker
                    position={[
                      Number(activeTrip.current_lat) || 20.59,
                      Number(activeTrip.current_lng) || 78.96,
                    ]}
                  >
                    <Popup>{activeTrip.trip_number}</Popup>
                  </Marker>
                </MapContainer>
              </div>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-obsidian-900">
                  Next Waypoint: {activeTrip.destination}
                </p>
                <p className="text-obsidian-500">
                  ETA: {format(new Date(activeTrip.scheduled_end), 'MMM d, h:mm a')}
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              icon={MapPin}
              title="No active trip in progress"
              description="Start a scheduled trip to view live route navigation."
            />
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="mb-3 text-base font-semibold text-obsidian-900">Recent Activity</h2>
        {trackingEvents.length === 0 ? (
          <p className="text-xs text-obsidian-500">No recent tracking events recorded.</p>
        ) : (
          <ul className="divide-y divide-obsidian-100 text-xs">
            {trackingEvents.slice(-6).reverse().map((evt) => (
              <li key={evt.id} className="flex items-center justify-between py-2.5">
                <span className="font-medium capitalize text-obsidian-800">
                  {evt.event_type.replace(/_/g, ' ')} — {evt.notes || evt.location_name}
                </span>
                <span className="text-obsidian-400">
                  {format(new Date(evt.occurred_at), 'MMM d, h:mm a')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
