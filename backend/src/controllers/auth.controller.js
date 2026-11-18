const authService = require('../services/auth.service');
const config = require('../config');

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

async function loginCtrl(req, res, next) {
  try {
    const { email, password } = req.body;
    const { accessToken, refreshToken, user } = await authService.login(
      email,
      password,
      req
    );

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.status(200).json({
      accessToken,
      user,
    });
  } catch (err) {
    return next(err);
  }
}

async function refreshCtrl(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const { accessToken, refreshToken } = await authService.refresh(token, req);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.status(200).json({
      accessToken,
    });
  } catch (err) {
    return next(err);
  }
}

async function logoutCtrl(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(token, req.user.id);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.nodeEnv === 'production',
      sameSite: 'strict',
    });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

async function registerCtrl(req, res, next) {
  try {
    const user = await authService.register(req.body);
    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
}

async function meCtrl(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return res.status(200).json({ user });
  } catch (err) {
    return next(err);
  }
}


async function changePasswordCtrl(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body);
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    return next(err);
  }
}

async function updateProfileCtrl(req, res, next) {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    return res.status(200).json({ user });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  loginCtrl,
  refreshCtrl,
  logoutCtrl,
  registerCtrl,
  meCtrl,
  changePasswordCtrl,
  updateProfileCtrl,
};
