import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export function KpiCard({ label, value, trend, trendLabel, icon: Icon, accent = false }) {
  const isPositive = Number(trend) >= 0;

  return (
    <div
      className={cn(
        'card flex flex-col justify-between gap-3',
        accent && 'border-accent/40 bg-amber-50/30'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-obsidian-500">
          {label}
        </span>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-obsidian-100 text-obsidian-700">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="font-mono text-3xl font-bold tracking-tight text-obsidian-900">
        {value}
      </div>

      {trend !== undefined && trend !== null && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium',
              isPositive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {isPositive ? `+${trend}%` : `${trend}%`}
          </span>
          {trendLabel && <span className="text-obsidian-500">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}
