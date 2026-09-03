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

  channel = await connection.createConfirmChannel();
  await channel.assertExchange(config.rabbitmqExchange, 'topic', { durable: true });

  logger.info('Connected to RabbitMQ');
  return channel;
}

async function publish(routingKey, message) {
  const ch = await connect();
  const buffer = Buffer.from(JSON.stringify(message));

  return new Promise(function (resolve, reject) {
    ch.publish(
      config.rabbitmqExchange,
      routingKey,
      buffer,
      { persistent: true, contentType: 'application/json' },
      function (err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

module.exports = { connect: connect, publish: publish };
