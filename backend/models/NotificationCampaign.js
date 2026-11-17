
const mongoose = require('mongoose');

const notificationCampaignSchema = new mongoose.Schema({
  tieuDe: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  noiDung: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  loai: {
    type: String,
    enum: ['Hệ thống', 'Khuyến mãi', 'Đơn hàng'],
    default: 'Hệ thống'
  },
  nguon: {
    type: String,
    enum: ['admin', 'system'],
    default: 'admin'
  },
  doiTuong: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'
  },
  nguoiNhanCuThe: {
    type: String,
    default: '',
    trim: true
  },
  trangThai: {
    type: String,
    enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
    default: 'draft'
  },
  henGuiLuc: {
    type: Date,
    default: null
  },
  daGuiLuc: {
    type: Date,
    default: null
  },
  soNguoiNhan: {
    type: Number,
    default: 0
  },
  loiGui: {
    type: String,
    default: ''
  },
  requestId: {
    type: String,
    trim: true
  }
}, { timestamps: true });

notificationCampaignSchema.index({
  trangThai: 1,
  henGuiLuc: 1
});

notificationCampaignSchema.index(
  { requestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      requestId: { $type: 'string' }
    }
  }
);

module.exports = mongoose.model(
  'NotificationCampaign',
  notificationCampaignSchema
);
