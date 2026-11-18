const userService = require('../services/user.service');

async function listUsersCtrl(req, res, next) {
  try {
    const result = await userService.listUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function updateUserStatusCtrl(req, res, next) {
  try {
    const { is_active } = req.body;
    const result = await userService.updateUserStatus(
      req.params.id,
      is_active,
      req.user.id
    );
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function resetUserPasswordCtrl(req, res, next) {
  try {
    const result = await userService.resetUserPassword(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getLoginAuditCtrl(req, res, next) {
  try {
    const result = await userService.getLoginAudit(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listUsersCtrl,
  updateUserStatusCtrl,
  resetUserPasswordCtrl,
  getLoginAuditCtrl,
};
