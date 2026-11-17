
const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    maKhuyenMai: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },

    moTa: {
      type: String,
      default: '',
      trim: true
    },

    phanTramGiamGia: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },

    ngayBatDau: {
      type: Date,
      required: true
    },

    ngayKetThuc: {
      type: Date,
      default: null
    },

    trangThai: {
      type: Boolean,
      default: true
    },

    chiApDungLanDau: {
      type: Boolean,
      default: false
    },

    daSuDung: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Promotion', promotionSchema);
