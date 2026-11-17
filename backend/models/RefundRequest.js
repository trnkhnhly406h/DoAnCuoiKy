
const mongoose = require('mongoose');

const refundRequestSchema = new mongoose.Schema(
  {
    // Mã yêu cầu hoàn tiền
    maYeuCau: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // Tham chiếu đến đơn hàng
    maDonHang: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },

    // Mã tài khoản khách hàng
    maTaiKhoan: {
      type: String,
      required: true,
      trim: true
    },

    // Mã game cần hoàn tiền
    maGame: {
      type: String,
      required: true,
      trim: true
    },

    // Lý do khách hàng yêu cầu hoàn tiền
    lyDoKhachHang: {
      type: String,
      default: '',
      trim: true
    },

    // Trạng thái yêu cầu hoàn tiền
    trangThaiHoanTien: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    // Lý do Admin từ chối
    lyDoTuChoi: {
      type: String,
      default: '',
      trim: true
    },

    // Số tiền được duyệt hoàn
    soTienHoan: {
      type: Number,
      default: 0,
      min: 0
    },

    // Admin xử lý yêu cầu
    adminXuLy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Thời điểm khách gửi yêu cầu
    ngayYeuCau: {
      type: Date,
      default: Date.now
    },

    // Thời điểm Admin xử lý
    ngayXuLy: {
      type: Date,
      default: null
    },

    // Thời điểm hoàn tiền
    ngayHoanTien: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'RefundRequest',
  refundRequestSchema
);
