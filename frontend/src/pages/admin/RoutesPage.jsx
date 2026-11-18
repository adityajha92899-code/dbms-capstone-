import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Plus, Search, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';

export function RoutesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  const [form, setForm] = useState({
    code: '',
    name: '',
    origin: '',
    destination: '',
    distance_km: 350,
    estimated_duration_hrs: 5,
    base_rate_per_km: 2.5,
  });

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes', search],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/routes', {
        params: search ? { search } : {},
      });
      return data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/api/v1/routes', payload);
      return data;
    },
    onSuccess: (created) => {
      toast.success('Route created');
      setNewOpen(false);
      setSelectedRoute(created);
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create route'),
  });

  const activeRoute = selectedRoute || routes[0] || null;
  const polylineCoords = [
    [28.6139, 77.209],
    [19.076, 72.8777],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes & Corridors"
        description="Manage freight corridors, distances, and rate cards."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>New Route</span>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Searchable List */}
        <div className="card space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-obsidian-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search routes by code, origin, destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <SkeletonLoader variant="table" rows={5} />
          ) : routes.length === 0 ? (
            <EmptyState
              icon={RouteIcon}
              title="No routes found"
              description="Create a route corridor to start scheduling trips."
              actionLabel="New Route"
              onAction={() => setNewOpen(true)}
            />
          ) : (
            <div className="divide-y divide-obsidian-100 max-h-[480px] overflow-y-auto">
              {routes.map((r) => {
                const estFuelCost = Math.round((Number(r.distance_km) / 3.2) * 95);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRoute(r)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeRoute?.id === r.id ? 'bg-amber-50' : 'hover:bg-obsidian-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-accent-hover">{r.code}</span>
                      <span className="text-xs text-obsidian-500">
                        {r.distance_km} km • {r.estimated_duration_hrs} hrs
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-obsidian-900">
                      {r.origin} → {r.destination}
                    </p>
                    <p className="mt-0.5 text-xs text-obsidian-500">
                      Est. fuel cost: ₹{estFuelCost.toLocaleString()} • Rate: ₹{r.base_rate_per_km}/km
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Map Preview */}
        <div className="card p-0 overflow-hidden">
          <div className="border-b border-obsidian-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-obsidian-900">
              {activeRoute ? `${activeRoute.origin} → ${activeRoute.destination}` : 'Route Preview'}
            </h2>
          </div>
          <div className="h-[520px] w-full">
            <MapContainer center={[23.5, 78.5]} zoom={5} className="h-full w-full z-0">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {activeRoute && (
                <>
                  <Polyline positions={polylineCoords} color="#F59E0B" weight={4} />
                  <Marker position={polylineCoords[0]}>
                    <Popup>Origin: {activeRoute.origin}</Popup>
                  </Marker>
                  <Marker position={polylineCoords[1]}>
                    <Popup>Destination: {activeRoute.destination}</Popup>
                  </Marker>
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* New Route Modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent title="New Route" description="Define a new freight corridor.">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Code (e.g. RT-010)"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <input
                className="input"
                placeholder="Route Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Origin"
                required
                value={form.origin}
                onChange={(e) => setForm({ ...form, origin: e.target.value })}
              />
              <input
                className="input"
                placeholder="Destination"
                required
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                className="input"
                placeholder="Distance (km)"
                required
                value={form.distance_km}
                onChange={(e) => setForm({ ...form, distance_km: Number(e.target.value) })}
              />
              <input
                type="number"
                step="0.5"
                className="input"
                placeholder="Hours"
                required
                value={form.estimated_duration_hrs}
                onChange={(e) =>
                  setForm({ ...form, estimated_duration_hrs: Number(e.target.value) })
                }
              />
              <input
                type="number"
                step="0.1"
                className="input"
                placeholder="Rate/km"
                required
                value={form.base_rate_per_km}
                onChange={(e) => setForm({ ...form, base_rate_per_km: Number(e.target.value) })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create Route
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
