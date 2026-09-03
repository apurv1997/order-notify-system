const redis = require('../lib/redis');
const config = require('../config');
const logger = require('./../lib/logger');

async function rateLimit(req, res, next) {
  const identifier = req.get('X-API-Key') || req.ip;
  const window = Math.floor(Date.now() / 1000 / config.rateLimitWindowSeconds);
  const key = 'ratelimit:' + identifier + ':' + window;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, config.rateLimitWindowSeconds);
    }

    res.set('X-RateLimit-Limit', String(config.rateLimitMaxRequests));
    res.set('X-RateLimit-Remaining', String(Math.max(0, config.rateLimitMaxRequests - count)));

    if (count > config.rateLimitMaxRequests) {
      return res.status(429).json({ error: 'rate_limit_exceeded', message: 'Too many requests' });
    }

    next();
  } catch (err) {
    logger.error('Rate limit check failed, allowing request through', { error: err.message });
    next();
  }
}

module.exports = rateLimit;
