import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { ROLE_HOME } from '../lib/constants';
import { Button } from '../components/ui/button';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.full_name}`);
      navigate(ROLE_HOME[user.role] || '/');
    } catch (err) {
      const msg =
        !err.response || err.code === 'ERR_NETWORK'
          ? 'Cannot connect to backend server. Make sure VITE_API_URL is configured.'
          : err.response?.data?.error || 'Invalid credentials';
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-obsidian-900 px-4">
      <div className="w-full max-w-md rounded-lg border border-obsidian-800 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-obsidian-900">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-obsidian-900">FleetFlow TMS</h1>
            <p className="text-xs text-obsidian-500">Sign in to your operations workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-obsidian-700">Email</label>
            <input
              type="email"
              className="input"
              placeholder="admin@tms.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-status-danger">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-obsidian-700">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-status-danger">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
