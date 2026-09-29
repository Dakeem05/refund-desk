import { useState } from 'react';
import { Button } from '../components/ui';
import { ChatWindow } from '../features/support/ChatWindow';
import { Composer } from '../features/support/Composer';
import { LookupForm } from '../features/support/LookupForm';
import { ScenarioPanel } from '../features/support/ScenarioPanel';
import { StatusLookup } from '../features/support/StatusLookup';
import { useRefundConversation } from '../features/support/useRefundConversation';
import type { DemoScenario } from '../lib/types';

export function SupportPage() {
  const chat = useRefundConversation();
  const [prefill, setPrefill] = useState<DemoScenario | null>(null);

  const pickScenario = (scenario: DemoScenario) => {
    chat.reset();
    setPrefill(scenario);
  };

  const send = async (text: string) => {
    const ok = await chat.submit(text);
    if (ok) setPrefill(null);
    return ok;
  };

  const footer = (() => {
    switch (chat.stage) {
      case 'identify':
        return <LookupForm onVerify={chat.verify} prefill={prefill} />;
      case 'describe':
      case 'submitting':
        return (
          <Composer
            disabled={chat.stage === 'submitting'}
            onSend={send}
            prefill={prefill?.orderNumber === chat.order?.orderNumber ? prefill?.message : null}
          />
        );
      case 'done':
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={chat.followUpSameOrder}>
              Something else on this order
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setPrefill(null);
                chat.reset();
              }}
            >
              Start over with another order
            </Button>
          </div>
        );
    }
  })();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <section>
        <ChatWindow
          messages={chat.messages}
          stage={chat.stage}
          selectedItemIds={chat.selectedItemIds}
          onToggleItem={chat.toggleItem}
          footer={footer}
        />
      </section>
      <aside className="space-y-6">
        <StatusLookup />
        <ScenarioPanel onPick={pickScenario} />
      </aside>
    </div>
  );
}
