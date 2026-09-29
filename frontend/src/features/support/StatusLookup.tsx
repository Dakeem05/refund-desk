import { useState, type FormEvent } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Button, Card, ErrorNote, Input } from '../../components/ui';
import { ApiError, supportApi } from '../../lib/api';
import { dateTime } from '../../lib/format';
import type { CustomerRefundResult } from '../../lib/types';

export function StatusLookup() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<CustomerRefundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await supportApi.getRequest(reference.trim(), email.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">Already sent a request?</h2>
      <p className="mt-0.5 mb-3 text-xs text-slate-500">
        Check where it's at with your reference number.
      </p>
      <form onSubmit={submit} className="space-y-2">
        <Input
          placeholder="RF-XXXXXX"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="secondary" loading={loading} className="w-full">
          Check status
        </Button>
      </form>
      <div className="mt-3 space-y-2">
        <ErrorNote message={error} />
        {result && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <StatusBadge status={result.status} label={result.statusLabel} />
              <span className="text-xs text-slate-400">Updated {dateTime(result.updatedAt)}</span>
            </div>
            <p className="text-slate-700">{result.reply}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
