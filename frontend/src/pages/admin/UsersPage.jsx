import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Copy, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';

export function UsersPage() {
  const qc = useQueryClient();
  const [activityUser, setActivityUser] = useState(null);
  const [tempPwdInfo, setTempPwdInfo] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/api/v1/users')).data.data || [],
  });

  const { data: userAudit = [] } = useQuery({
    queryKey: ['user-audit', activityUser?.id],
    queryFn: async () =>
      (await api.get('/api/v1/audit/login', { params: { userId: activityUser.id } })).data.data || [],
    enabled: Boolean(activityUser?.id),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, is_active }) =>
      (await api.patch(`/api/v1/users/${id}/status`, { is_active })).data,
    onSuccess: () => {
      toast.success('User status updated');
      setDeactivateTarget(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update user'),
  });

  const resetPwdMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/api/v1/users/${id}/reset-password`)).data,
    onSuccess: (data) => {
      setTempPwdInfo(data);
      toast.success('Temporary password generated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to reset password'),
  });

  const columns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'user_type',
      label: 'Type',
      render: (r) => <span className="capitalize">{r.user_type}</span>,
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => <StatusBadge status={r.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'last_login_at',
      label: 'Last Login',
      render: (r) => (r.last_login_at ? format(new Date(r.last_login_at), 'MMM d, h:mm a') : 'Never'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setActivityUser(r)}>
            View Activity
          </Button>
          <Button size="sm" variant="secondary" onClick={() => resetPwdMutation.mutate(r.id)}>
            Reset Password
          </Button>
          {r.is_active && (
            <Button size="sm" variant="danger" onClick={() => setDeactivateTarget(r)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Manage user accounts, resets, and access." />
      <DataTable
        columns={columns}
        data={users}
        loading={isLoading}
        empty={{ icon: Users, title: 'No users found', description: 'No user accounts available.' }}
      />

      {/* Temp Password Modal (shown ONCE) */}
      <Dialog open={Boolean(tempPwdInfo)} onOpenChange={(o) => !o && setTempPwdInfo(null)}>
        <DialogContent
          title="Temporary Password"
          description={`Generated for ${tempPwdInfo?.email || ''}. Copy now — it will not be shown again.`}
        >
          <div className="flex items-center justify-between rounded-lg border border-obsidian-200 bg-obsidian-50 p-3">
            <code className="font-mono text-sm font-bold">{tempPwdInfo?.temporaryPassword}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(tempPwdInfo?.temporaryPassword || '');
                toast.success('Copied to clipboard');
              }}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Activity Drawer */}
      <Dialog open={Boolean(activityUser)} onOpenChange={(o) => !o && setActivityUser(null)}>
        <DialogContent
          className="max-w-xl"
          title={`Activity: ${activityUser?.full_name || ''}`}
          description={activityUser?.email || ''}
        >
          <div className="max-h-72 space-y-2 overflow-y-auto text-xs">
            {userAudit.length === 0 ? (
              <p className="text-obsidian-500">No login audit entries found.</p>
            ) : (
              userAudit.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded border border-obsidian-100 p-2">
                  <span>{a.success ? 'Login success' : `Failed: ${a.failure_reason || 'unknown'}`}</span>
                  <span className="text-obsidian-400">{format(new Date(a.occurred_at), 'MMM d, h:mm a')}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title="Deactivate User"
        description={`Deactivate ${deactivateTarget?.email}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        loading={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate({ id: deactivateTarget.id, is_active: false })}
      />
    </div>
  );
}
