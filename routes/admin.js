const express = require('express');
const { Op } = require('sequelize');
const { User, Product, Order, Analytics } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', async (req, res) => {
  const [users, products, orders, removed] = await Promise.all([
    User.count(),
    Product.count({ where: { status: 'active' } }),
    Order.count(),
    Product.count({ where: { status: 'removed' } })
  ]);
  res.json({ users, products, orders, removed });
});

router.get('/analytics', async (req, res) => {
  const period = req.query.period === 'month' ? 30 : 1;
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
  const rows = await Analytics.findAll({ where: { createdAt: { [Op.gte]: since } } });
  const visits = rows.filter(r => r.event === 'visit').length;
  const views = rows.filter(r => r.event === 'view_product').length;
  const logins = rows.filter(r => r.event === 'login').length;
  const orders = rows.filter(r => r.event === 'order').length;
  const activeUsers = new Set(rows.filter(r => r.userId).map(r => r.userId)).size;
  res.json({ visits, views, logins, orders, activeUsers, period: period === 1 ? 'day' : 'month' });
});

router.get('/users', async (req, res) => {
  const users = await User.findAll({ attributes: ['id','email','name','role','isBlocked','createdAt'], order: [['createdAt','DESC']] });
  res.json(users);
});

router.put('/users/:id/block', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'не знайдено' });
  if (user.role === 'admin') return res.status(400).json({ error: 'адміна не блокуємо' });
  user.isBlocked = !!req.body.isBlocked;
  await user.save();
  res.json({ ok: true, isBlocked: user.isBlocked });
});

router.delete('/products/:id', async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'не знайдено' });
  product.status = 'removed';
  await product.save();
  res.json({ ok: true });
});

router.get('/products', async (req, res) => {
  const items = await Product.findAll({ include: [{ model: User, as: 'seller', attributes: ['id','name','email'] }], order: [['createdAt','DESC']] });
  res.json(items.map(i => ({ ...i.toJSON(), images: JSON.parse(i.images || '[]') })));
});

module.exports = router;