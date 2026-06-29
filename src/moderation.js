// Basic keyword-level moderation before calling Gemini.
// The audience is school-age minors — block obvious abuse categories.
// This is a first-pass filter only; Gemini's own safety filters remain active.

const BLOCKED = [
  // Sexual / explicit
  'sex', 'porn', 'nude', 'naked', 'rape',
  // Violence / self-harm
  'kill', 'murder', 'suicide', 'bomb', 'shoot',
  // Drugs
  'drug', 'cocaine', 'heroin', 'weed', 'ganja',
  // Slurs / hate — add as needed
];

const BLOCKED_RE = BLOCKED.map(kw => new RegExp(`\\b${kw}\\b`, 'i'));

function moderateInput(text) {
  if (!text || typeof text !== 'string') return { ok: true };
  for (const re of BLOCKED_RE) {
    if (re.test(text)) return { ok: false, reason: re.source };
  }
  return { ok: true };
}

module.exports = { moderateInput };
