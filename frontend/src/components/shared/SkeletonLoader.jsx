import { cn } from '../../lib/utils';

export function SkeletonLoader({ variant = 'card', rows = 5, className }) {
  if (variant === 'kpi') {
    return (
      <div className={cn('card animate-pulse space-y-3', className)}>
        <div className="h-3 w-24 rounded bg-obsidian-200" />
        <div className="h-8 w-32 rounded bg-obsidian-200" />
        <div className="h-4 w-20 rounded bg-obsidian-100" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('card animate-pulse space-y-3 p-4', className)}>
        <div className="h-8 w-full rounded bg-obsidian-100" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-obsidian-50" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('card animate-pulse space-y-3', className)}>
      <div className="h-4 w-1/3 rounded bg-obsidian-200" />
      <div className="h-24 w-full rounded bg-obsidian-100" />
    </div>
  );
}
