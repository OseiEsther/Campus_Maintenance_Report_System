import { cn } from '@/lib/utils';
import type { ReportStatus } from '@/lib/types';
import { statusLabel } from '@/lib/format';

const statusStyles: Record<ReportStatus, string> = {
  open: 'bg-amber-500/10 text-amber-900 border-amber-500/25',
  in_progress: 'bg-blue-500/10 text-blue-900 border-blue-500/25',
  resolved: 'bg-emerald-500/10 text-emerald-900 border-emerald-500/25',
};

const dotStyles: Record<ReportStatus, string> = {
  open: 'bg-amber-500 ring-2 ring-amber-500/20',
  in_progress: 'bg-blue-500 ring-2 ring-blue-500/20 animate-pulse',
  resolved: 'bg-emerald-600 ring-2 ring-emerald-500/20',
};

export function StatusBadge({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
        statusStyles[status],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotStyles[status])} />
      {statusLabel(status)}
    </span>
  );
}
