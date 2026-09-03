const { v4: uuidv4 } = require('uuid');
const rabbitmq = require('../lib/rabbitmq');
const config = require('../config');
const logger = require('../lib/logger');

function validateOrderBody(body) {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  if (!body.customerId || typeof body.customerId !== 'string') {
    return 'customerId is required and must be a string';
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return 'items is required and must be a non-empty array';
  }

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    if (!item || typeof item.sku !== 'string' || !item.sku) {
      return 'each item requires a non-empty sku string';
    }
    if (typeof item.qty !== 'number' || item.qty <= 0) {
      return 'each item requires a positive numeric qty';
    }
  }

  return null;
}

async function createOrder(req, res) {
  const validationError = validateOrderBody(req.body);
  if (validationError) {
    return res.status(400).json({ error: 'validation_error', message: validationError });
  }

  const orderId = uuidv4();
  const event = {
    orderId: orderId,
    customerId: req.body.customerId,
    items: req.body.items,
    createdAt: new Date().toISOString(),
  };

  try {
    await rabbitmq.publish(config.rabbitmqRoutingKey, event);
  } catch (err) {
    logger.error('Failed to publish order.created event', { error: err.message, orderId: orderId });
    return res.status(503).json({ error: 'publish_failed', message: 'Could not accept order right now, please retry' });
  }

  logger.info('Order accepted', { orderId: orderId });

  return res.status(202).json({ orderId: orderId, status: 'accepted' });
}

module.exports = { createOrder: createOrder };
