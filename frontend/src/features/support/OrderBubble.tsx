import clsx from 'clsx';
import { Pill } from '../../components/ui';
import { shortDate } from '../../lib/format';
import type { VerifiedOrder } from '../../lib/types';

const STATUS_TEXT: Record<VerifiedOrder['status'], (o: VerifiedOrder) => string> = {
  DELIVERED: (o) => `delivered on ${shortDate(o.deliveredAt!)}`,
  SHIPPED: () => 'on its way to you',
  PROCESSING: () => 'still being prepared',
  CANCELLED: () => 'cancelled',
};

interface Props {
  order: VerifiedOrder;
  selectedItemIds: string[];
  onToggle: (id: string) => void;
  editable: boolean;
}

export function OrderBubble({ order, selectedItemIds, onToggle, editable }: Props) {
  return (
    <div className="space-y-3">
      <p>
        Thanks, {order.customerFirstName}. I found order <strong>{order.orderNumber}</strong>,
        placed {shortDate(order.placedAt)} and {STATUS_TEXT[order.status](order)}.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {order.items.map((item) => {
          const disabled = !editable || item.alreadyRefunded;
          const checked = selectedItemIds.includes(item.id);
          return (
            <label
              key={item.id}
              className={clsx(
                'flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0',
                disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50',
                checked && 'bg-indigo-50/60',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(item.id)}
              />
              <span className="flex-1 text-slate-800">
                {item.name}
                {item.quantity > 1 && <span className="text-slate-500"> × {item.quantity}</span>}
              </span>
              {item.isFinalSale && <Pill tone="amber">Final sale</Pill>}
              {item.alreadyRefunded && <Pill>Refunded</Pill>}
              <span className="w-20 text-right tabular-nums text-slate-600">{item.price}</span>
            </label>
          );
        })}
      </div>

      <p>
        {order.items.length > 1
          ? 'Tick the items this is about (optional), then tell me what happened in your own words.'
          : 'Tell me what happened in your own words.'}
      </p>
    </div>
  );
}
