const rabbitmq = require('./lib/rabbitmq');
const orderProcessor = require('./controllers/orderProcessor');
const logger = require('./lib/logger');

async function main() {
  await rabbitmq.consume(orderProcessor.processOrder);
  logger.info('worker-service consuming order.created events');
}

main().catch(function (err) {
  logger.error('worker-service failed to start', { error: err.message });
  process.exit(1);
});
