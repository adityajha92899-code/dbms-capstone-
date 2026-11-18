import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Download, Truck, Route as RouteIcon, Clock, Wallet, Star } from 'lucide-react';
import { subDays, format } from 'date-fns';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { KpiCard } from '../../components/shared/KpiCard';
import { DataTable } from '../../components/shared/DataTable';
import { SkeletonLoader } from '../../components/shared/SkeletonLoader';
import { Button } from '../../components/ui/button';

const TABS = ['Overview', 'Fuel', 'Maintenance', 'Revenue', 'Drivers'];

export function ReportsPage() {
  const [tab, setTab] = useState('Overview');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const rangeParams = { from, to };

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['report-kpis'],
    queryFn: async () => (await api.get('/api/v1/reports/kpis')).data,
  });

  const { data: tripVolume = [] } = useQuery({
    queryKey: ['report-trip-volume', rangeParams],
    queryFn: async () => (await api.get('/api/v1/reports/trip-volume', { params: rangeParams })).data.data || [],
  });

  const { data: fuel = [], isLoading: fuelLoading } = useQuery({
    queryKey: ['report-fuel', rangeParams],
    queryFn: async () => (await api.get('/api/v1/reports/fuel-efficiency', { params: rangeParams })).data.data || [],
  });

  const { data: maintenance = [], isLoading: maintLoading } = useQuery({
    queryKey: ['report-maint', rangeParams],
    queryFn: async () => (await api.get('/api/v1/reports/maintenance-cost', { params: rangeParams })).data.data || [],
  });

  const { data: revenue = [], isLoading: revLoading } = useQuery({
    queryKey: ['report-rev', rangeParams],
    queryFn: async () => (await api.get('/api/v1/reports/revenue', { params: rangeParams })).data.data || [],
  });

  const { data: leaderboard = [], isLoading: driversLoading } = useQuery({
    queryKey: ['report-drivers'],
    queryFn: async () => (await api.get('/api/v1/reports/driver-leaderboard')).data.data || [],
  });

  const handleExportCsv = async () => {
    try {
      const { data } = await api.get('/api/v1/reports/export');
      const rows = data.tables?.trips || [];
      const headers = ['trip_number', 'status', 'scheduled_start', 'scheduled_end'];
      const csv = [
        headers.join(','),
        ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fleetflow-report-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } catch (_err) {
      toast.error('Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Operational KPIs, fuel efficiency, maintenance spend, and revenue."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-obsidian-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium ${
              tab === t ? 'bg-obsidian-900 text-white' : 'bg-obsidian-100 text-obsidian-700 hover:bg-obsidian-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpisLoading ? (
              <>
                <SkeletonLoader variant="kpi" />
                <SkeletonLoader variant="kpi" />
                <SkeletonLoader variant="kpi" />
                <SkeletonLoader variant="kpi" />
              </>
            ) : (
              <>
                <KpiCard label="Active Vehicles" value={`${kpis?.active_vehicles ?? 0}/${kpis?.total_vehicles ?? 0}`} icon={Truck} accent />
                <KpiCard label="Active Trips" value={kpis?.active_trips ?? 0} icon={RouteIcon} />
                <KpiCard label="On-Time Rate" value={`${kpis?.on_time_rate_30d ?? 100}%`} icon={Clock} />
                <KpiCard label="Revenue (30d)" value={`₹${Number(kpis?.revenue_30d ?? 0).toLocaleString()}`} icon={Wallet} accent />
              </>
            )}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold">Trip Volume</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tripVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="trip_count" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3 className="mb-3 text-sm font-semibold">Monthly Revenue</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Fuel' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold">Fuel Efficiency (km/L)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fuel}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="reg_number" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="km_per_liter" stroke="#3B82F6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <DataTable
            loading={fuelLoading}
            data={fuel}
            columns={[
              { key: 'reg_number', label: 'Vehicle' },
              { key: 'total_liters', label: 'Liters' },
              { key: 'km_per_liter', label: 'km/L' },
              { key: 'cost_per_km', label: 'Cost/km (₹)' },
              { key: 'trend', label: 'Trend' },
            ]}
          />
        </div>
      )}

      {tab === 'Maintenance' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold">Monthly Maintenance Spend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintenance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="total_cost" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <DataTable
            loading={maintLoading}
            data={maintenance}
            columns={[
              { key: 'month', label: 'Month' },
              { key: 'record_count', label: 'Service Count' },
              { key: 'total_cost', label: 'Total Spend (₹)' },
            ]}
          />
        </div>
      )}

      {tab === 'Revenue' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-3 text-sm font-semibold">Monthly Delivered Revenue</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <DataTable
            loading={revLoading}
            data={revenue}
            columns={[
              { key: 'month', label: 'Month' },
              { key: 'delivered_bookings', label: 'Delivered Bookings' },
              { key: 'revenue', label: 'Revenue (₹)' },
            ]}
          />
        </div>
      )}

      {tab === 'Drivers' && (
        <DataTable
          loading={driversLoading}
          data={leaderboard}
          columns={[
            { key: 'name', label: 'Driver' },
            { key: 'license_class', label: 'License Class' },
            { key: 'completed_trips_30d', label: 'Completed Trips (30d)' },
            {
              key: 'rating',
              label: 'Rating',
              render: (r) => (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {r.rating}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
