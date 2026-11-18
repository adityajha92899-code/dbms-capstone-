import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';

export function AuditPage() {
  const [resultFilter, setResultFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => (await api.get('/api/v1/audit/login', { params: { limit: 100 } })).data.data || [],
  });

  const filtered = logs.filter((l) => {
    if (resultFilter === 'success' && !l.success) return false;
    if (resultFilter === 'failed' && l.success) return false;
    if (emailFilter && !l.email.toLowerCase().includes(emailFilter.toLowerCase())) return false;
    return true;
  });

  const columns = [
    {
      key: 'occurred_at',
      label: 'Time',
      render: (r) => format(new Date(r.occurred_at), 'MMM d, yyyy h:mm a'),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'success',
      label: 'Result',
      render: (r) => (
        <StatusBadge
          status={r.success ? 'completed' : 'suspended'}
          className={!r.success ? 'bg-red-100 text-red-800' : ''}
        />
      ),
    },
    {
      key: 'failure_reason',
      label: 'Reason',
      render: (r) => (
        <span className={!r.success ? 'font-semibold text-status-danger' : 'text-obsidian-500'}>
          {r.failure_reason || '—'}
        </span>
      ),
    },
    { key: 'ip_address', label: 'IP', render: (r) => <span className="font-mono text-xs">{r.ip_address || '—'}</span> },
    { key: 'user_agent', label: 'User Agent', render: (r) => <span className="truncate max-w-[180px] block text-xs">{r.user_agent || '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Login Audit Log" description="Security events and authentication attempts." />

      <div className="card flex flex-wrap items-center gap-3">
        <select className="input w-auto" value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="">All Results</option>
          <option value="success">Success Only</option>
          <option value="failed">Failed Only</option>
        </select>
        <input
          className="input w-64"
          placeholder="Filter by email..."
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        empty={{ icon: ShieldCheck, title: 'No audit entries', description: 'No matching login events found.' }}
      />
    </div>
  );
}
