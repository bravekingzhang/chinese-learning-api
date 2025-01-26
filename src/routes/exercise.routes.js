const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exercise.controller');
const auth = require('../middlewares/auth');

// All routes require authentication
router.use(auth);

// Exercise generation
router.post('/generate', exerciseController.generate);
router.post('/shuffle', exerciseController.shuffle);

// Exercise history
router.get('/history', exerciseController.getHistory);
router.delete('/history/:id', exerciseController.deleteHistory);

module.exports = router; 