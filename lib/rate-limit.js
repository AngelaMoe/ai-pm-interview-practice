// lib/rate-limit.js
// Small in-memory, per-IP rate limiter.
// Counts live in this process only: they reset on restart and aren't shared
// across serverless instances. Replace with a shared store before deploying.

export function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

export function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, resetAt }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const ip = getClientIp(req);

    // Drop expired entries now and then so the map can't grow without bound
    if (hits.size > 10000) {
      for (const [key, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(key);
      }
    }

    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: "You're going a bit fast. Please wait a moment and try again." });
    }
    next();
  };
}
