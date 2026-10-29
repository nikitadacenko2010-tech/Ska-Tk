const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  price: { type: DataTypes.FLOAT, allowNull: false },
  category: { type: DataTypes.STRING, defaultValue: 'other' },
  condition: { type: DataTypes.STRING, defaultValue: 'used' },
  images: { type: DataTypes.TEXT, defaultValue: '[]' },
  sellerId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'removed', 'sold'), defaultValue: 'active' },
  views: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { timestamps: true });