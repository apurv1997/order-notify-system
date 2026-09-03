const redis = require('../lib/redis');
const config = require('../config');
const logger = require('./../lib/logger');

const IN_PROGRESS_TTL_SECONDS = 30;

async function idempotency(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) {
    return next();
  }

  const redisKey = 'idempotency:' + key;

  try {
    const existing = await redis.get(redisKey);

    if (existing) {
      const record = JSON.parse(existing);

      if (record.status === 'completed') {
        res.set('Idempotency-Replayed', 'true');
        return res.status(record.statusCode).json(record.body);
      }

      return res.status(409).json({
        error: 'idempotency_key_in_progress',
        message: 'A request with this Idempotency-Key is already being processed',
      });
    }

    const claimed = await redis.set(redisKey, JSON.stringify({ status: 'processing' }), 'EX', IN_PROGRESS_TTL_SECONDS, 'NX');

    if (!claimed) {
      return res.status(409).json({
        error: 'idempotency_key_in_progress',
        message: 'A request with this Idempotency-Key is already being processed',
      });
    }

    const originalJson = res.json.bind(res);

    res.json = function (body) {
      const ttl = res.statusCode < 500 ? config.idempotencyTtlSeconds : 1;
      const record = JSON.stringify({ status: 'completed', statusCode: res.statusCode, body: body });

      redis.set(redisKey, record, 'EX', ttl).catch(function (err) {
        logger.error('Failed to persist idempotency record', { error: err.message });
      });

      return originalJson(body);
    };

    next();
  } catch (err) {
    logger.error('Idempotency check failed, proceeding without protection', { error: err.message });
    next();
  }
}

module.exports = idempotency;
