// Tự xóa khách hàng đã quá hạn chờ khôi phục.
// Tác vụ chạy ở server, không phụ thuộc vào việc Admin mở trang web.
const User = require('../models/User');
const Order = require('../models/Order');
const RefundRequest = require('../models/RefundRequest');
const Review = require('../models/Review');
const Notification = require('../models/Notification');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getDeletionDeadline(now = new Date()) {
  // Chỉ để demo tại máy phát triển: DELETION_DEMO_MINUTES=2.
  // Tuyệt đối không rút ngắn thời hạn trong môi trường production.
  const demoMinutes = process.env.NODE_ENV === 'production'
    ? 0
    : Number(process.env.DELETION_DEMO_MINUTES || 0);
  const durationMs = Number.isFinite(demoMinutes) && demoMinutes > 0
    ? demoMinutes * 60 * 1000
    : THIRTY_DAYS_MS;
  return new Date(now.getTime() + durationMs);
}

async function notifyAdmins(title, desc) {
  try {
    const admins = await User.find({ vaiTro: 'admin' })
      .select('_id maTaiKhoan').lean();
    if (!admins.length) return;
    await Notification.insertMany(admins.map(admin => ({
      userId: admin._id,
      maTaiKhoan: admin.maTaiKhoan,
      title,
      desc,
      category: 'system',
      loaiThongBao: 'account_deleted',
      icon: '👤',
      isRead: false,
      daDoc: false
    })));
  } catch (error) {
    // Không đảo ngược việc khóa/xóa chỉ vì gửi thông báo thất bại.
    console.warn('[AccountDeletion] Lỗi gửi thông báo Admin:', error.message);
  }
}

async function deleteOneExpiredAccount(userId) {
  const user = await User.findOne({
    _id: userId,
    vaiTro: 'customer',
    biKhoa: true,
    yeuCauXoaTaiKhoan: true,
    hanXoaTaiKhoan: { $lte: new Date() }
  });
  if (!user) return false;

  const oldCode = user.maTaiKhoan;
  const hiddenCode = `deleted-${user._id}`;

  // Chạy tuần tự, idempotent: nếu một bước lỗi, lần quét sau tiếp tục.
  // Không xóa hóa đơn để bảo toàn lịch sử báo cáo và hoàn tiền.
  await Order.updateMany(
    { maTaiKhoan: oldCode },
    { $set: { maTaiKhoan: hiddenCode } }
  );
  await RefundRequest.updateMany(
    { maTaiKhoan: oldCode },
    { $set: { maTaiKhoan: hiddenCode } }
  );
  await Review.deleteMany({ maTaiKhoan: user._id });
  await Notification.deleteMany({
    $or: [
      { userId: user._id },
      { maTaiKhoan: oldCode }
    ]
  });

  // Chỉ xóa khi thời hạn đã hết và yêu cầu chưa bị Admin hủy.
  const removed = await User.deleteOne({
    _id: user._id,
    vaiTro: 'customer',
    biKhoa: true,
    yeuCauXoaTaiKhoan: true,
    hanXoaTaiKhoan: { $lte: new Date() }
  });
  if (removed.deletedCount !== 1) return false;

  console.log(`[AccountDeletion] Tự động xóa khách hàng ${oldCode}`);
  await notifyAdmins(
    'Hệ thống đã tự động xóa tài khoản quá hạn',
    `Tài khoản ${user.tenDangNhap} (${oldCode}) đã hết hạn khôi phục và được xóa tự động.`
  );
  return true;
}

let isScanning = false;
async function scanExpiredAccounts() {
  if (isScanning) return;
  isScanning = true;
  try {
    const expired = await User.find({
      vaiTro: 'customer',
      biKhoa: true,
      yeuCauXoaTaiKhoan: true,
      hanXoaTaiKhoan: { $lte: new Date() }
    })
      .select('_id')
      .sort({ hanXoaTaiKhoan: 1 })
      .limit(100)
      .lean();

    for (const user of expired) {
      try {
        await deleteOneExpiredAccount(user._id);
      } catch (error) {
        console.error(`[AccountDeletion] Lỗi xóa ${user._id}:`, error);
      }
    }
  } catch (error) {
    console.error('[AccountDeletion] Lỗi quét tài khoản:', error);
  } finally {
    isScanning = false;
  }
}

function startAccountDeletionScheduler() {
  void scanExpiredAccounts(); // Kiểm tra ngay khi server kết nối MongoDB.
  const timer = setInterval(() => {
    void scanExpiredAccounts();
  }, 60 * 1000);
  timer.unref?.();
}

module.exports = {
  getDeletionDeadline,
  notifyAdmins,
  startAccountDeletionScheduler,
  scanExpiredAccounts
};
