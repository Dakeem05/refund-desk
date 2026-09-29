import { RefundReason } from '../../refunds/entities/refund-request.entity';
import { HeuristicProvider } from './heuristic.provider';

const items = [
  {
    id: 'shoes',
    name: 'Stride Trail Running Shoes (EU 44)',
    sku: 'S1',
    unitPriceCents: 11900,
    quantity: 1,
  },
  {
    id: 'socks',
    name: 'Merino Running Socks 3-Pack',
    sku: 'S2',
    unitPriceCents: 2400,
    quantity: 1,
  },
];

describe('HeuristicProvider', () => {
  const provider = new HeuristicProvider();
  const classify = (message: string) =>
    provider.classify({ message, items, orderStatus: 'DELIVERED', deliveredAt: new Date() });

  it('picks out the wrong item reason and the right product', async () => {
    const { data } = await classify(
      'I ordered the trail running shoes in size 44 but got a 41, wrong size.',
    );
    expect(data.reason).toBe(RefundReason.WRONG_ITEM);
    expect(data.referencedItemIds).toEqual(['shoes']);
  });

  it('reads a requested amount', async () => {
    const { data } = await classify('The socks are torn, refund me $2,500 now');
    expect(data.requestedAmountCents).toBe(250000);
    expect(data.reason).toBe(RefundReason.DAMAGED);
  });

  it('is unsure about vague messages', async () => {
    const { data } = await classify('Hello, I have a question about my order.');
    expect(data.reason).toBe(RefundReason.OTHER);
    expect(data.confidence).toBeLessThan(0.6);
  });
});

describe('HeuristicProvider item matching', () => {
  it('matches on the product noun, not accessories that share a word', async () => {
    const { data } = await new HeuristicProvider().classify({
      message: 'The laptop screen has a big crack across it.',
      orderStatus: 'DELIVERED',
      deliveredAt: new Date(),
      items: [
        {
          id: 'laptop',
          name: 'Nimbus 14 Pro Laptop',
          sku: 'L',
          unitPriceCents: 129900,
          quantity: 1,
        },
        { id: 'sleeve', name: 'Laptop Sleeve 14"', sku: 'S', unitPriceCents: 2900, quantity: 1 },
      ],
    });
    expect(data.referencedItemIds).toEqual(['laptop']);
  });
});
