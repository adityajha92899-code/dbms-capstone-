import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Eye,
  EyeOff,
  MapPin,
  ShieldCheck,
  Zap,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_HOME } from '../../lib/constants';
import { Button } from '../../components/ui/button';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@tms.com', password: 'Admin@123' },
  { label: 'Dispatcher', email: 'dispatcher@tms.com', password: 'Dispatch@123' },
  { label: 'Driver', email: 'driver1@tms.com', password: 'Driver@123' },
  { label: 'Customer', email: 'customer1@tms.com', password: 'Customer@123' },
];

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.full_name}`);
      navigate(ROLE_HOME[user.role] || '/admin/dashboard');
    } catch (err) {
      let msg = 'Invalid credentials';
      if (!err.response || err.code === 'ERR_NETWORK') {
        msg = 'Cannot connect to backend server. Make sure your backend is running and VITE_API_URL is configured.';
      } else if (err.response?.status === 404) {
        msg = 'Backend API endpoint not found. Please check VITE_API_URL in your environment variables.';
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      }
      setServerError(msg);
      toast.error(msg);
    }
  };

  const handleDemoLogin = (demo) => {
    setValue('email', demo.email, { shouldValidate: true });
    setValue('password', demo.password, { shouldValidate: true });
    setTimeout(() => {
      handleSubmit(onSubmit)();
    }, 300);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT PANEL */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-obsidian-900 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(#F59E0B 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-obsidian-900">
            <Truck className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">FleetFlow TMS</span>
        </div>

        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Logistics, reimagined.
          </h1>
          <p className="text-base text-obsidian-300">
            Real-time tracking. Fleet health. Smart dispatch.
          </p>

          <ul className="space-y-4 pt-2">
            <li className="flex items-center gap-3 text-sm text-obsidian-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <MapPin className="h-4 w-4" />
              </div>
              <span>Live GPS telemetry across every active corridor</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-obsidian-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span>Automated license &amp; vehicle overlap protection</span>
            </li>
            <li className="flex items-center gap-3 text-sm text-obsidian-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Zap className="h-4 w-4" />
              </div>
              <span>Instant customer booking quotes and invoicing</span>
            </li>
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-obsidian-800 pt-6 text-xs text-obsidian-400">
          <span className="font-mono">12,000+ shipments moved | 99.2% on-time</span>
          <Truck className="h-5 w-5 animate-pulse text-accent" />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex items-center justify-center bg-surface px-4 py-10">
        <div className="w-full max-w-md rounded-lg border border-obsidian-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-obsidian-900">Welcome back</h2>
            <p className="mt-1 text-sm text-obsidian-500">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-obsidian-700">
                Email
              </label>
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
              <label className="mb-1 block text-xs font-medium text-obsidian-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-obsidian-400 hover:text-obsidian-700"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-status-danger">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-obsidian-600">
                <input
                  type="checkbox"
                  className="rounded border-obsidian-300 text-accent focus:ring-accent"
                  {...register('rememberMe')}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => toast.info('Contact your FleetFlow administrator to reset your password.')}
                className="font-medium text-accent-hover hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {serverError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In →</span>
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-obsidian-200" />
            <span className="text-xs text-obsidian-400">or continue with demo</span>
            <div className="h-px flex-1 bg-obsidian-200" />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.label}
                type="button"
                disabled={isLoading}
                onClick={() => handleDemoLogin(demo)}
                className="rounded-lg border border-obsidian-200 bg-obsidian-50 px-2.5 py-1.5 text-xs font-medium text-obsidian-700 transition-colors hover:border-accent hover:bg-amber-50 hover:text-obsidian-900 disabled:opacity-50"
              >
                {demo.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
