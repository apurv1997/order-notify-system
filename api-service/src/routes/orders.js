const express = require('express');
const ordersController = require('../controllers/ordersController');
const rateLimit = require('../middleware/rateLimit');
const idempotency = require('../middleware/idempotency');

const router = express.Router();

router.post('/orders', rateLimit, idempotency, ordersController.createOrder);

module.exports = router;
