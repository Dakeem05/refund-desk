import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import type { CustomerRefundResult } from '../../lib/types';

export function ResultBubble({ result }: { result: CustomerRefundResult }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - not a big deal */
    }
  };

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line">{result.reply}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
        <StatusBadge status={result.status} label={result.statusLabel} />
        {result.refundAmount && (
          <span className="font-medium text-emerald-700">Refund: {result.refundAmount}</span>
        )}
        <button
          type="button"
          onClick={copy}
          className="ml-auto rounded-md px-1.5 py-0.5 font-mono hover:bg-slate-200"
          title="Copy reference"
        >
          {copied ? 'Copied!' : result.reference}
        </button>
      </div>
    </div>
  );
}
