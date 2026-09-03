const amqp = require('amqplib');
const config = require('../config');
const logger = require('./logger');

let connection = null;
let channel = null;

async function connect() {
  if (channel) {
    return channel;
  }

  connection = await amqp.connect(config.rabbitmqUrl);
  connection.on('error', function (err) {
    logger.error('RabbitMQ connection error', { error: err.message });
  });
  connection.on('close', function () {
    logger.warn('RabbitMQ connection closed');
    connection = null;
    channel = null;
  });

  channel = await connection.createChannel();

  const deadLetterExchange = config.rabbitmqExchange + '.dlx';
  const deadLetterQueue = config.rabbitmqQueue + '.dead';

  await channel.assertExchange(config.rabbitmqExchange, 'topic', { durable: true });
  await channel.assertExchange(deadLetterExchange, 'topic', { durable: true });
  await channel.assertQueue(deadLetterQueue, { durable: true });
  await channel.bindQueue(deadLetterQueue, deadLetterExchange, '#');

  await channel.assertQueue(config.rabbitmqQueue, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': deadLetterExchange },
  });
  await channel.bindQueue(config.rabbitmqQueue, config.rabbitmqExchange, config.rabbitmqRoutingKey);
  await channel.prefetch(10);

  logger.info('Connected to RabbitMQ', { queue: config.rabbitmqQueue });
  return channel;
}

/**
 * Consumes messages from the queue, calling `handler` for each one.
 * Acks on success. On failure, nacks without requeue — the queue's
 * x-dead-letter-exchange argument routes it to the dead-letter queue
 * instead of retrying forever or dropping it silently.
 */
async function consume(handler) {
  const ch = await connect();

  ch.consume(config.rabbitmqQueue, async function (msg) {
    if (!msg) {
      return;
    }

    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content);
      ch.ack(msg);
    } catch (err) {
      logger.error('Message processing failed, sending to dead-letter queue', { error: err.message });
      ch.nack(msg, false, false);
    }
  });
}

module.exports = { connect: connect, consume: consume };
