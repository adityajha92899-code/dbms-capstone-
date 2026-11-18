import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Navigation } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Button } from '../../components/ui/button';

export function MyTripsPage() {
  const qc = useQueryClient();
  const [completeTarget, setCompleteTarget] = useState(null);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['driver-my-trips'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/trips', { params: { limit: 50 } });
      return data.data || [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await api.patch(`/api/v1/trips/${id}/status`, { status });
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'in_progress' ? 'Trip started' : 'Trip completed');
      setCompleteTarget(null);
      qc.invalidateQueries({ queryKey: ['driver-my-trips'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update trip'),
  });

  const columns = [
    {
      key: 'trip_number',
      label: 'Trip#',
      render: (r) => <span className="font-mono text-xs font-semibold">{r.trip_number}</span>,
    },
    { key: 'vehicle_reg', label: 'Vehicle' },
    { key: 'route', label: 'Route', render: (r) => `${r.origin} → ${r.destination}` },
    {
      key: 'scheduled_start',
      label: 'Scheduled',
      render: (r) => format(new Date(r.scheduled_start), 'MMM d, h:mm a'),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: 'Quick Actions',
      render: (r) => (
        <div className="flex gap-2">
          {r.status === 'scheduled' && (
            <Button
              size="sm"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: r.id, status: 'in_progress' })}
            >
              Start
            </Button>
          )}
          {r.status === 'in_progress' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={statusMutation.isPending}
              onClick={() => setCompleteTarget(r)}
            >
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Trips" description="View your assigned trips and update status." />
      <DataTable
        columns={columns}
        data={trips}
        loading={isLoading}
        empty={{
          icon: Navigation,
          title: 'No trips assigned',
          description: 'Assigned trips will appear here.',
        }}
      />
      <ConfirmDialog
        open={Boolean(completeTarget)}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        title="Complete Trip"
        description={`Mark trip ${completeTarget?.trip_number} as completed?`}
        confirmLabel="Complete"
        variant="primary"
        loading={statusMutation.isPending}
        onConfirm={() =>
          statusMutation.mutate({ id: completeTarget.id, status: 'completed' })
        }
      />
    </div>
  );
}
