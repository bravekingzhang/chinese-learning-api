const express = require('express');
const router = express.Router();
const memberController = require('../controllers/member.controller');
const auth = require('../middlewares/auth');

// All routes require authentication
router.use(auth);

// Order related
router.post('/order/create', memberController.createOrder);
router.get('/order/query/:orderNo', memberController.queryOrder);
router.post('/order/notify', memberController.handlePayNotify);

// Card related
router.post('/card/exchange', memberController.exchangeCard);
router.get('/card/info/:cardNo', memberController.getCardInfo);

module.exports = router; 