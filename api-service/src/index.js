const express = require('express');
const config = require('./config');
const logger = require('./lib/logger');
const healthRoutes = require('./routes/health');
const ordersRoutes = require('./routes/orders');

const app = express();

app.use(express.json());
app.use(healthRoutes);
app.use(ordersRoutes);

app.listen(config.port, function () {
  logger.info('api-service listening', { port: config.port });
});
