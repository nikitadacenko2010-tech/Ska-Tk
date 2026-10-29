const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'admin'), defaultValue: 'user' },
  isBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  avatar: { type: DataTypes.TEXT, defaultValue: '' },
  resetToken: { type: DataTypes.STRING, allowNull: true },
  resetTokenExpires: { type: DataTypes.DATE, allowNull: true }
}, { timestamps: true });