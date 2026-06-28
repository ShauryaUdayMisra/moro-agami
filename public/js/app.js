/* ─────────────────────────────────────────────────────────────────────────────
   Moro Agami — vanilla JS single-page app
   No build step, no framework, no localStorage.
   All state lives in S.  Navigation = replacing #app innerHTML.
───────────────────────────────────────────────────────────────────────────── */

// ── State ────────────────────────────────────────────────────────────────────
const S = {
  lang: null,             // 'odia' | 'hindi' | 'english'
  intake: {},             // {class, category, schoolType, familyWork}
  topic: null,            // key matching TOPICS
  topicLabel: null,       // human-readable label in chosen lang
  messages: [],           // [{role:'user'|'assistant', content:string}]
  retrieved: [],          // KB entries for current context
  screen: 'lang',
  intakeStep: 0,          // 0–3
};

// ── UI strings (loaded from /data/ui-text.json) ───────────────────────────────
let UI = {};

function t(key) {
  return (UI[S.lang] && UI[S.lang][key]) || (UI.english && UI.english[key]) || key;
}

// ── Topic definitions ────────────────────────────────────────────────────────
const TOPICS = [
  { key: 'money',   icon: '💰', labelKey: 'card_money' },
  { key: 'work',    icon: '🔧', labelKey: 'card_work' },
  { key: 'skill',   icon: '🛠️', labelKey: 'card_skill' },
  { key: 'study',   icon: '📚', labelKey: 'card_study' },
  { key: 'college', icon: '🎓', labelKey: 'card_college' },
  { key: 'job',     icon: '💼', labelKey: 'card_job' },
  { key: 'school',  icon: '🏫', labelKey: 'card_school' },
  { key: 'chat',    icon: '💬', labelKey: 'card_chat', full: true },
];

// ── Intake step definitions ──────────────────────────────────────────────────
const INTAKE_STEPS = [
  {
    key: 'class',
    qKey: 'intake_q_class',
    noteKey: null,
    field: 'class',
    options: [
      { value: '9',  labelKey: 'intake_class_9' },
      { value: '10', labelKey: 'intake_class_10' },
      { value: '11', labelKey: 'intake_class_11' },
      { value: '12', labelKey: 'intake_class_12' },
    ],
  },
  {
    key: 'category',
    qKey: 'intake_q_category',
    noteKey: 'intake_q_category_note',
    field: 'category',
    options: [
      { value: 'General', labelKey: 'intake_cat_general' },
      { value: 'SC',      labelKey: 'intake_cat_sc' },
      { value: 'ST',      labelKey: 'intake_cat_st' },
      { value: 'OBC',     labelKey: 'intake_cat_obc' },
      { value: 'EWS',     labelKey: 'intake_cat_ews' },
    ],
    skippable: true,
  },
  {
    key: 'schoolType',
    qKey: 'intake_q_school',
    noteKey: null,
    field: 'schoolType',
    options: [
      { value: 'government', labelKey: 'intake_school_govt' },
      { value: 'aided',      labelKey: 'intake_school_aided' },
      { value: 'private',    labelKey: 'intake_school_private' },
    ],
    skippable: true,
  },
  {
    key: 'familyWork',
    qKey: 'intake_q_family',
    noteKey: null,
    field: 'familyWork',
    options: [
      { value: 'farming',      labelKey: 'intake_family_farming' },
      { value: 'construction', labelKey: 'intake_family_construction' },
      { value: 'other',        labelKey: 'intake_family_other' },
    ],
    skippable: true,
  },
];

// ── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  try {
    const res = await fetch('/data/ui-text.json');
    UI = await res.json();
  } catch (e) {
    UI = {};
  }
  goto('lang');
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goto(screen) {
  S.screen = screen;
  const app = document.getElementById('app');
  if (!app) return;

  if (screen === 'lang')    { app.innerHTML = htmlLang();   bindLang();    return; }
  if (screen === 'home')    { app.innerHTML = htmlHome();   bindHome();    return; }
  if (screen === 'intake')  { app.innerHTML = htmlIntake(); bindIntake();  return; }
  if (screen === 'results') { mountResults(app); return; }
  if (screen === 'chat')    { mountChat(app);    return; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Language select
// ─────────────────────────────────────────────────────────────────────────────
function htmlLang() {
  return `
    <div class="lang-screen">
      <div class="lang-logo">ମୋ ଭବିଷ୍ୟ</div>
      <div class="lang-tagline">ମୋ ଭବିଷ୍ୟ · Moro Agami · मेरा भविष्य</div>
      <div class="lang-title">Choose your language / ଭାଷା ବାଛ</div>
      <div class="lang-btns">
        <button class="lang-btn" data-lang="odia">ଓଡ଼ିଆ</button>
        <button class="lang-btn" data-lang="hindi">हिन्दी</button>
        <button class="lang-btn" data-lang="english">English</button>
      </div>
    </div>`;
}

function bindLang() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.lang = btn.dataset.lang;
      S.intake = {};
      S.messages = [];
      S.retrieved = [];
      S.intakeStep = 0;
      goto('home');
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Home (card grid)
// ─────────────────────────────────────────────────────────────────────────────
function htmlHome() {
  const cards = TOPICS.map(tp => `
    <button class="topic-card${tp.full ? ' full-width' : ''}" data-topic="${tp.key}">
      <span class="topic-card-icon">${tp.icon}</span>
      ${esc(t(tp.labelKey))}
    </button>`).join('');

  return `
    <div class="screen">
      <div class="topbar">
        <span class="topbar-title">${esc(t('app_name'))}</span>
        <button class="topbar-lang" id="btn-change-lang">${langLabel(S.lang)}</button>
      </div>
      <div class="screen-body">
        <div class="home-greeting">${esc(t('home_greeting'))}</div>
        <div class="home-subtitle">${esc(t('home_subtitle'))}</div>
        <div class="card-grid">${cards}</div>
      </div>
    </div>`;
}

function bindHome() {
  document.getElementById('btn-change-lang')?.addEventListener('click', () => goto('lang'));

  document.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', () => {
      const topic = card.dataset.topic;
      S.topic = topic;
      S.topicLabel = t(TOPICS.find(tp => tp.key === topic)?.labelKey || '');
      S.intake = {};
      S.intakeStep = 0;
      S.retrieved = [];
      S.messages = [];

      if (topic === 'chat') {
        goto('chat');
      } else {
        goto('intake');
      }
    });
  });
}

function langLabel(lang) {
  return { odia: 'ଓଡ଼ିଆ', hindi: 'हिन्दी', english: 'EN' }[lang] || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Intake (step-by-step)
// ─────────────────────────────────────────────────────────────────────────────
function htmlIntake() {
  const step = INTAKE_STEPS[S.intakeStep];
  const dots = INTAKE_STEPS.map((_, i) =>
    `<div class="intake-dot${i <= S.intakeStep ? ' active' : ''}"></div>`).join('');

  const options = step.options.map(opt => `
    <button class="intake-opt" data-value="${opt.value}">
      ${esc(t(opt.labelKey))}
    </button>`).join('');

  const skipStep = step.skippable ? `
    <button class="intake-skip" id="btn-skip-step">${esc(t('intake_skip_step'))}</button>` : '';

  const skipAll = `
    <button class="intake-skip-all" id="btn-skip-all">${esc(t('intake_skip_all'))}</button>`;

  const note = step.noteKey ? `<div class="intake-note">${esc(t(step.noteKey))}</div>` : '';

  return `
    <div class="screen">
      <div class="topbar">
        <button class="topbar-back" id="btn-intake-back" aria-label="${esc(t('intake_back'))}">←</button>
        <span class="topbar-title">${esc(t('intake_title'))}</span>
      </div>
      <div class="screen-body">
        <div class="intake-progress">${dots}</div>
        <div class="intake-question">${esc(t(step.qKey))}</div>
        ${note}
        <div class="intake-options">${options}</div>
        ${skipStep}
        ${S.intakeStep === 0 ? skipAll : ''}
      </div>
    </div>`;
}

function bindIntake() {
  document.getElementById('btn-intake-back')?.addEventListener('click', () => {
    if (S.intakeStep === 0) goto('home');
    else { S.intakeStep--; goto('intake'); }
  });

  document.querySelectorAll('.intake-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = INTAKE_STEPS[S.intakeStep].field;
      S.intake[field] = btn.dataset.value;
      advanceIntake();
    });
  });

  document.getElementById('btn-skip-step')?.addEventListener('click', () => {
    advanceIntake();
  });

  document.getElementById('btn-skip-all')?.addEventListener('click', () => {
    goto('results');
  });
}

function advanceIntake() {
  if (S.intakeStep < INTAKE_STEPS.length - 1) {
    S.intakeStep++;
    goto('intake');
  } else {
    goto('results');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Results (retrieval-first, then AI intro)
// ─────────────────────────────────────────────────────────────────────────────
async function mountResults(app) {
  // Render skeleton immediately
  app.innerHTML = `
    <div class="screen">
      <div class="topbar">
        <button class="topbar-back" id="btn-results-back" aria-label="${esc(t('intake_back'))}">←</button>
        <span class="topbar-title">${esc(t('results_title'))}</span>
      </div>
      <div class="screen-body" id="results-body">
        <div class="ai-intro-box">
          <div class="ai-intro-loading">
            <div class="spinner"></div>
            ${esc(t('results_ai_intro_loading'))}
          </div>
        </div>
        <div class="spinner" style="margin:32px auto;"></div>
      </div>
    </div>`;

  document.getElementById('btn-results-back')?.addEventListener('click', () => goto('home'));

  // 1. Fetch KB entries (fast, no Gemini)
  try {
    const res = await apiFetch('/api/retrieve', {
      intake: S.intake,
      topic: S.topic,
      query: S.topicLabel || '',
    });
    S.retrieved = res.entries || [];
  } catch (_) {
    S.retrieved = [];
  }

  // 2. Render result cards
  const body = document.getElementById('results-body');
  if (!body) return;

  const cardsHtml = S.retrieved.length
    ? S.retrieved.map(e => resultCardHtml(e)).join('')
    : `<div class="results-no-results">${esc(t('results_no_results'))}</div>`;

  body.innerHTML = `
    <div class="ai-intro-box" id="ai-intro">
      <div class="ai-intro-loading">
        <div class="spinner"></div>
        ${esc(t('results_ai_intro_loading'))}
      </div>
    </div>
    <div class="result-cards">${cardsHtml}</div>
    <button class="open-chat-btn" id="btn-open-chat">${esc(t('results_open_chat'))}</button>
    <div class="footer-note">${esc(t('footer_verify'))}</div>
    <div style="height:80px;"></div>`;

  document.getElementById('btn-open-chat')?.addEventListener('click', () => goto('chat'));

  // 3. Fetch AI intro (Gemini, may be slow)
  const welcomeMsg = {
    role: 'user',
    content: buildResultsPrompt(),
  };
  S.messages = [welcomeMsg];

  try {
    const res = await apiFetch('/api/chat', {
      messages: S.messages,
      language: S.lang,
      intake: S.intake,
      topic: S.topic,
    });
    const introText = res.message || t('results_ai_intro_error');
    S.messages.push({ role: 'assistant', content: introText });

    const introEl = document.getElementById('ai-intro');
    if (introEl) introEl.innerHTML = renderText(introText);
  } catch (err) {
    const introEl = document.getElementById('ai-intro');
    if (introEl) {
      const msg = err.status === 503
        ? t('no_api_key')
        : t('results_ai_intro_error');
      introEl.textContent = msg;
    }
  }
}

function resultCardHtml(e) {
  const name = (S.lang === 'odia' && e.odia_name)
    ? e.odia_name
    : (S.lang === 'hindi' && e.hindi_name)
      ? e.hindi_name
      : e.name;

  const isSample = (e.id || '').startsWith('SAMPLE');

  const verifyBadge = e.verify_before_use
    ? `<span class="verify-badge">${esc(t('results_verify_warning'))}</span>` : '';

  const amount = e.amount_inr && e.amount_inr !== 'verify_on_portal'
    ? `<div class="result-meta-row"><strong>${esc(t('results_amount'))}</strong> ${esc(e.amount_inr)}</div>` : '';

  const timeToIncome = e.time_to_income
    ? `<div class="result-meta-row"><strong>${esc(t('results_time_to_income'))}</strong> ${esc(e.time_to_income)}</div>` : '';

  const entryAfter = e.entry_after
    ? `<div class="result-meta-row"><strong>${esc(t('results_entry_after'))}</strong> ${esc(e.entry_after)}</div>` : '';

  const deadline = e.deadline_pattern
    ? `<div class="result-meta-row"><strong>${esc(t('results_deadline'))}</strong> ${esc(e.deadline_pattern)}</div>` : '';

  const docs = e.documents?.length ? `
    <div class="docs-section">
      <strong>${esc(t('results_documents'))}</strong>
      <ul class="docs-list">${e.documents.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>` : '';

  const portal = e.portal_url ? `
    <a class="portal-btn" href="${esc(e.portal_url)}" target="_blank" rel="noopener noreferrer">
      ${esc(t('results_portal_btn'))}
    </a>` : '';

  const sampleTag = isSample
    ? `<div style="font-size:11px;color:#9CA3AF;font-style:italic;margin-bottom:4px;">SAMPLE — replace with real data</div>` : '';

  return `
    <div class="result-card">
      ${sampleTag}
      <div class="result-card-name">${esc(name)}</div>
      <div class="result-card-summary">${esc(e.summary || '')}</div>
      ${verifyBadge}
      <div class="result-card-meta">
        ${amount}${timeToIncome}${entryAfter}${deadline}
      </div>
      ${docs}
      ${portal}
    </div>`;
}

function buildResultsPrompt() {
  const topicLabel = S.topicLabel || S.topic || '';
  const cls = S.intake.class || '';
  const cat = S.intake.category || '';

  if (S.lang === 'odia') {
    const who = [cls ? `ଶ୍ରେଣୀ ${cls}` : '', cat ? `${cat} ବର୍ଗ` : ''].filter(Boolean).join(', ');
    return `ମୁଁ ଏକ ଛାତ୍ର${who ? ` (${who})` : ''}। ବିଷୟ: "${topicLabel}"। ଦୟାକରି ଏକ ସଂକ୍ଷିପ୍ତ, ଉତ୍ସାହଜନକ ପ୍ରସ୍ତାବନା ଦିଅ।`;
  }
  if (S.lang === 'hindi') {
    const who = [cls ? `कक्षा ${cls}` : '', cat ? `${cat} वर्ग` : ''].filter(Boolean).join(', ');
    return `मैं एक छात्र हूँ${who ? ` (${who})` : ''}। विषय: "${topicLabel}"। कृपया एक संक्षिप्त, प्रोत्साहक परिचय दीजिए।`;
  }
  const who = [cls ? `Class ${cls}` : '', cat ? `category ${cat}` : ''].filter(Boolean).join(', ');
  return `I am a student${who ? ` (${who})` : ''}. Topic: "${topicLabel}". Please give a short, warm introduction to the options for me.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN: Chat
// ─────────────────────────────────────────────────────────────────────────────
function mountChat(app) {
  // If no prior messages, inject a welcome message
  if (S.messages.length === 0) {
    S.messages.push({ role: 'assistant', content: t('chat_welcome') });
  }

  app.innerHTML = `
    <div class="chat-screen">
      <div class="topbar">
        <button class="topbar-back" id="btn-chat-back" aria-label="${esc(t('chat_back'))}">←</button>
        <span class="topbar-title">${esc(t('chat_title'))}</span>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-bar">
        <textarea
          class="chat-input"
          id="chat-input"
          rows="1"
          placeholder="${esc(t('chat_placeholder'))}"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        ></textarea>
        <button class="chat-send-btn" id="btn-chat-send" aria-label="${esc(t('chat_send'))}">➤</button>
      </div>
    </div>`;

  // Render existing messages
  renderAllMessages();

  // Events
  document.getElementById('btn-chat-back')?.addEventListener('click', () => {
    if (S.topic && S.topic !== 'chat') goto('results');
    else goto('home');
  });

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-chat-send');

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Send on Enter (not Shift+Enter)
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn?.addEventListener('click', sendMessage);
  scrollToBottom();
}

function renderAllMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  container.innerHTML = S.messages.map((msg, i) => messageBubbleHtml(msg, i)).join('');
}

function appendMessage(msg, index) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = messageBubbleHtml(msg, index);
  container.appendChild(div.firstElementChild);
  scrollToBottom();
}

function messageBubbleHtml(msg, index) {
  const isUser = msg.role === 'user';
  const feedbackBtns = !isUser ? `
    <div class="chat-feedback">
      <button class="chat-feedback-btn" data-idx="${index}" data-vote="up">${t('chat_feedback_helpful')}</button>
      <button class="chat-feedback-btn" data-idx="${index}" data-vote="down">${t('chat_feedback_not_helpful')}</button>
    </div>` : '';

  return `
    <div class="chat-bubble-row ${isUser ? 'user' : 'assistant'}">
      <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">${renderText(msg.content)}</div>
      ${feedbackBtns}
    </div>`;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('btn-chat-send');
  const text = input?.value.trim();
  if (!text) return;

  // Clear and reset input
  input.value = '';
  input.style.height = 'auto';

  // Add user message
  const userMsg = { role: 'user', content: text };
  S.messages.push(userMsg);
  appendMessage(userMsg, S.messages.length - 1);

  // Disable send button to prevent double-tap on slow connections
  if (sendBtn) sendBtn.disabled = true;

  // Show typing indicator
  showTyping(true);

  try {
    const res = await apiFetch('/api/chat', {
      messages: S.messages,
      language: S.lang,
      intake: S.intake,
      topic: S.topic || 'chat',
    });

    const reply = res.message || t('chat_error');
    const assistantMsg = { role: 'assistant', content: reply };
    S.messages.push(assistantMsg);
    showTyping(false);
    appendMessage(assistantMsg, S.messages.length - 1);
    bindFeedbackButtons();
  } catch (err) {
    showTyping(false);
    const errMsg = err.status === 503 ? t('no_api_key') : t('chat_error');
    const assistantMsg = { role: 'assistant', content: errMsg };
    S.messages.push(assistantMsg);
    appendMessage(assistantMsg, S.messages.length - 1);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input?.focus();
  }
}

function showTyping(visible) {
  const existing = document.getElementById('typing-indicator');
  if (existing) existing.remove();

  if (visible) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.innerHTML = `
      <div class="chat-typing">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;
    container.appendChild(div);
    scrollToBottom();
  }
}

function bindFeedbackButtons() {
  document.querySelectorAll('.chat-feedback-btn:not([data-bound])').forEach(btn => {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const vote = btn.dataset.vote;
      const idx = parseInt(btn.dataset.idx, 10);

      // Mark voted state
      btn.closest('.chat-feedback')?.querySelectorAll('.chat-feedback-btn').forEach(b => {
        b.classList.remove('voted');
      });
      btn.classList.add('voted');

      // Log feedback
      fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: vote, language: S.lang, topic: S.topic, messageIndex: idx }),
      }).catch(() => {});
    });
  });
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    // Try to get message from body
    try {
      const data = await res.json();
      err.message = data.message || err.message;
    } catch (_) {}
    throw err;
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Text helpers
// ─────────────────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Converts basic Gemini markdown to safe HTML
function renderText(text) {
  if (!text) return '';
  // Escape first, then apply safe formatting
  let html = esc(text);
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // *italic*
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Lines starting with - or • become list items
  const lines = html.split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    if (/^[-•]\s/.test(line.trimStart())) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${line.replace(/^[-•]\s/, '')}</li>`);
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line ? `<p>${line}</p>` : '');
    }
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', boot);
