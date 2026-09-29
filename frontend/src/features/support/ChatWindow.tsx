import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage, Stage } from './useRefundConversation';
import { OrderBubble } from './OrderBubble';
import { ResultBubble } from './ResultBubble';

interface Props {
  messages: ChatMessage[];
  stage: Stage;
  selectedItemIds: string[];
  onToggleItem: (id: string) => void;
  footer: ReactNode;
}

export function ChatWindow({ messages, stage, selectedItemIds, onToggleItem, footer }: Props) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          RD
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Refunds assistant</p>
          <p className="text-xs text-slate-500">Usually replies in a few seconds</p>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-5 py-5">
        {messages.map((message) => (
          <Bubble
            key={message.id}
            from={message.from}
            tone={
              message.kind === 'text' && message.from === 'assistant' ? message.tone : undefined
            }
          >
            {message.kind === 'text' && <p className="whitespace-pre-line">{message.text}</p>}
            {message.kind === 'order' && (
              <OrderBubble
                order={message.order}
                selectedItemIds={selectedItemIds}
                onToggle={onToggleItem}
                editable={stage === 'describe'}
              />
            )}
            {message.kind === 'result' && <ResultBubble result={message.result} />}
            {message.kind === 'typing' && <Typing />}
          </Bubble>
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-t border-slate-200 bg-white px-5 py-4">{footer}</div>
    </div>
  );
}

function Bubble({
  from,
  tone,
  children,
}: {
  from: 'assistant' | 'customer';
  tone?: 'error';
  children: ReactNode;
}) {
  const mine = from === 'customer';
  return (
    <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          mine && 'rounded-br-md bg-indigo-600 text-white',
          !mine &&
            tone === 'error' &&
            'rounded-bl-md bg-rose-50 text-rose-800 ring-1 ring-rose-200',
          !mine && !tone && 'rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <span className="flex gap-1">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
      </span>
      <span className="text-xs">Checking your order against our refund policy…</span>
    </div>
  );
}
