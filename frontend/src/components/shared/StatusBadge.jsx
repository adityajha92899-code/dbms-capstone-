import { STATUS_COLORS } from '../../lib/constants';
import { cn } from '../../lib/utils';

export function StatusBadge({ status, className }) {
  const key = String(status || '').toLowerCase();
  const colorClass = STATUS_COLORS[key] || 'bg-slate-100 text-slate-700';

  return (
    <span className={cn('badge', colorClass, className)}>
      {String(status || 'unknown').replace(/_/g, ' ')}
    </span>
  );
}
