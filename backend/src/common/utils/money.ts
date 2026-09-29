const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** We keep money as integer cents everywhere and only format at the edges. */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}
