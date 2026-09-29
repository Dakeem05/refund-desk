import type { DashboardStats } from '../../lib/types';
import { money } from '../../lib/format';

export function StatsBar({ stats }: { stats: DashboardStats | undefined }) {
  const tiles = [
    {
      label: 'Requests',
      value: stats?.total,
      hint: `${stats?.automationRate ?? 0}% decided automatically`,
    },
    {
      label: 'Awaiting review',
      value: stats?.awaitingReview,
      hint: `${stats?.humanResolved ?? 0} resolved by agents`,
      accent: 'text-amber-600',
    },
    {
      label: 'Approved',
      value: stats?.approved,
      hint: `${money(stats?.refundedAmountCents ?? 0)} refunded`,
      accent: 'text-emerald-600',
    },
    { label: 'Denied', value: stats?.denied, accent: 'text-rose-600' },
    { label: 'Flagged', value: stats?.flagged, hint: 'risk, mismatch or manipulation' },
    {
      label: 'Avg. decision time',
      value: stats ? formatDuration(stats.avgProcessingMs) : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium text-slate-500">{tile.label}</p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${tile.accent ?? 'text-slate-900'}`}
          >
            {tile.value ?? '–'}
          </p>
          {tile.hint && <p className="mt-0.5 truncate text-xs text-slate-400">{tile.hint}</p>}
        </div>
      ))}
    </div>
  );
}

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}
