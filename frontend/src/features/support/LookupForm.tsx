import { useEffect, useState, type FormEvent } from 'react';
import { Button, ErrorNote, Input, Label } from '../../components/ui';
import { ApiError } from '../../lib/api';

interface Props {
  onVerify: (email: string, orderNumber: string) => Promise<unknown>;
  prefill?: { email: string; orderNumber: string } | null;
}

export function LookupForm({ onVerify, prefill }: Props) {
  const [email, setEmail] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefill) {
      setEmail(prefill.email);
      setOrderNumber(prefill.orderNumber);
      setError(null);
    }
  }, [prefill]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onVerify(email.trim(), orderNumber.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="order">Order number</Label>
          <Input
            id="order"
            placeholder="WN-10421"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
        </div>
      </div>
      <ErrorNote message={error} />
      <Button type="submit" loading={loading} className="w-full sm:w-auto">
        Find my order
      </Button>
    </form>
  );
}
