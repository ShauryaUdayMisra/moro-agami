require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const { retrieveEntries } = require('./src/retrieval');
const { callGemini, buildSystemPrompt } = require('./src/gemini');
const { moderateInput } = require('./src/moderation');
const { logInteraction } = require('./src/logger');
const { rateLimiter } = require('./src/rateLimiter');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve ui-text.json for client-side translations (safe — no secrets)
app.get('/data/ui-text.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'data', 'ui-text.json'));
});

// ── Load knowledge base at startup ──────────────────────────────────────────
const KB = {};
const KB_FILES = ['scholarships', 'pathways', 'exams', 'schools'];
try {
  for (const name of KB_FILES) {
    KB[name] = JSON.parse(fs.readFileSync(`./data/${name}.json`, 'utf8'));
  }
  const summary = KB_FILES.map(k => `${k}: ${KB[k].length}`).join(', ');
  console.log(`\nKnowledge base loaded — ${summary}`);
} catch (err) {
  console.error('Failed to load knowledge base:', err.message);
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY not set in .env — AI chat will return an error until it is configured.\n');
}

// ── /api/retrieve — fast KB lookup, no Gemini ───────────────────────────────
app.post('/api/retrieve', (req, res) => {
  const { intake = {}, topic = '', query = '' } = req.body;
  const entries = retrieveEntries(KB, intake, topic, query);
  res.json({ entries });
});

// ── /api/chat — full Gemini call with grounded context ──────────────────────
app.post('/api/chat', rateLimiter, async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'no_api_key',
      message: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY to .env and restart.',
    });
  }

  const { messages, language = 'odia', intake = {}, topic = '' } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'invalid_input', message: 'messages array required' });
  }

  // Cap history to last 10 turns to control token cost
  const cappedMessages = messages.slice(-10);
  const lastMsg = cappedMessages[cappedMessages.length - 1]?.content || '';

  // Moderation gate
  const mod = moderateInput(lastMsg);
  if (!mod.ok) {
    return res.json({ message: getLocalMsg('moderation', language), retrieved: [] });
  }

  // Retrieve grounded context
  const retrieved = retrieveEntries(KB, intake, topic, lastMsg);

  // Build system prompt and pick model
  const systemPrompt = buildSystemPrompt(language, retrieved);
  // Use the more capable model for open-ended chat; lite for guided flows
  const model = topic === 'chat' ? 'gemini-2.5-flash' : 'gemini-2.5-flash-lite';

  try {
    const text = await callGemini(cappedMessages, systemPrompt, model);

    logInteraction({
      ip: hashIP(req.ip || req.connection?.remoteAddress || ''),
      language,
      topic,
      intake,
      retrieved_ids: retrieved.map(e => e.id),
      question: lastMsg.slice(0, 500),
      response: text.slice(0, 1000),
    });

    res.json({ message: text, retrieved });
  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ error: 'gemini_error', message: getLocalMsg('error', language) });
  }
});

// ── /api/feedback — thumbs up/down logging ──────────────────────────────────
app.post('/api/feedback', (req, res) => {
  const { feedback, language, topic, messageIndex } = req.body;
  logInteraction({ type: 'feedback', feedback, language, topic, messageIndex });
  res.json({ ok: true });
});

// ── Helpers ─────────────────────────────────────────────────────────────────
const LOCAL_MSGS = {
  moderation: {
    odia: 'ଦୟାକରି ଅନ୍ୟ ଏକ ପ୍ରଶ୍ନ ପଚାରନ୍ତୁ।',
    hindi: 'कृपया कोई दूसरा सवाल पूछें।',
    english: 'Please ask a different question.',
  },
  error: {
    odia: 'କ୍ଷମା କରନ୍ତୁ, ଏହି ମୁହୂର୍ତ୍ତରେ ସଂଯୋଗ ହୋଇପାରୁ ନାହିଁ। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।',
    hindi: 'माफ करें, अभी कनेक्ट नहीं हो पा रहा। कृपया फिर से कोशिश करें।',
    english: 'Sorry, could not connect right now. Please try again.',
  },
};

function getLocalMsg(type, lang) {
  return LOCAL_MSGS[type]?.[lang] || LOCAL_MSGS[type]?.english || '';
}

function hashIP(ip) {
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = ((h << 5) + h) ^ ip.charCodeAt(i);
  return (h >>> 0).toString(16);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Moro Agami → http://localhost:${PORT}\n`);
});
