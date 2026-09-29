import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { ErrorNote, Pill, Spinner } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { dateTime, humanize, money, REASON_LABELS, shortDate } from '../../lib/format';
import type { AuditEvent, CheckResult, RefundDetail } from '../../lib/types';
import { ResolvePanel } from './ResolvePanel';

export function RequestDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['admin', 'request', id],
    queryFn: () => adminApi.detail(id),
  });

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/20" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          {detail.data ? (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-base font-semibold text-slate-900">
                  {detail.data.reference}
                </h2>
                <StatusBadge status={detail.data.status} />
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {dateTime(detail.data.createdAt)} · order {detail.data.order.orderNumber}
                {detail.data.resolvedBy &&
                  ` · automated decision was ${detail.data.automatedDecision.toLowerCase()}, resolved by ${detail.data.resolvedBy}`}
              </p>
            </div>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {detail.isLoading && <Spinner className="mx-auto mt-10 h-6 w-6 text-slate-400" />}
          <ErrorNote message={detail.error?.message} />
          {detail.data && <DetailBody request={detail.data} />}
        </div>
      </aside>
    </div>
  );
}

function DetailBody({ request }: { request: RefundDetail }) {
  const c = request.classification;
  return (
    <>
      {request.status === 'ESCALATED' && <ResolvePanel request={request} />}

      {request.resolvedBy && (
        <Section title="Agent decision">
          <p className="text-sm text-slate-700">
            <strong>{request.resolvedBy}</strong>{' '}
            {request.status === 'APPROVED' ? 'approved' : 'denied'} this on{' '}
            {dateTime(request.resolvedAt!)}: “{request.resolutionNote}”
          </p>
        </Section>
      )}

      <Section title="Customer message">
        <blockquote className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-sm whitespace-pre-line text-slate-700">
          {request.customerMessage}
        </blockquote>
      </Section>

      {c && (
        <Section title="How the AI read it" aside={`${request.aiProvider} · ${request.aiModel}`}>
          <div className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm">
            {c.manipulationAttempt && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-rose-700">
                Possible manipulation attempt{c.manipulationNotes ? `: ${c.manipulationNotes}` : ''}
              </p>
            )}
            <p className="text-slate-800">{c.summary}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span>
                Reason:{' '}
                <strong className="text-slate-700">{REASON_LABELS[c.reason] ?? c.reason}</strong>
              </span>
              <span className="flex items-center gap-2">
                Confidence
                <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className={clsx(
                      'block h-full',
                      c.confidence >= 0.6 ? 'bg-emerald-500' : 'bg-amber-500',
                    )}
                    style={{ width: `${Math.round(c.confidence * 100)}%` }}
                  />
                </span>
                {Math.round(c.confidence * 100)}%
              </span>
              {c.requestedAmountCents !== null && (
                <span>Asked for {money(c.requestedAmountCents)}</span>
              )}
              {request.processingMs !== null && (
                <span>Decided in {(request.processingMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>
        </Section>
      )}

      {request.policyChecks.length > 0 && (
        <Section title="Policy checks">
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {request.policyChecks.map((check) => (
              <li key={check.code} className="flex gap-3 px-4 py-2.5 text-sm">
                <CheckIcon result={check.result} />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    {check.label}
                    {!check.customerVisible && (
                      <span className="ml-2 text-xs font-normal text-slate-400">internal</span>
                    )}
                  </p>
                  <p className="text-slate-600">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Order"
        aside={`${humanize(request.order.status)}${request.order.deliveredAt ? ` ${shortDate(request.order.deliveredAt)}` : ''}`}
      >
        <table className="w-full rounded-lg text-sm">
          <tbody className="divide-y divide-slate-100">
            {request.order.items.map((item) => (
              <tr key={item.id} className={clsx(item.requested && 'bg-indigo-50/60')}>
                <td className="px-3 py-2">
                  <p className="text-slate-800">
                    {item.name}{' '}
                    {item.quantity > 1 && <span className="text-slate-400">× {item.quantity}</span>}
                  </p>
                  <p className="text-xs text-slate-400">{item.sku}</p>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.requested && <Pill tone="indigo">In request</Pill>}
                    {item.isFinalSale && <Pill tone="amber">Final sale</Pill>}
                    {item.refundedQuantity > 0 && <Pill>Refunded</Pill>}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(item.unitPriceCents * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Customer">
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-slate-800">{request.customer.name}</span>{' '}
            <span className="text-slate-500">{request.customer.email}</span>
          </p>
          <p className="text-xs text-slate-500">
            Customer since {shortDate(request.customer.customerSince)} ·{' '}
            {request.customer.refundsLast90Days} approved refund
            {request.customer.refundsLast90Days === 1 ? '' : 's'} in the last 90 days
          </p>
          {request.customer.isFlagged && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800">
              Flagged by risk team
              {request.customer.riskNote ? `: ${request.customer.riskNote}` : ''}
            </p>
          )}
          {request.customerHistory.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
              {request.customerHistory.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-3 py-2">
                  <span className="font-mono text-slate-600">{h.reference}</span>
                  <span className="text-slate-400">
                    {h.orderNumber} · {shortDate(h.createdAt)}
                  </span>
                  <StatusBadge status={h.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {request.customerReply && (
        <Section title="Reply sent to customer">
          <p className="rounded-lg bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
            {request.customerReply}
          </p>
        </Section>
      )}

      <Section title="Audit trail">
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {request.auditTrail.map((event) => (
            <AuditItem key={event.id} event={event} />
          ))}
        </ol>
      </Section>
    </>
  );
}

function AuditItem({ event }: { event: AuditEvent }) {
  const colour =
    event.type === 'HUMAN_REVIEW'
      ? 'bg-indigo-500'
      : event.type === 'REPLY_REJECTED' || event.type === 'AI_FALLBACK'
        ? 'bg-amber-500'
        : event.actor === 'ai'
          ? 'bg-violet-500'
          : 'bg-slate-400';
  return (
    <li className="relative">
      <span
        className={clsx(
          'absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white',
          colour,
        )}
      />
      <p className="text-xs text-slate-400">
        {dateTime(event.createdAt)} · {humanize(event.type)} · {event.actor}
      </p>
      <p className="text-sm text-slate-700">{event.summary}</p>
      {event.data && Object.keys(event.data).length > 0 && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-600">Details</summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}

function CheckIcon({ result }: { result: CheckResult }) {
  const map: Record<CheckResult, { symbol: string; className: string }> = {
    PASS: { symbol: '✓', className: 'bg-emerald-100 text-emerald-700' },
    FAIL: { symbol: '✕', className: 'bg-rose-100 text-rose-700' },
    REVIEW: { symbol: '!', className: 'bg-amber-100 text-amber-800' },
    INFO: { symbol: 'i', className: 'bg-slate-100 text-slate-600' },
  };
  const { symbol, className } = map[result];
  return (
    <span
      className={clsx(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        className,
      )}
    >
      {symbol}
    </span>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
        {aside && <span className="text-xs text-slate-400">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
