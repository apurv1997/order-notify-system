const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

const redis = new Redis(config.redisUrl);

redis.on('connect', function () {
  logger.info('Connected to Redis');
});

redis.on('error', function (err) {
  logger.error('Redis connection error', { error: err.message });
});

module.exports = redis;
