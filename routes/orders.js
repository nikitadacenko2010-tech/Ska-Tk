const express = require('express');
const nodemailer = require('nodemailer');
const { Order, Product, User, Analytics } = require('../models');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function deliveryLabel(type, subtype) {
  if (type === 'ukrposhta') return 'Укрпошта';
  return subtype === 'postomat' ? 'Нова пошта — поштомат' : 'Нова пошта — відділення';
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const { productId, contactName, contactSurname, contactPhone, contactEmail, deliveryType, deliverySubtype, city, department } = req.body;

    const product = await Product.findByPk(productId, { include: [{ model: User, as: 'seller', attributes: ['id','name','email'] }] });
    if (!product || product.status !== 'active') return res.status(400).json({ error: 'товар недоступний' });
    if (!contactName || !contactPhone || !city || !department) return res.status(400).json({ error: 'усі поля обовʼязкові' });
    if (!/^\+380\d{9}$/.test(contactPhone)) return res.status(400).json({ error: 'формат телефону +380XXXXXXXXX' });

    const order = await Order.create({
      buyerId: req.user.id,
      productId,
      contactName,
      contactSurname: contactSurname || '',
      contactPhone,
      contactEmail: contactEmail || '',
      deliveryType: deliveryType || 'nova_poshta',
      deliverySubtype: deliverySubtype || 'department',
      city,
      department
    });

    product.status = 'sold';
    await product.save();
    await Analytics.create({ event: 'order', userId: req.user.id, productId, ip: req.ip });

    // Лист адміну
    const adminHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f7fb;padding:20px;">
        <div style="background:linear-gradient(135deg,#0066cc,#0099e6);color:#fff;padding:24px;border-radius:14px 14px 0 0;">
          <h1 style="margin:0;font-size:22px;">🛒 Нове замовлення на Ska-Tka</h1>
        </div>
        <div style="background:#fff;padding:24px;border-radius:0 0 14px 14px;">
          <h2 style="font-size:16px;color:#0d2137;margin:0 0 12px;">Товар</h2>
          <p style="margin:0 0 20px;color:#486581;"><b>${product.title}</b><br>${product.price} грн</p>

          <h2 style="font-size:16px;color:#0d2137;margin:0 0 12px;">Покупець</h2>
          <p style="margin:0 0 20px;color:#486581;">
            Ім'я: <b>${contactName} ${contactSurname || ''}</b><br>
            Телефон: <b>${contactPhone}</b><br>
            Email: <b>${contactEmail || '—'}</b>
          </p>

          <h2 style="font-size:16px;color:#0d2137;margin:0 0 12px;">Доставка</h2>
          <p style="margin:0 0 20px;color:#486581;">
            Спосіб: <b>${deliveryLabel(deliveryType, deliverySubtype)}</b><br>
            Місто: <b>${city}</b><br>
            ${deliveryType === 'ukrposhta' ? 'Відділення / індекс' : (deliverySubtype === 'postomat' ? 'Поштомат' : 'Відділення')}: <b>${department}</b>
          </p>

          <p style="color:#64748b;font-size:12px;margin:0;">Замовлення #${order.id} · ${new Date().toLocaleString('uk-UA')}</p>
        </div>
      </div>`;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        await transporter.sendMail({
          from: `"Ska-Tka" <${process.env.EMAIL_USER}>`,
          to: process.env.ADMIN_EMAIL || 'nikitadacenko2010@gmail.com',
          subject: `🛒 Нове замовлення: ${product.title}`,
          html: adminHtml
        });
      } catch (mailErr) {
        console.error('Email admin failed:', mailErr.message);
      }

      // Копія покупцю, якщо вказав email
      if (contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        try {
          await transporter.sendMail({
            from: `"Ska-Tka" <${process.env.EMAIL_USER}>`,
            to: contactEmail,
            subject: `Ваше замовлення на Ska-Tka: ${product.title}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h1 style="color:#0066cc;">Дякуємо за замовлення!</h1>
              <p>Ви замовили: <b>${product.title}</b> — ${product.price} грн.</p>
              <p>Доставка: <b>${deliveryLabel(deliveryType, deliverySubtype)}</b>, ${city}, ${department}.</p>
              <p>Ми зв'яжемося з вами найближчим часом.</p>
              <p style="color:#64748b;font-size:12px;">Ska-Tka · Дяченко Нікіта Ігорович · +38 (099) 105-18-39</p>
            </div>`
          });
        } catch (e) { console.error('Email buyer failed:', e.message); }
      }
    }

    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'помилка сервера' });
  }
});

router.get('/my', requireAuth, async (req, res) => {
  const orders = await Order.findAll({ where: { buyerId: req.user.id }, include: [{ model: Product, as: 'product' }], order: [['createdAt','DESC']] });
  res.json(orders.map(o => ({ ...o.toJSON(), product: o.product && { ...o.product.toJSON(), images: JSON.parse(o.product.images || '[]') } })));
});

module.exports = router;