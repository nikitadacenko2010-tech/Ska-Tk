const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User, Analytics } = require('../models');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const limiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'забагато спроб' } });

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function sign(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post('/register', limiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'усі поля обовʼязкові' });
    if (password.length < 6) return res.status(400).json({ error: 'пароль мінімум 6 символів' });
    const exists = await User.findOne({ where: { email } });
    if (exists) return res.status(409).json({ error: 'email вже зайнятий' });
    const passwordHash = await bcrypt.hash(password, 10);
    const isFirst = (await User.count()) === 0;
    const user = await User.create({ email, passwordHash, name, role: isFirst ? 'admin' : 'user' });
    setCookie(res, sign(user));
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) { console.error(e); res.status(500).json({ error: 'помилка сервера' }); }
});

router.post('/login', limiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'невірні дані' });
    if (user.isBlocked) return res.status(403).json({ error: 'акаунт заблоковано' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'невірні дані' });
    setCookie(res, sign(user));
    await Analytics.create({ event: 'login', userId: user.id, ip: req.ip });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) { res.status(500).json({ error: 'помилка сервера' }); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id','email','name','role','avatar','isBlocked'] });
  if (!user) return res.status(404).json({ error: 'не знайдено' });
  res.json(user);
});

router.post('/visit', async (req, res) => {
  await Analytics.create({ event: 'visit', ip: req.ip });
  res.json({ ok: true });
});

router.post('/forgot-password', limiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'вкажіть email' });
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetToken = tokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const link = `${baseUrl}/reset-password.html?token=${token}`;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await mailer.sendMail({
          from: `"Ska-Tka" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Відновлення паролю Ska-Tka',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f4f7fb;">
              <div style="background:linear-gradient(135deg,#0066cc,#0099e6);color:#fff;padding:24px;border-radius:14px 14px 0 0;">
                <h1 style="margin:0;font-size:22px;">Відновлення паролю</h1>
              </div>
              <div style="background:#fff;padding:24px;border-radius:0 0 14px 14px;">
                <p style="color:#486581;font-size:15px;font-weight:700;">Ви запросили зміну паролю на Ska-Tka.</p>
                <p style="color:#486581;font-size:15px;font-weight:700;">Натисніть кнопку нижче, щоб встановити новий пароль. Посилання дійсне 1 годину.</p>
                <p style="text-align:center;margin:28px 0;">
                  <a href="${link}" style="background:#0066cc;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:900;display:inline-block;">Змінити пароль</a>
                </p>
                <p style="color:#64748b;font-size:12px;">Якщо ви не запитували зміну паролю — просто проігноруйте цей лист.</p>
              </div>
            </div>`
        });
      } catch (e) { console.error('Forgot email failed:', e.message); }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'помилка сервера' }); }
});

router.post('/reset-password', limiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'усі поля обовʼязкові' });
    if (password.length < 6) return res.status(400).json({ error: 'пароль мінімум 6 символів' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ where: { resetToken: tokenHash } });
    if (!user) return res.status(400).json({ error: 'невірне або прострочене посилання' });
    if (new Date(user.resetTokenExpires) < new Date()) {
      return res.status(400).json({ error: 'посилання прострочене' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'помилка сервера' }); }
});

module.exports = router;