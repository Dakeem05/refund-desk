import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '../../components/StatusBadge';
import { Card } from '../../components/ui';
import { supportApi } from '../../lib/api';
import type { DemoScenario } from '../../lib/types';

/** Shortcut for testers - fills in a seeded customer so you don't need to look them up. */
export function ScenarioPanel({ onPick }: { onPick: (scenario: DemoScenario) => void }) {
  const scenarios = useQuery({
    queryKey: ['demo-scenarios'],
    queryFn: supportApi.demoScenarios,
    staleTime: Infinity,
    retry: false,
  });

  if (!scenarios.data?.length) return null;

  return (
    <Card>
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Try a test customer</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Fills in the details from the mock CRM. Feel free to edit the message before sending.
        </p>
      </div>
      <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
        {scenarios.data.map((scenario) => (
          <li key={scenario.orderNumber}>
            <button
              type="button"
              onClick={() => onPick(scenario)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
            >
              <span>
                <span className="block text-sm text-slate-800">{scenario.title}</span>
                <span className="block text-xs text-slate-400">
                  {scenario.orderNumber} · {scenario.email}
                </span>
              </span>
              <StatusBadge status={scenario.expected} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
