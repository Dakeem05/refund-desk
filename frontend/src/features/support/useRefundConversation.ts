import { useCallback, useRef, useState } from 'react';
import { ApiError, supportApi } from '../../lib/api';
import { newIdempotencyKey } from '../../lib/format';
import type { CustomerRefundResult, VerifiedOrder } from '../../lib/types';

export type ChatMessage =
  | { id: string; from: 'assistant'; kind: 'text'; text: string; tone?: 'error' }
  | { id: string; from: 'customer'; kind: 'text'; text: string }
  | { id: string; from: 'assistant'; kind: 'order'; order: VerifiedOrder }
  | { id: string; from: 'assistant'; kind: 'result'; result: CustomerRefundResult }
  | { id: string; from: 'assistant'; kind: 'typing' };

export type Stage = 'identify' | 'describe' | 'submitting' | 'done';

const GREETING: ChatMessage = {
  id: 'greeting',
  from: 'assistant',
  kind: 'text',
  text: "Hi there! I can help you request a refund. To start, enter the email address you ordered with and your order number - you'll find it in your confirmation email.",
};

let counter = 0;
const nextId = () => `m${++counter}`;

/**
 * Keeps the chat flow in one place: identify the order -> describe the problem -> show decision.
 * The page component only renders what this gives it.
 */
export function useRefundConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [stage, setStage] = useState<Stage>('identify');
  const [identity, setIdentity] = useState<{ email: string; orderNumber: string } | null>(null);
  const [order, setOrder] = useState<VerifiedOrder | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Re-used if the same message is retried after a network blip, so we never double-submit
  const pendingKey = useRef<{ message: string; key: string } | null>(null);

  const push = (message: ChatMessage) => setMessages((prev) => [...prev, message]);
  const dropTyping = () => setMessages((prev) => prev.filter((m) => m.kind !== 'typing'));

  const verify = useCallback(async (email: string, orderNumber: string) => {
    const verified = await supportApi.verifyOrder(email, orderNumber);
    setIdentity({ email, orderNumber: verified.orderNumber });
    setOrder(verified);
    setSelectedItemIds([]);
    push({
      id: nextId(),
      from: 'customer',
      kind: 'text',
      text: `${verified.orderNumber} · ${email}`,
    });
    push({ id: nextId(), from: 'assistant', kind: 'order', order: verified });
    setStage('describe');
    return verified;
  }, []);

  const submit = useCallback(
    async (text: string) => {
      if (!identity) return false;
      const message = text.trim();

      if (pendingKey.current?.message !== message) {
        pendingKey.current = { message, key: newIdempotencyKey() };
      }

      push({ id: nextId(), from: 'customer', kind: 'text', text: message });
      push({ id: nextId(), from: 'assistant', kind: 'typing' });
      setStage('submitting');

      try {
        const result = await supportApi.submitRefund(
          {
            email: identity.email,
            orderNumber: identity.orderNumber,
            message,
            itemIds: selectedItemIds.length ? selectedItemIds : undefined,
          },
          pendingKey.current.key,
        );
        pendingKey.current = null;
        dropTyping();
        push({ id: nextId(), from: 'assistant', kind: 'result', result });
        setStage('done');
        return true;
      } catch (error) {
        dropTyping();
        const text =
          error instanceof ApiError
            ? error.message
            : 'Something went wrong on our side. Please try again.';
        push({ id: nextId(), from: 'assistant', kind: 'text', text, tone: 'error' });
        setStage('describe');
        return false;
      }
    },
    [identity, selectedItemIds],
  );

  const toggleItem = useCallback((id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const followUpSameOrder = useCallback(() => {
    push({
      id: nextId(),
      from: 'assistant',
      kind: 'text',
      text: 'Sure - what else can I help with on this order?',
    });
    setSelectedItemIds([]);
    setStage('describe');
  }, []);

  const reset = useCallback(() => {
    pendingKey.current = null;
    setMessages([GREETING]);
    setIdentity(null);
    setOrder(null);
    setSelectedItemIds([]);
    setStage('identify');
  }, []);

  return {
    messages,
    stage,
    order,
    selectedItemIds,
    verify,
    submit,
    toggleItem,
    followUpSameOrder,
    reset,
  };
}
