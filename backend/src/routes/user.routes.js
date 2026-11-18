const express = require('express');
const { z } = require('zod');
const { authenticate, authorizeRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  listUsersCtrl,
  updateUserStatusCtrl,
  resetUserPasswordCtrl,
} = require('../controllers/user.controller');

const router = express.Router();

const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
});

router.use(authenticate, authorizeRole('admin'));

router.get('/', listUsersCtrl);
router.patch('/:id/status', validate(updateUserStatusSchema), updateUserStatusCtrl);
router.post('/:id/reset-password', resetUserPasswordCtrl);

module.exports = router;
