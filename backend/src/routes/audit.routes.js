const express = require('express');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { getLoginAuditCtrl } = require('../controllers/user.controller');

const router = express.Router();

router.get('/login', authenticate, authorizeRole('admin'), getLoginAuditCtrl);

module.exports = router;
