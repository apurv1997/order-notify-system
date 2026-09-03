require('dotenv').config();

const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  rabbitmqUrl: process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE || 'orders',
  rabbitmqRoutingKey: process.env.RABBITMQ_ROUTING_KEY || 'order.created',
  rabbitmqQueue: process.env.RABBITMQ_QUEUE || 'order-processing',

  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3307),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'order_notify',
  },

  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
};

module.exports = config;
