import clsx from 'clsx';
import { StatusBadge } from '../../components/StatusBadge';
import { Pill } from '../../components/ui';
import { humanize, money, REASON_LABELS, timeAgo } from '../../lib/format';
import type { RefundListItem } from '../../lib/types';

interface Props {
  rows: RefundListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RequestsTable({ rows, selectedId, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-16 text-center text-sm text-slate-500">
        No refund requests match these filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Request</th>
            <th className="px-4 py-2.5">Customer</th>
            <th className="px-4 py-2.5">What they said</th>
            <th className="px-4 py-2.5 text-right">Amount</th>
            <th className="px-4 py-2.5">Decision</th>
            <th className="px-4 py-2.5">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row.id)}
              className={clsx(
                'cursor-pointer align-top hover:bg-slate-50',
                selectedId === row.id && 'bg-indigo-50/60 hover:bg-indigo-50',
              )}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <p className="font-mono text-xs text-slate-900">{row.reference}</p>
                <p className="text-xs text-slate-400">
                  {row.orderNumber} · {timeAgo(row.createdAt)}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="text-slate-800">{row.customer.name}</p>
                <p className="text-xs text-slate-400">{row.customer.email}</p>
              </td>
              <td className="max-w-sm px-4 py-3">
                {row.reason && (
                  <p className="text-xs font-medium text-slate-500">
                    {REASON_LABELS[row.reason] ?? row.reason}
                  </p>
                )}
                <p className="line-clamp-2 text-slate-700">{row.summary ?? '—'}</p>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                {row.refundAmountCents === 0 ? (
                  <span className="text-slate-400">—</span>
                ) : row.status === 'ESCALATED' ? (
                  <span
                    className="text-slate-400"
                    title="Amount that would be refunded if approved"
                  >
                    {money(row.refundAmountCents)}
                    <span className="block text-[11px]">proposed</span>
                  </span>
                ) : (
                  money(row.refundAmountCents)
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
                <p className="mt-1 text-xs text-slate-400">
                  {row.humanReviewed ? 'by agent' : humanize(row.decisionCode)}
                </p>
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-[180px] flex-wrap gap-1">
                  {row.flags.slice(0, 3).map((flag) => (
                    <Pill key={flag} tone={flag === 'MANIPULATION_SUSPECTED' ? 'rose' : 'amber'}>
                      {humanize(flag)}
                    </Pill>
                  ))}
                  {row.flags.length > 3 && <Pill>+{row.flags.length - 3}</Pill>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
