require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE || 'orders',
  rabbitmqRoutingKey: process.env.RABBITMQ_ROUTING_KEY || 'order.created',

  rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),

  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
};

module.exports = config;
