const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  loginSchema,
  registerSchema,
  refreshSchema,
} = require('../validators/auth.schema');
const {
  loginCtrl,
  refreshCtrl,
  logoutCtrl,
  registerCtrl,
  meCtrl,
  changePasswordCtrl,
  updateProfileCtrl,
} = require('../controllers/auth.controller');

const router = express.Router();

const isTest = process.env.NODE_ENV === 'test';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: 'Too many registration attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

router.post('/login', loginLimiter, validate(loginSchema), loginCtrl);
router.post('/refresh', validate(refreshSchema), refreshCtrl);
router.post('/logout', authenticate, logoutCtrl);
router.post('/register', registerLimiter, validate(registerSchema), registerCtrl);
router.get('/me', authenticate, meCtrl);
router.patch('/password', authenticate, changePasswordCtrl);
router.patch('/profile', authenticate, updateProfileCtrl);

module.exports = router;
