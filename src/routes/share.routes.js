const express = require('express');
const router = express.Router();
const shareController = require('../controllers/share.controller');
const auth = require('../middlewares/auth');

// All routes require authentication
router.use(auth);

// Share related
router.get('/code', shareController.getInviteCode);
router.post('/invite', shareController.useInviteCode);
router.get('/stats', shareController.getShareStats);

module.exports = router;