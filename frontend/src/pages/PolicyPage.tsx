import { useQuery } from '@tanstack/react-query';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, ErrorNote, Spinner } from '../components/ui';
import { supportApi } from '../lib/api';

export function PolicyPage() {
  const policy = useQuery({ queryKey: ['policy'], queryFn: supportApi.policy });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card className="p-8">
        {policy.isLoading && <Spinner className="mx-auto h-6 w-6 text-slate-400" />}
        <ErrorNote message={policy.error?.message} />
        {policy.data && (
          <article className="prose prose-slate max-w-none prose-table:text-sm prose-th:text-left">
            <Markdown remarkPlugins={[remarkGfm]}>{policy.data.markdown}</Markdown>
          </article>
        )}
      </Card>
    </div>
  );
}
