
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    maDonHang: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    maTaiKhoan: {
      type: String,
      required: true,
      trim: true
    },

    sanPham: [
      {
        maGame: {
          type: String,
          required: true
        },

        tenGame: {
          type: String,
          required: true
        },

        donGia: {
          type: Number,
          required: true,
          min: 0
        },

        // Game được mua hay được tặng
        laQua: {
          type: Boolean,
          default: false
        },

        // Tài khoản nhận game nếu là quà tặng
        nguoiNhan: {
          type: String,
          default: ''
        },

        loiNhan: {
          type: String,
          default: ''
        }
      }
    ],

    // Tổng tiền trước khi áp dụng mã giảm giá
    tongTienGoc: {
      type: Number,
      default: 0,
      min: 0
    },

    // Mã khuyến mãi đã sử dụng
    maKhuyenMai: {
      type: String,
      default: '',
      trim: true
    },

    // Phần trăm giảm của mã khuyến mãi
    phanTramGiamGia: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    // Số tiền được giảm
    soTienGiam: {
      type: Number,
      default: 0,
      min: 0
    },

    // Tổng tiền thực tế sau giảm giá
    tongTien: {
      type: Number,
      required: true,
      min: 0
    },

    phuongThucThanhToan: {
      type: String,
      default: 'wallet'
    },

    trangThai: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'completed'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Order', orderSchema);
