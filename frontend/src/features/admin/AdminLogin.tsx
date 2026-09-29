import { useState, type FormEvent } from 'react';
import { Button, Card, ErrorNote, Input, Label } from '../../components/ui';
import { adminApi, ApiError } from '../../lib/api';
import { setAdminKey } from '../../lib/adminKey';

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAdminKey(key.trim());
    try {
      await adminApi.session();
      onSuccess();
    } catch (err) {
      setAdminKey(null);
      setError(
        err instanceof ApiError && err.status === 401
          ? "That key didn't work."
          : (err as Error).message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      <Card className="p-6">
        <h1 className="text-lg font-semibold text-slate-900">Support dashboard</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">
          Enter the admin key to review refund requests. It's{' '}
          <code className="rounded bg-slate-100 px-1">ADMIN_API_KEY</code> in your{' '}
          <code className="rounded bg-slate-100 px-1">.env</code>.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="admin-key">Admin key</Label>
            <Input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoFocus
              required
            />
          </div>
          <ErrorNote message={error} />
          <Button type="submit" loading={loading} className="w-full">
            Open dashboard
          </Button>
        </form>
      </Card>
    </div>
  );
}
