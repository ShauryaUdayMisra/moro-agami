// Retrieval layer — finds the most relevant KB entries given intake answers
// and a topic/query. Never loads entire files into the model context;
// only the top-scored matches are passed to Gemini.

// Which KB files to search per topic card
const TOPIC_SOURCES = {
  study:   ['pathways', 'exams'],
  money:   ['scholarships'],
  work:    ['pathways'],
  skill:   ['pathways'],
  college: ['exams', 'pathways'],
  job:     ['pathways'],
  school:  ['schools'],
  chat:    ['scholarships', 'pathways', 'exams', 'schools'],
};

const MAX_RESULTS = 6;

function retrieveEntries(KB, intake = {}, topic = '', query = '') {
  const sources = TOPIC_SOURCES[topic] || TOPIC_SOURCES.chat;

  // Flatten candidate entries from relevant KB files
  let candidates = [];
  for (const src of sources) {
    if (KB[src]) candidates = candidates.concat(KB[src]);
  }

  const q = (query || '').toLowerCase().trim();
  const tokens = q ? q.split(/\s+/) : [];

  const scored = candidates.map(entry => {
    let score = 0;

    // ── Category match ───────────────────────────────────────────────────
    if (intake.category) {
      const cat = entry.category || [];
      if (cat.includes(intake.category)) score += 4;
      else if (cat.includes('General') || cat.includes('any')) score += 1;
    } else {
      score += 1; // neutral when no category provided
    }

    // ── Class level match ────────────────────────────────────────────────
    if (intake.class) {
      const cl = entry.class_level || [];
      if (cl.includes(intake.class)) score += 3;
    }

    // ── Family context match ─────────────────────────────────────────────
    if (intake.familyWork && intake.familyWork !== 'skip') {
      const fc = entry.family_context || [];
      if (fc.includes(intake.familyWork) || fc.includes('any')) score += 2;
    }

    // ── Keyword match in name + summary ─────────────────────────────────
    if (tokens.length > 0) {
      const haystack = `${entry.name || ''} ${entry.summary || ''}`.toLowerCase();
      for (const tok of tokens) {
        if (haystack.includes(tok)) score += 2;
      }
    }

    // ── Topic-specific boosts ────────────────────────────────────────────
    if (topic === 'work' || topic === 'skill') {
      if (entry.time_to_income) score += 2;
      if (['ITI', 'apprenticeship', 'farming', 'govt_job'].includes(entry.pathway_type)) score += 2;
    }
    if (topic === 'money' && entry.amount_inr) score += 2;
    if (topic === 'college' && entry.exam_type) score += 2;
    if (topic === 'school') score += 1;

    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(s => s.entry);
}

module.exports = { retrieveEntries };
