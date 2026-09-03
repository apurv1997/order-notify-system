const pool = require('../lib/mysql');
const redis = require('../lib/redis');
const config = require('../config');
const logger = require('../lib/logger');

/**
 * Handles one order.created event: writes the order, its items, and a
 * notification record into MySQL inside a single transaction. Re-checks
 * Redis first since RabbitMQ's at-least-once delivery can redeliver a
 * message the worker already handled.
 */
async function processOrder(event) {
  if (!event || !event.orderId || !event.customerId || !Array.isArray(event.items)) {
    throw new Error('Invalid order.created event: missing required fields');
  }

  const idempotencyKey = 'worker:processed:' + event.orderId;
  const alreadyProcessed = await redis.get(idempotencyKey);

  if (alreadyProcessed) {
    logger.info('Order already processed, skipping', { orderId: event.orderId });
    return;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      'INSERT INTO orders (id, customer_id, status, created_at) VALUES (?, ?, ?, ?)',
      [event.orderId, event.customerId, 'received', new Date(event.createdAt)]
    );

    for (let i = 0; i < event.items.length; i++) {
      const item = event.items[i];
      await connection.query(
        'INSERT INTO order_items (order_id, sku, qty) VALUES (?, ?, ?)',
        [event.orderId, item.sku, item.qty]
      );
    }

    await connection.query(
      'INSERT INTO notifications (order_id, type, status) VALUES (?, ?, ?)',
      [event.orderId, 'order_confirmation', 'pending']
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    connection.release();

    if (err.code === 'ER_DUP_ENTRY') {
      logger.warn('Duplicate order detected in MySQL, treating as already processed', { orderId: event.orderId });
      await redis.set(idempotencyKey, '1', 'EX', config.idempotencyTtlSeconds);
      return;
    }

    throw err;
  }

  connection.release();
  await redis.set(idempotencyKey, '1', 'EX', config.idempotencyTtlSeconds);

  logger.info('Order processed', { orderId: event.orderId });
}

module.exports = { processOrder: processOrder };
