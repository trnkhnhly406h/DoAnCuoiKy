const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    maGame: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true
    },

    maTaiKhoan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    khuyenNghi: {
      type: Boolean,
      default: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5
    },
    noiDung: {
      type: String,
      default: '',
      trim: true
    },

    ngayDanhGia: {
      type: Date,
      default: Date.now
    },

    an: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Review', reviewSchema);