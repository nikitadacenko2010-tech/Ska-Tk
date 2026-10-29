const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_STORAGE || './db/skatka.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

const User = require('./User')(sequelize);
const Product = require('./Product')(sequelize);
const Order = require('./Order')(sequelize);
const Analytics = require('./Analytics')(sequelize);
const Favorite = require('./Favorite')(sequelize);

User.hasMany(Product, { foreignKey: 'sellerId', as: 'products' });
Product.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

User.hasMany(Order, { foreignKey: 'buyerId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });
Order.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

User.hasMany(Favorite, { foreignKey: 'userId' });
Favorite.belongsTo(User, { foreignKey: 'userId' });
Favorite.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

module.exports = { sequelize, User, Product, Order, Analytics, Favorite };