const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Analytics', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  event: { type: DataTypes.STRING, allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  productId: { type: DataTypes.INTEGER, allowNull: true },
  ip: { type: DataTypes.STRING, defaultValue: '' }
}, { timestamps: true });