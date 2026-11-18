import { cn } from '../../lib/utils';
import { SkeletonLoader } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

export function DataTable({ columns, data = [], loading = false, onRowClick, empty }) {
  if (loading) {
    return <SkeletonLoader variant="table" rows={6} />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={empty?.icon}
        title={empty?.title || 'No data available'}
        description={empty?.description || 'There are no records matching your criteria.'}
        actionLabel={empty?.actionLabel}
        onAction={empty?.onAction}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-obsidian-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-obsidian-200 bg-obsidian-50 text-xs font-semibold uppercase tracking-wider text-obsidian-600">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-3', col.className)}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian-100">
            {data.map((row, idx) => (
              <tr
                key={row.id || idx}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  idx % 2 === 1 ? 'bg-obsidian-50/40' : 'bg-white',
                  onRowClick && 'cursor-pointer hover:bg-amber-50/40 transition-colors'
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-obsidian-800', col.cellClassName)}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
