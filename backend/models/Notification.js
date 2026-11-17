
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationCampaign',
    default: null
  },

  maTaiKhoan: {
    type: String,
    trim: true,
    index: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  title: { type: String, trim: true },
  desc: { type: String, trim: true },
  tieuDe: { type: String, trim: true },
  noiDung: { type: String, trim: true },

  icon: {
    type: String,
    default: '🔔'
  },

  category: {
    type: String,
    default: 'system'
  },

  loaiThongBao: {
    type: String,
    default: 'system'
  },

  isRead: {
    type: Boolean,
    default: false
  },

  daDoc: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

notificationSchema.index({
  maTaiKhoan: 1,
  createdAt: -1
});

notificationSchema.index(
  { campaignId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      campaignId: { $type: 'objectId' },
      userId: { $type: 'objectId' }
    }
  }
);

module.exports = mongoose.model(
  'Notification',
  notificationSchema
);
