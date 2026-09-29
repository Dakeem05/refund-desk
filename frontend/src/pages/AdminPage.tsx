import { keepPreviousData, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { Button, Card, ErrorNote, Input } from '../components/ui';
import { AdminLogin } from '../features/admin/AdminLogin';
import { RequestDrawer } from '../features/admin/RequestDrawer';
import { RequestsTable } from '../features/admin/RequestsTable';
import { StatsBar } from '../features/admin/StatsBar';
import { adminApi, ApiError } from '../lib/api';
import { getAdminKey, setAdminKey } from '../lib/adminKey';

const TABS = [
  { value: '', label: 'All' },
  { value: 'ESCALATED', label: 'Awaiting review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
];

export function AdminPage() {
  const [authed, setAuthed] = useState(() => Boolean(getAdminKey()));
  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;
  return (
    <Dashboard
      onSignOut={() => {
        setAdminKey(null);
        setAuthed(false);
      }}
    />
  );
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [status, setStatus] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Debounce search so we're not querying on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const session = useQuery({
    queryKey: ['admin', 'session'],
    queryFn: adminApi.session,
    staleTime: Infinity,
  });
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    refetchInterval: 15_000,
  });
  const list = useQuery({
    queryKey: ['admin', 'list', { status, flagged, search, page }],
    queryFn: () => adminApi.list({ status, flagged, search, page }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  // Key was rotated or is wrong - send them back to the login screen
  useEffect(() => {
    const error = list.error ?? stats.error;
    if (error instanceof ApiError && error.status === 401) onSignOut();
  }, [list.error, stats.error, onSignOut]);

  const meta = list.data?.meta;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Refund requests</h1>
          <p className="text-sm text-slate-500">
            Automated decisions, AI notes and everything waiting on a person.
            {session.data && (
              <span className="ml-2 rounded-md bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">
                AI: {session.data.ai.provider} · {session.data.ai.model}
              </span>
            )}
          </p>
        </div>
        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </div>

      <StatsBar stats={stats.data} />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  status === tab.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {tab.label}
                {tab.value === 'ESCALATED' && stats.data?.awaitingReview ? (
                  <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                    {stats.data.awaitingReview}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={flagged}
              onChange={(e) => {
                setFlagged(e.target.checked);
                setPage(1);
              }}
            />
            Flagged only
          </label>
          <Input
            className="ml-auto max-w-xs"
            placeholder="Search reference, order, customer…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <ErrorNote message={list.error?.message} />
        {list.data && (
          <RequestsTable rows={list.data.data} selectedId={selectedId} onSelect={setSelectedId} />
        )}
        {list.isLoading && (
          <p className="px-4 py-16 text-center text-sm text-slate-400">Loading…</p>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
            <span>
              Page {meta.page} of {meta.totalPages} · {meta.total} requests
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {selectedId && <RequestDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
