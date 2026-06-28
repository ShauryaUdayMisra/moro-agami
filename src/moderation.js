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

function moderateInput(text) {
  if (!text || typeof text !== 'string') return { ok: true };
  const lower = text.toLowerCase();
  for (const kw of BLOCKED) {
    if (lower.includes(kw)) return { ok: false, reason: kw };
  }
  return { ok: true };
}

module.exports = { moderateInput };
