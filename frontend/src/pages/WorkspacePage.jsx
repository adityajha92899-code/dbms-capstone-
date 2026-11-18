import { Truck, Navigation, Package, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/shared/PageHeader';
import { KpiCard } from '../components/shared/KpiCard';

export function WorkspacePage({ title, description }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active Fleet" value="18" trend={4.2} trendLabel="vs last month" icon={Truck} />
        <KpiCard label="Active Trips" value="7" trend={12.0} trendLabel="live today" icon={Navigation} accent />
        <KpiCard label="Pending Bookings" value="4" trend={-2.5} trendLabel="awaiting dispatch" icon={Package} />
        <KpiCard label="On-Time Rate" value="96.4%" trend={1.8} trendLabel="30-day avg" icon={CheckCircle2} />
      </div>
    </div>
  );
}
