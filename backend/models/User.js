const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    maTaiKhoan: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    tenDangNhap: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    soDienThoai: {
      type: String,
      default: '',
      trim: true
    },

    hoTen: {
      type: String,
      default: '',
      trim: true
    },

    matKhau: {
      type: String,
      required: true
    },

    anhDaiDien: {
      type: String,
      default: ''
    },

    vaiTro: {
      type: String,
      enum: ['customer', 'admin'],
      default: 'customer'
    },

    quyen: {
      type: [String],
      default: []
    },

    viTien: {
      type: Number,
      default: 0,
      min: 0
    },

    biKhoa: {
      type: Boolean,
      default: false
    },

    lyDoKhoa: {
      type: String,
      default: ''
    },
    ngayKhoa: {
      type: Date,
      default: null
    },

    // Chờ xóa tự động sau khi Customer yêu cầu đóng tài khoản.
    yeuCauXoaTaiKhoan: {
      type: Boolean,
      default: false
    },
    ngayYeuCauXoaTaiKhoan: {
      type: Date,
      default: null
    },
    hanXoaTaiKhoan: {
      type: Date,
      default: null
    },

    soNgayDaKhoa: {
      type: Number,
      default: 0
    },
    

    ngayDangKy: {
      type: Date
    },

    xacThuc2FA: {
      type: Boolean,
      default: false
    },

    quocTich: {
      type: String,
      default: ''
    },

    bio: {
      type: String,
      default: '',
      trim: true
    },

    searchUrl: {
      type: String,
      default: '',
      trim: true
    },

    danhSachGameDaMua: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game'
      }
    ],

    danhSachGameYeuThich: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Game'
      }
    ]
  },
  {
    timestamps: true
  }
  
);


// Không dùng TTL index: phải ẩn danh hóa lịch sử đơn hàng trước khi xóa User.
userSchema.index({ yeuCauXoaTaiKhoan: 1, hanXoaTaiKhoan: 1 });

module.exports = mongoose.model('User', userSchema);