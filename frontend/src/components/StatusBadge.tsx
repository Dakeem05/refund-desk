import clsx from 'clsx';
import type { RefundStatus } from '../lib/types';

const styles: Record<RefundStatus, { label: string; className: string; dot: string }> = {
  APPROVED: {
    label: 'Approved',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  DENIED: {
    label: 'Denied',
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
  },
  ESCALATED: {
    label: 'Escalated',
    className: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
  },
};

export function StatusBadge({ status, label }: { status: RefundStatus; label?: string }) {
  const style = styles[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        style.className,
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', style.dot)} />
      {label ?? style.label}
    </span>
  );
}
