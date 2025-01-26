const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const auth = require('../middlewares/auth');

// Public routes
router.post('/login', userController.login);

// Protected routes
router.get('/info', auth, userController.getUserInfo);
router.get('/points/today', auth, userController.getTodayPoints);
router.get('/points/records', auth, userController.getPointsRecords);

module.exports = router; 