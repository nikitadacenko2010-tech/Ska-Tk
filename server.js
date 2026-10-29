require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');

const app = express();

if (!fs.existsSync('./db')) fs.mkdirSync('./db');
if (!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads', { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
sequelize.sync().then(() => {
  app.listen(PORT, () => console.log(`Ska-Tka on http://localhost:${PORT}`));
});