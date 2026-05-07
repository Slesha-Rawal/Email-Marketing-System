const createRateLimit = ({
  windowMs,
  maxRequests,
  message = "Too many requests",
  keyGenerator,
}) => {
  if (!windowMs || !maxRequests) {
    throw new Error("windowMs and maxRequests are required for rate limiter");
  }

  const store = new Map();

  return (req, res, next) => {
    const defaultKey = req.ip || req.socket?.remoteAddress || "unknown";
    const key = keyGenerator ? keyGenerator(req) : defaultKey;
    const now = Date.now();

    const existing = store.get(key);

    if (!existing || now > existing.windowEndAt) {
      store.set(key, {
        count: 1,
        windowEndAt: now + windowMs,
      });
      return next();
    }

    existing.count += 1;

    if (existing.count > maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((existing.windowEndAt - now) / 1000),
      );

      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message,
        retryAfterSeconds,
      });
    }

    return next();
  };
};

export { createRateLimit };
