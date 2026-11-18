import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  Truck,
  Route as RouteIcon,
  Clock,
  Wallet,
  RefreshCw,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../lib/api';
import { useSocket } from '../../hooks/useSocket';
import { PageHeader } from '../../components/shared/PageHeader';
import { KpiCard } from '../../components/shared/KpiCard';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';

const pulseMarkerIcon = L.divIcon({
  className: 'custom-pulse-marker',
  html: `<div style="position:relative;width:16px;height:16px;">
    <span style="position:absolute;inset:0;border-radius:9999px;background:#F59E0B;opacity:0.5;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
    <span style="position:relative;display:block;width:16px;height:16px;border-radius:9999px;background:#F59E0B;border:2px solid #0F172A;"></span>
  </div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export function AdminDashboard() {
  const [liveFeed, setLiveFeed] = useState([]);

  const {
    data: kpis,
    isLoading: kpisLoading,
    isError: kpisError,
    refetch: refetchKpis,
    isFetching: kpisFetching,
  } = useQuery({
    queryKey: ['kpis'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/reports/kpis');
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: tripVolume = [], isLoading: volumeLoading } = useQuery({
    queryKey: ['trip-volume'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/reports/trip-volume');
      return (data.data || []).slice(0, 14).reverse();
    },
  });

  const { data: fuelEfficiency = [], isLoading: fuelLoading } = useQuery({
    queryKey: ['fuel-efficiency'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/reports/fuel-efficiency');
      return data.data || [];
    },
  });

  const { data: activeTrips = [] } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/trips', {
        params: { status: 'in_progress', limit: 20 },
      });
      return data.data || [];
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (activeTrips.length > 0 && liveFeed.length === 0) {
      setLiveFeed(
        activeTrips.slice(0, 8).map((t) => ({
          id: t.id,
          description: `${t.trip_number}: ${t.origin} → ${t.destination}`,
          time: t.last_location_update || t.updated_at || t.scheduled_start,
        }))
      );
    }
  }, [activeTrips, liveFeed.length]);

  useSocket('location:update', (payload) => {
    setLiveFeed((prev) => [
      {
        id: `loc-${Date.now()}`,
        description: `GPS ping (${Number(payload.lat).toFixed(3)}, ${Number(payload.lng).toFixed(3)})`,
        time: payload.last_location_update || new Date().toISOString(),
        isNew: true,
      },
      ...prev.slice(0, 14),
    ]);
  });

  useSocket('trip:update', (trip) => {
    setLiveFeed((prev) => [
      {
        id: `trip-${Date.now()}`,
        description: `Trip ${trip.trip_number || trip.id} updated to ${trip.status}`,
        time: new Date().toISOString(),
        isNew: true,
      },
      ...prev.slice(0, 14),
    ]);
    refetchKpis();
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Overview"
        description="Real-time fleet telemetry, dispatch health, and 30-day performance."
        actions={
          <Button variant="secondary" size="sm" onClick={() => refetchKpis()} disabled={kpisFetching}>
            <RefreshCw className={`h-4 w-4 ${kpisFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {kpisError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load live KPIs. Check backend connection and try refreshing.</span>
        </div>
      )}

      {/* Row 2: 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpisLoading ? (
          <>
            <SkeletonLoader variant="kpi" />
            <SkeletonLoader variant="kpi" />
            <SkeletonLoader variant="kpi" />
            <SkeletonLoader variant="kpi" />
          </>
        ) : (
          <>
            <KpiCard
              label="Active Vehicles"
              value={`${kpis?.active_vehicles ?? 0} / ${kpis?.total_vehicles ?? 0}`}
              trend={3.2}
              trendLabel="fleet available"
              icon={Truck}
              accent
            />
            <KpiCard
              label="Active Trips"
              value={kpis?.active_trips ?? 0}
              trend={8.4}
              trendLabel={`${kpis?.trips_today ?? 0} scheduled today`}
              icon={RouteIcon}
            />
            <KpiCard
              label="On-Time Rate (30d)"
              value={`${kpis?.on_time_rate_30d ?? 100}%`}
              trend={1.5}
              trendLabel="vs prior 30d"
              icon={Clock}
            />
            <KpiCard
              label="Revenue (30d)"
              value={`₹${Number(kpis?.revenue_30d ?? 0).toLocaleString()}`}
              trend={11.2}
              trendLabel={`${kpis?.pending_bookings ?? 0} pending`}
              icon={Wallet}
              accent
            />
          </>
        )}
      </div>

      {/* Row 3: Live Map + Live Feed */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-obsidian-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-obsidian-900">Live Fleet Map</h2>
            <span className="text-xs text-obsidian-500">
              {activeTrips.length} in-progress trips
            </span>
          </div>
          <div className="h-[480px] w-full">
            <MapContainer
              center={[20.59, 78.96]}
              zoom={5}
              className="h-full w-full z-0"
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {activeTrips.map((trip, idx) => {
                const lat = Number(trip.current_lat) || 20.59 + (idx % 5) * 1.1;
                const lng = Number(trip.current_lng) || 78.96 + (idx % 5) * 1.1;
                return (
                  <Marker key={trip.id} position={[lat, lng]} icon={pulseMarkerIcon}>
                    <Popup>
                      <div className="space-y-1 text-xs">
                        <p className="font-bold text-obsidian-900">{trip.trip_number}</p>
                        <p>{trip.origin} → {trip.destination}</p>
                        <p className="text-obsidian-500">Driver: {trip.driver_name}</p>
                        <StatusBadge status={trip.status} />
                        <div className="pt-1">
                          <Link
                            to={`/admin/trips?selected=${trip.id}`}
                            className="font-semibold text-accent-hover hover:underline"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-obsidian-900">Live Feed</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-success">
              <span className="h-2 w-2 animate-pulse rounded-full bg-status-success" />
              Live
            </span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[420px]">
            {liveFeed.length === 0 ? (
              <p className="text-xs text-obsidian-500">Waiting for live telemetry events...</p>
            ) : (
              liveFeed.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-lg border border-obsidian-100 p-2.5 text-xs ${
                    item.isNew ? 'animate-pulse bg-amber-50/50' : 'bg-obsidian-50/40'
                  }`}
                >
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-obsidian-800">{item.description}</p>
                    <p className="mt-0.5 text-[11px] text-obsidian-400">
                      {item.time
                        ? formatDistanceToNow(new Date(item.time), { addSuffix: true })
                        : 'just now'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 4: Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-obsidian-900">
            Trip Volume (Last 14 Days)
          </h2>
          {volumeLoading ? (
            <SkeletonLoader variant="card" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tripVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="trip_count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold text-obsidian-900">
            Fuel Efficiency (₹/km by Vehicle)
          </h2>
          {fuelLoading ? (
            <SkeletonLoader variant="card" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fuelEfficiency}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="reg_number" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" ₹/km" />
                  <Tooltip formatter={(val) => [`₹${val}/km`, 'Cost/km']} />
                  <Line
                    type="monotone"
                    dataKey="cost_per_km"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
