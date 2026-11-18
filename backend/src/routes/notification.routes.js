const express = require('express');
const { authenticate } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/notifications — own unread + read
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT notif_id, user_id, type, message, read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.id]
    );
    const unreadCount = result.rows.filter((n) => !n.read).length;
    return res.status(200).json({ data: result.rows, unreadCount });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
      [req.user.id]
    );
    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET read = TRUE
       WHERE notif_id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    return res.status(200).json(result.rows[0] || { notif_id: req.params.id, read: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
