import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ErrorNote, Input, Label, Textarea } from '../../components/ui';
import { adminApi } from '../../lib/api';
import { money } from '../../lib/format';
import type { RefundDetail } from '../../lib/types';

const REVIEWER_KEY = 'refund-desk.reviewer';

function savedReviewer() {
  try {
    return localStorage.getItem(REVIEWER_KEY) ?? '';
  } catch {
    return '';
  }
}

export function ResolvePanel({ request }: { request: RefundDetail }) {
  const queryClient = useQueryClient();
  const [reviewer, setReviewer] = useState(savedReviewer);
  const [note, setNote] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  const resolve = useMutation({
    mutationFn: (decision: 'APPROVED' | 'DENIED') =>
      adminApi.resolve(request.id, {
        decision,
        note: note.trim(),
        reviewer: reviewer.trim(),
        customerNote: customerNote.trim() || undefined,
      }),
    onSuccess: (updated) => {
      try {
        localStorage.setItem(REVIEWER_KEY, reviewer.trim());
      } catch {
        /* ignore */
      }
      queryClient.setQueryData(['admin', 'request', request.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });

  const ready = reviewer.trim().length >= 2 && note.trim().length >= 5;
  const proposed = request.refundAmountCents;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h3 className="text-sm font-semibold text-amber-900">Needs a decision</h3>
      <p className="mt-0.5 mb-3 text-xs text-amber-800">
        {proposed > 0
          ? `Approving refunds ${money(proposed)} for the items on this request.`
          : 'Approving refunds whatever is still refundable on the requested items.'}{' '}
        The customer gets an updated reply either way.
      </p>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div>
            <Label htmlFor="reviewer">Your name</Label>
            <Input
              id="reviewer"
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="e.g. Ada"
            />
          </div>
          <div>
            <Label htmlFor="note">Internal note (audit trail)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Photos confirm the damage"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="customer-note">Message to customer (optional)</Label>
          <Textarea
            id="customer-note"
            rows={2}
            maxLength={500}
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="Anything you'd like included in the reply"
          />
        </div>
        <ErrorNote message={resolve.error?.message} />
        <div className="flex gap-2">
          <Button
            variant="success"
            disabled={!ready}
            loading={resolve.isPending && resolve.variables === 'APPROVED'}
            onClick={() => resolve.mutate('APPROVED')}
          >
            Approve refund
          </Button>
          <Button
            variant="danger"
            disabled={!ready}
            loading={resolve.isPending && resolve.variables === 'DENIED'}
            onClick={() => resolve.mutate('DENIED')}
          >
            Deny
          </Button>
        </div>
      </div>
    </div>
  );
}
