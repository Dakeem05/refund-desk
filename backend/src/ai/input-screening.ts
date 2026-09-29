export const MAX_MESSAGE_LENGTH = 2000;

export interface ScreeningResult {
  /** Cleaned text - this is what gets stored and sent to the model. */
  text: string;
  suspicious: boolean;
  signals: string[];
}

// Cheap first line of defence. It doesn't need to catch everything - the model is also asked to
// flag manipulation, and even if both miss something the policy engine still makes the call.
const INJECTION_PATTERNS: Array<{ signal: string; pattern: RegExp }> = [
  {
    signal: 'instruction override',
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(instructions?|rules?|polic(y|ies)|prompts?|guidelines?)\b/i,
  },
  {
    signal: 'system prompt probing',
    pattern: /\b(system|developer|hidden)\s+(prompt|message|instructions?)\b/i,
  },
  {
    signal: 'role play',
    pattern: /\b(you are now|act as|pretend (to be|you are)|roleplay as|from now on you)\b/i,
  },
  { signal: 'jailbreak keyword', pattern: /\b(jailbreak|DAN mode|developer mode|god mode)\b/i },
  {
    signal: 'fake markup',
    pattern:
      /<\/?\s*(system|assistant|instructions?|admin|tool|customer_message)\b[^>]*>|\[\/?(INST|SYS)\]|^\s*#{2,}\s*(system|assistant)/im,
  },
  { signal: 'role prefix', pattern: /^\s*(system|assistant|admin)\s*:/im },
  {
    signal: 'staff impersonation',
    pattern:
      /\b(i am|i'm|this is)\s+(an?|the)\s+(\w+\s+)?(admin|administrator|manager|supervisor|developer|support agent|staff)\b/i,
  },
  {
    signal: 'forced outcome',
    pattern:
      /\b(you (must|have to|are required to)|automatically|immediately)\s+(approve|refund|issue)\b|\bapprove (this|my|the) (refund|request)\b[^.\n]{0,30}\b(regardless|no matter|without)\b/i,
  },
  {
    signal: 'policy exception claim',
    pattern:
      /\b(policy (does ?n[o']t|doesn't) apply|special exception|pre-?approved|already approved by)\b/i,
  },
];

const ZERO_WIDTH = new RegExp('[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF]', 'g');
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function screenCustomerMessage(raw: string): ScreeningResult {
  const signals: string[] = [];

  // NFKC folds look-alike characters (fullwidth letters etc.) so the patterns still match
  let text = raw.normalize('NFKC');

  const stripped = text.replace(ZERO_WIDTH, '');
  if (stripped.length !== text.length) signals.push('hidden characters');
  text = stripped.replace(CONTROL_CHARS, '');
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.slice(0, MAX_MESSAGE_LENGTH);
    signals.push('truncated');
  }

  for (const { signal, pattern } of INJECTION_PATTERNS) {
    if (pattern.test(text)) signals.push(signal);
  }

  // 'hidden characters' and 'truncated' on their own aren't an attack
  const suspicious = signals.some((s) => s !== 'truncated' && s !== 'hidden characters');

  return { text, suspicious, signals };
}
