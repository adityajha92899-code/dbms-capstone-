import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/button';

const pwdSchema = z
  .object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export function ProfilePage({ title = 'Profile & Preferences' }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('Profile');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwdError, setPwdError] = useState('');
  const [notifSettings, setNotifSettings] = useState({
    tripUpdates: true,
    maintenanceAlerts: true,
    bookingAlerts: true,
  });

  const profileMutation = useMutation({
    mutationFn: async (payload) => (await api.patch('/api/v1/auth/profile', payload)).data,
    onSuccess: () => toast.success('Profile preferences saved'),
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: async (payload) => (await api.patch('/api/v1/auth/password', payload)).data,
    onSuccess: () => {
      toast.success('Password changed');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to change password'),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={title} description="Manage your account details, security, and alerts." />

      <div className="flex gap-2 border-b border-obsidian-200 pb-3">
        {['Profile', 'Security', 'Notifications'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium ${
              tab === t ? 'bg-obsidian-900 text-white' : 'bg-obsidian-100 text-obsidian-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Profile' && (
        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            profileMutation.mutate({ full_name: fullName, phone });
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium">Email (read-only)</label>
            <input className="input" disabled value={user?.email || ''} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Full Name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={profileMutation.isPending}>
            Save Profile
          </Button>
        </form>
      )}

      {tab === 'Security' && (
        <form
          className="card space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = pwdSchema.safeParse(pwdForm);
            if (!parsed.success) {
              setPwdError(parsed.error.issues[0]?.message || 'Invalid password input');
              return;
            }
            setPwdError('');
            passwordMutation.mutate({
              currentPassword: pwdForm.currentPassword,
              newPassword: pwdForm.newPassword,
            });
          }}
        >
          <input
            type="password"
            className="input"
            placeholder="Current Password"
            value={pwdForm.currentPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
          />
          <input
            type="password"
            className="input"
            placeholder="New Password"
            value={pwdForm.newPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
          />
          <input
            type="password"
            className="input"
            placeholder="Confirm New Password"
            value={pwdForm.confirmPassword}
            onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
          />
          {pwdError && <p className="text-xs text-status-danger">{pwdError}</p>}
          <Button type="submit" disabled={passwordMutation.isPending}>
            Change Password
          </Button>
        </form>
      )}

      {tab === 'Notifications' && (
        <div className="card space-y-4">
          {[
            { key: 'tripUpdates', label: 'Email alerts for trip status updates' },
            { key: 'maintenanceAlerts', label: 'Email alerts for maintenance & compliance' },
            { key: 'bookingAlerts', label: 'Email alerts for new bookings' },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between text-sm">
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={notifSettings[item.key]}
                onChange={(e) =>
                  setNotifSettings({ ...notifSettings, [item.key]: e.target.checked })
                }
              />
            </label>
          ))}
          <Button
            onClick={() => profileMutation.mutate({ settings: notifSettings })}
            disabled={profileMutation.isPending}
          >
            Save Preferences
          </Button>
        </div>
      )}
    </div>
  );
}
