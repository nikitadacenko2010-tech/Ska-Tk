const express = require('express');
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { Product, User, Analytics, Favorite } = require('../models');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1e9) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const { category, minPrice, maxPrice, condition, search, sellerId, sort } = req.query;
  const where = { status: 'active' };
  if (category && category !== 'all') where.category = category;
  if (condition && condition !== 'all') where.condition = condition;
  if (sellerId) where.sellerId = sellerId;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price[Op.gte] = Number(minPrice);
    if (maxPrice) where.price[Op.lte] = Number(maxPrice);
  }
  if (search) where.title = { [Op.like]: `%${search}%` };

  let order = [['createdAt','DESC']];
  if (sort === 'price_asc') order = [['price','ASC']];
  else if (sort === 'price_desc') order = [['price','DESC']];
  else if (sort === 'popular') order = [['views','DESC']];
  else if (sort === 'old') order = [['createdAt','ASC']];

  const items = await Product.findAll({ where, include: [{ model: User, as: 'seller', attributes: ['id','name'] }], order });
  res.json(items.map(i => ({ ...i.toJSON(), images: JSON.parse(i.images || '[]') })));
});

router.get('/favorites/list', requireAuth, async (req, res) => {
  const favs = await Favorite.findAll({ where: { userId: req.user.id }, include: [{ model: Product, as: 'product' }] });
  res.json(favs.filter(f => f.product).map(f => ({ ...f.product.toJSON(), images: JSON.parse(f.product.images || '[]') })));
});

router.post('/favorites/:id', requireAuth, async (req, res) => {
  const exists = await Favorite.findOne({ where: { userId: req.user.id, productId: req.params.id } });
  if (exists) { await exists.destroy(); return res.json({ ok: true, favorited: false }); }
  await Favorite.create({ userId: req.user.id, productId: req.params.id });
  res.json({ ok: true, favorited: true });
});

router.get('/my/list', requireAuth, async (req, res) => {
  const items = await Product.findAll({ where: { sellerId: req.user.id }, order: [['createdAt','DESC']] });
  res.json(items.map(i => ({ ...i.toJSON(), images: JSON.parse(i.images || '[]') })));
});

router.get('/:id', async (req, res) => {
  const item = await Product.findByPk(req.params.id, { include: [{ model: User, as: 'seller', attributes: ['id','name'] }] });
  if (!item || item.status === 'removed') return res.status(404).json({ error: 'не знайдено' });
  await item.increment('views');
  await Analytics.create({ event: 'view_product', productId: item.id, ip: req.ip });
  res.json({ ...item.toJSON(), images: JSON.parse(item.images || '[]') });
});

router.post('/', requireAuth, requireAdmin, upload.array('images', 7), async (req, res) => {
  try {
    const { title, description, price, category, condition } = req.body;
    if (!title || !price) return res.status(400).json({ error: 'назва і ціна обовʼязкові' });
    const images = (req.files || []).slice(0, 7).map(f => '/uploads/' + f.filename);
    const product = await Product.create({
      title, description: description || '', price: Number(price),
      category: category || 'other', condition: condition || 'used',
      images: JSON.stringify(images), sellerId: req.user.id
    });
    res.json({ ...product.toJSON(), images });
  } catch (e) { res.status(500).json({ error: 'помилка сервера' }); }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'не знайдено' });
  const { title, description, price, category, condition } = req.body;
  if (title) product.title = title;
  if (description !== undefined) product.description = description;
  if (price) product.price = Number(price);
  if (category) product.category = category;
  if (condition) product.condition = condition;
  await product.save();
  res.json({ ...product.toJSON(), images: JSON.parse(product.images || '[]') });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: 'не знайдено' });
  if (product.sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'заборонено' });
  product.status = 'removed';
  await product.save();
  res.json({ ok: true });
});

module.exports = router;