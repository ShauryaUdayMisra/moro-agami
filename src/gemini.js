const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI;
}

// ── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(language, retrieved) {
  const langLabel = { odia: 'Odia (ଓଡ଼ିଆ)', hindi: 'Hindi (हिन्दी)', english: 'English' }[language] || 'English';
  const context = formatContext(retrieved);

  return `You are Moro Agami (ମୋ ଭବିଷ୍ୟ — "My Future"), a warm, encouraging guide for students in Odisha, India.
Reply in ${langLabel}, in simple words a Class 9–12 student will understand, like a kind older sibling. Short sentences.
It is fine if the student mixes Odia, Hindi, and English, or types Odia in English letters — understand them and reply in their chosen language.

STRICT RULES:
1. For any scholarship amount, deadline, eligibility rule, or scheme detail: use ONLY the facts in the CONTEXT below. If a fact is not in the CONTEXT, say you are not fully sure and direct them to the official portal. NEVER invent a rupee amount, date, or eligibility number.
2. When a fact has verify_before_use = true, tell the student to confirm this year's exact figure on the official portal before acting on it.
3. If the student says they may need to leave school to work or earn, treat near-term income paths (ITI, apprenticeships, government jobs after Class 10/12, farm-livelihood training) as fully valid and respectable options. Never imply college is the only worthwhile path.
4. Be concrete: name the scheme or path, name the portal, list the documents, give the next step. Never end with only "talk to a counsellor."
5. Keep replies short — 3 to 5 sentences, or bullet points if listing 3 or more things.

CONTEXT:
${context}`;
}

function formatContext(entries) {
  if (!entries || entries.length === 0) {
    return 'No specific scheme or pathway entries found for this query.\n' +
      'If the student asks for specific amounts, dates, or eligibility numbers, say you are not certain and direct them to scholarships.odisha.gov.in or the relevant official portal.';
  }

  return entries.map(e => {
    const lines = [`[${e.id}]`, `Name: ${e.name}`];
    if (e.summary)          lines.push(`Summary: ${e.summary}`);
    if (e.amount_inr && e.amount_inr !== 'verify_on_portal') lines.push(`Amount: ${e.amount_inr}`);
    if (e.amount_inr === 'verify_on_portal') lines.push('Amount: Must be verified on official portal — do not state a specific figure');
    if (e.deadline_pattern) lines.push(`Deadline info: ${e.deadline_pattern}`);
    if (e.time_to_income)   lines.push(`Time to first earning: ${e.time_to_income}`);
    if (e.entry_after)      lines.push(`Entry after: ${e.entry_after}`);
    if (e.portal_url)       lines.push(`Official portal: ${e.portal_url}`);
    if (e.documents?.length) lines.push(`Documents needed: ${e.documents.join(', ')}`);
    if (e.verify_before_use) lines.push('IMPORTANT: Tell the student to verify this year\'s exact details on the official portal before acting.');
    return lines.join('\n');
  }).join('\n\n---\n\n');
}

// ── Gemini call ──────────────────────────────────────────────────────────────
async function callGemini(messages, systemPrompt, modelName = 'gemini-2.5-flash-lite') {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: 600,
      temperature: 0.65,
    },
  });

  // Split messages into history (all but last) + new message
  const rawHistory = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Gemini requires history to start with 'user'; drop any leading model turns
  const firstUserIdx = rawHistory.findIndex(m => m.role === 'user');
  const history = firstUserIdx > 0 ? rawHistory.slice(firstUserIdx) : rawHistory;

  const lastContent = messages[messages.length - 1]?.content || '';

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastContent);
  return result.response.text();
}

module.exports = { callGemini, buildSystemPrompt };
