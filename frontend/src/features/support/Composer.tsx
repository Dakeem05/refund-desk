import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Textarea } from '../../components/ui';

const MAX = 2000;

interface Props {
  disabled: boolean;
  onSend: (text: string) => Promise<boolean>;
  prefill?: string | null;
}

export function Composer({ disabled, onSend, prefill }: Props) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefill) setText(prefill);
    ref.current?.focus();
  }, [prefill]);

  const tooShort = text.trim().length < 10;

  const send = async (event?: FormEvent) => {
    event?.preventDefault();
    if (disabled || tooShort) return;
    const draft = text;
    setText('');
    const ok = await onSend(draft);
    if (!ok) setText(draft); // give it back so they don't have to retype
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  return (
    <form onSubmit={send} className="space-y-2">
      <Textarea
        ref={ref}
        rows={3}
        maxLength={MAX}
        placeholder="e.g. The headphones arrived with a cracked ear cup and the left side has no sound."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Enter to send · Shift+Enter for a new line</span>
        <div className="flex items-center gap-3">
          <span className={text.length > MAX - 100 ? 'text-amber-600' : ''}>
            {text.length}/{MAX}
          </span>
          <Button type="submit" disabled={disabled || tooShort}>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
