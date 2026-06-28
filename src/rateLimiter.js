// Simple in-memory per-IP rate limiter — no external dependency required.
// 30 requests per rolling hour per IP.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 30;

const store = new Map();

function rateLimiter(req, res, next) {
  const key = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  let record = store.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + WINDOW_MS };
  }

  record.count += 1;
  store.set(key, record);

  if (record.count > MAX_REQUESTS) {
    return res.status(429).json({
      error: 'rate_limit',
      message: 'Too many requests. Please wait a while before trying again.',
    });
  }

  next();
}

// Prune expired entries every hour to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, rec] of store.entries()) {
    if (now > rec.resetAt) store.delete(key);
  }
}, WINDOW_MS);

module.exports = { rateLimiter };
