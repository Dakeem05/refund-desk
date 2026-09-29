import { randomInt } from 'crypto';

// No 0/O/1/I - these get read out over the phone
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateReference(prefix = 'RF'): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${code}`;
}
