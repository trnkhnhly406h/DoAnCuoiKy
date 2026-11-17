const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    tenTaiKhoan: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    vaiTro: {
      type: String,
      default: 'admin'
    },
    hanhDong: {
      type: String,
      required: true
    },
    chiTiet: {
      type: String,
      default: ''
    },
    phuongThuc: {
      type: String,
      default: 'POST'
    },
    duongDan: {
      type: String,
      default: ''
    },
    diaChiIp: {
      type: String,
      default: '127.0.0.1'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);