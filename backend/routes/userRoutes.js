const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const RefundRequest = require('../models/RefundRequest');
const AuditLog = require('../models/AuditLog'); // Bổ sung import AuditLog
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const bcrypt = require('bcryptjs');
const router = express.Router();

const Notification = require('../models/Notification');
const { getDeletionDeadline, notifyAdmins } = require('../services/accountDeletionService');

// ========================================
// HÀM HELPER: GHI NHẬT KÝ KIỂM VẾT THAO TÁC ADMIN
// ========================================

async function ghiNhatKy(req, hanhDong, chiTiet) {
  try {
    // Đánh dấu đã ghi log chi tiết để adminMiddleware không ghi trùng lần 2
    if (req) {
      req._auditLogged = true;
    }
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    await AuditLog.create({
      tenTaiKhoan: req.user?.tenDangNhap || req.user?.maTaiKhoan || 'Super Admin',
      vaiTro: req.user?.vaiTro || 'admin',
      hanhDong,
      chiTiet,
      phuongThuc: req.method,
      duongDan: req.originalUrl,
      diaChiIp: String(ip).replace('::ffff:', '')
    });
  } catch (err) {
    console.warn('Lỗi ghi nhật ký kiểm vết:', err.message);
  }
}
// ========================================
// HÀM HỖ TRỢ ĐỊNH DẠNG & TÍNH TOÁN
// ========================================

function formatDateVN(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function tinhSoNgayDaKhoa(biKhoa, ngayKhoa, updatedAt) {
  if (!biKhoa) return 0;
  const mocThoiGian = ngayKhoa || updatedAt;
  if (!mocThoiGian) return 1;
  const start = new Date(mocThoiGian);
  if (Number.isNaN(start.getTime())) return 1;
  const diffMs = Date.now() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

// ========================================
// 1. LẤY THÔNG TIN TÀI KHOẢN ĐANG ĐĂNG NHẬP (CUSTOMER / ADMIN)
// GET /api/store/users/me
// ========================================

router.get('/users/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-matKhau');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Lỗi lấy thông tin tài khoản:', error);

    res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin tài khoản'
    });
  }
});


// ========================================
// 1.1. KHÁCH HÀNG: CẬP NHẬT HỒ SƠ CÁ NHÂN
// PUT /api/store/users/me
// ========================================


router.put('/users/me', authMiddleware, async (req, res) => {
  try {
    const {
      hoTen,
      username,
      anhDaiDien,
      quocTich,
      bio,
      searchUrl,
      email,
      soDienThoai
    } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }

    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // 1. CẬP NHẬT EMAIL
    if (email !== undefined) {
      const normalizedEmail = String(email)
        .trim()
        .toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Email không hợp lệ'
        });
      }

      const exists = await User.exists({
        email: normalizedEmail,
        _id: { $ne: user._id }
      });

      if (exists) {
        return res.status(409).json({
          success: false,
          message: 'Email đã được sử dụng'
        });
      }

      user.email = normalizedEmail;
    }

    // 2. CẬP NHẬT SỐ ĐIỆN THOẠI
    
if (soDienThoai !== undefined) {
  const phone = String(soDienThoai)
    .trim()
    .replace(/[\s().-]/g, '');

  if (phone && !/^\+?[0-9]{9,15}$/.test(phone)) {
    return res.status(400).json({
      success: false,
      message: 'Số điện thoại không hợp lệ'
    });
  }

  user.soDienThoai = phone;
}


    // 3. CẬP NHẬT TÊN HIỂN THỊ
    const tenMoi = String(hoTen || username || '').trim();

    if (tenMoi) {
      user.hoTen = tenMoi;
    }

    // 4. CẬP NHẬT ẢNH ĐẠI DIỆN
    if (
      anhDaiDien !== undefined &&
      String(anhDaiDien).trim()
    ) {
      user.anhDaiDien = String(anhDaiDien).trim();
    }

    // 5. CẬP NHẬT QUỐC TỊCH
    if (
      quocTich !== undefined &&
      String(quocTich).trim()
    ) {
      user.quocTich = String(quocTich).trim();
    }

    // 6. CẬP NHẬT TIỂU SỬ
    if (bio !== undefined) {
      user.bio = String(bio).trim();
    }

    // 7. CẬP NHẬT URL HỒ SƠ
    if (searchUrl !== undefined) {
      user.searchUrl = String(searchUrl).trim();
    }

    // 8. LƯU THẬT VÀO MONGODB
    await user.save();

    return res.json({
      success: true,
      message: 'Cập nhật thông tin tài khoản thành công',
      data: {
        _id: user._id,
        maTaiKhoan: user.maTaiKhoan,
        tenDangNhap: user.tenDangNhap,
        email: user.email,
        soDienThoai: user.soDienThoai,
        hoTen: user.hoTen,
        anhDaiDien: user.anhDaiDien,
        quocTich: user.quocTich,
        bio: user.bio,
        searchUrl: user.searchUrl
      }
    });

  } catch (error) {
    console.error('Lỗi cập nhật tài khoản:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email đã tồn tại trong hệ thống'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật tài khoản'
    });
  }
});


router.put(
  '/users/me/password',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user.vaiTro !== 'customer') {
        return res.status(403).json({
          success: false,
          message: 'Chỉ khách hàng được sử dụng'
        });
      }

      const matKhauCu = String(req.body.matKhauCu || '');
      const matKhauMoi = String(req.body.matKhauMoi || '');

      const passwordRegex =
        /^(?=.*[A-Z])(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

      if (!passwordRegex.test(matKhauMoi)) {
        return res.status(400).json({
          success: false,
          message:
            'Mật khẩu mới cần ít nhất 8 ký tự, chữ hoa, chữ cái, số và ký tự đặc biệt'
        });
      }

      const user = await User.findById(req.user._id);

      if (
        !user ||
        !(await bcrypt.compare(matKhauCu, user.matKhau))
      ) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu hiện tại không đúng'
        });
      }

      if (await bcrypt.compare(matKhauMoi, user.matKhau)) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu mới phải khác mật khẩu cũ'
        });
      }

      user.matKhau = await bcrypt.hash(matKhauMoi, 10);
      await user.save();

      return res.json({
        success: true,
        message: 'Đổi mật khẩu thành công'
      });

    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể đổi mật khẩu'
      });
    }
  }
);

// Customer yêu cầu đóng tài khoản: khóa ngay, chờ xóa tự động sau 30 ngày.
// DELETE /api/store/users/me (giữ nguyên contract cho frontend cũ).
router.delete('/users/me', authMiddleware, async (req, res) => {
  try {
    if (req.user.vaiTro !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Customer mới có thể yêu cầu xóa tài khoản'
      });
    }

    if (req.body?.confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        message: 'Cần xác nhận DELETE'
      });
    }

    const pendingRefund = await RefundRequest.exists({
      maTaiKhoan: req.user.maTaiKhoan,
      trangThaiHoanTien: 'pending'
    });
    if (pendingRefund) {
      return res.status(409).json({
        success: false,
        message: 'Tài khoản có yêu cầu hoàn tiền đang chờ xử lý. Vui lòng xử lý xong trước khi yêu cầu xóa.'
      });
    }

    const now = new Date();
    const expiry = getDeletionDeadline(now);
    const lockedUser = await User.findOneAndUpdate(
      {
        _id: req.user._id,
        vaiTro: 'customer',
        biKhoa: false,
        yeuCauXoaTaiKhoan: { $ne: true }
      },
      {
        $set: {
          biKhoa: true,
          lyDoKhoa: 'Khách hàng yêu cầu xóa tài khoản (chờ xóa tự động)',
          ngayKhoa: now,
          yeuCauXoaTaiKhoan: true,
          ngayYeuCauXoaTaiKhoan: now,
          hanXoaTaiKhoan: expiry
        }
      },
      { new: true }
    );

    if (!lockedUser) {
      return res.status(409).json({
        success: false,
        message: 'Tài khoản đã bị khóa hoặc đã có yêu cầu xóa.'
      });
    }

    await notifyAdmins(
      'Khách hàng yêu cầu xóa tài khoản',
      `Tài khoản ${lockedUser.tenDangNhap} (${lockedUser.maTaiKhoan}) đang khóa chờ xóa, hạn ${formatDateVN(expiry)}. Admin có thể mở khóa khi xác minh yêu cầu khôi phục qua email.`
    );

    return res.json({
      success: true,
      message: `Đã khóa tài khoản và lên lịch xóa tự động vào ${formatDateVN(expiry)}. Liên hệ hỗ trợ qua email để yêu cầu khôi phục trước hạn.`,
      data: {
        biKhoa: true,
        yeuCauXoaTaiKhoan: true,
        ngayYeuCauXoaTaiKhoan: now,
        hanXoaTaiKhoan: expiry
      }
    });
  } catch (error) {
    console.error('Lỗi tiếp nhận yêu cầu xóa tài khoản:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tiếp nhận yêu cầu xóa tài khoản'
    });
  }
});

// ========================================
// 2. ADMIN: LẤY DANH SÁCH KHÁCH HÀNG
// GET /api/store/admin/customers
// Chỉ lấy tài khoản vaiTro = 'customer', không trả về matKhau
// ========================================

router.get(
  '/admin/customers',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const customers = await User.find({ vaiTro: 'customer' })
        .select('-matKhau')
        .sort({ maTaiKhoan: 1, createdAt: -1 })
        .lean();

      const orders = await Order.find({})
        .select('maTaiKhoan tongTien trangThai')
        .lean();

      // Thống kê tổng đơn và tổng chi tiêu (chỉ cộng tiền các đơn completed)
      const orderStatsMap = new Map();

      for (const ord of orders) {
        const key = String(ord.maTaiKhoan || '').trim();
        if (!key) continue;

        if (!orderStatsMap.has(key)) {
          orderStatsMap.set(key, { tongDon: 0, tongChiTieu: 0 });
        }

        const stat = orderStatsMap.get(key);
        stat.tongDon += 1;

        if (ord.trangThai === 'completed') {
          stat.tongChiTieu += Number(ord.tongTien) || 0;
        }
      }

      const data = customers.map(u => {
        const stat = orderStatsMap.get(String(u.maTaiKhoan)) || {
          tongDon: 0,
          tongChiTieu: 0
        };

        const lyDo =
          u.lyDoKhoa && u.lyDoKhoa !== 'null' ? u.lyDoKhoa : '';

        return {
          _id: u._id,
          maTaiKhoanNguoiDung: u.maTaiKhoan,
          tenTaiKhoanNguoiDung: u.tenDangNhap,
          hoTen: u.hoTen || u.tenDangNhap,
          email: u.email,
          soDienThoai: u.soDienThoai || '',
          anhDaiDien: u.anhDaiDien || null,
          trangThaiKhoa: Boolean(u.biKhoa),
          dangChoXoa: Boolean(u.yeuCauXoaTaiKhoan),
          ngayYeuCauXoa: formatDateVN(u.ngayYeuCauXoaTaiKhoan),
          hanXoaTaiKhoan: formatDateVN(u.hanXoaTaiKhoan),
          lyDoKhoa: lyDo,
          ngayKhoa: formatDateVN(u.ngayKhoa),
          ngayDangKy: formatDateVN(u.ngayDangKy || u.createdAt),
          quocTich: u.quocTich || '',
          tongChiTieu: stat.tongChiTieu,
          tongDon: stat.tongDon,
          soNgayDaKhoa: tinhSoNgayDaKhoa(u.biKhoa, u.ngayKhoa, u.updatedAt)
        };
      });

      return res.json({
        success: true,
        total: data.length,
        data
      });
    } catch (error) {
      console.error('Lỗi Admin lấy danh sách khách hàng:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách khách hàng'
      });
    }
  }
);

// ========================================
// 3. ADMIN: XEM CHI TIẾT KHÁCH HÀNG
// GET /api/store/admin/customers/:id
// Hỗ trợ tìm theo maTaiKhoan (VD: CUS-001) hoặc MongoDB _id
// ========================================

router.get(
  '/admin/customers/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

     const query = mongoose.Types.ObjectId.isValid(id)
        ? {
            vaiTro: 'customer',
            $or: [{ _id: id }, { maTaiKhoan: id }, { tenDangNhap: id }]
          }
        : {
            vaiTro: 'customer',
            $or: [{ maTaiKhoan: id }, { tenDangNhap: id }]
          };

      const user = await User.findOne(query)
        .select('-matKhau')
        .populate('danhSachGameDaMua', 'maGame tenTroChoi anhBia anhThuNho giaHienTai')
        .lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy khách hàng'
        });
      }

      // 1. Lấy lịch sử đơn hàng của khách hàng
      const orders = await Order.find({ maTaiKhoan: user.maTaiKhoan })
        .sort({ createdAt: -1 })
        .lean();

      // Lấy danh sách yêu cầu hoàn tiền đã được duyệt của khách hàng này để hiển thị trạng thái đơn
      const approvedRefunds = await RefundRequest.find({
        maTaiKhoan: user.maTaiKhoan,
        trangThaiHoanTien: 'approved'
      })
        .select('maDonHang maGame')
        .lean();

      const refundedOrderIds = new Set(
        approvedRefunds.map(rf => String(rf.maDonHang))
      );

      // Map ngày mua của từng game từ đơn hàng thành công
      const gamePurchaseDateMap = new Map();
      for (const ord of orders) {
        if (ord.trangThai === 'completed' && Array.isArray(ord.sanPham)) {
          for (const sp of ord.sanPham) {
            if (sp.maGame && !gamePurchaseDateMap.has(sp.maGame)) {
              gamePurchaseDateMap.set(sp.maGame, formatDateVN(ord.createdAt));
            }
          }
        }
      }

      const danhSachDonHang = orders.map((ord, index) => {
        const tenGames = Array.isArray(ord.sanPham)
          ? ord.sanPham.map(sp => sp.tenGame).filter(Boolean).join(', ')
          : '';

        let trangThaiDonHang = 'thanh_cong';
        if (ord.trangThai === 'cancelled') {
          trangThaiDonHang = 'da_huy';
        } else if (refundedOrderIds.has(String(ord._id))) {
          trangThaiDonHang = 'hoan_tien';
        }

        return {
          _id: ord._id,
          stt: index + 1,
          maDonHang: ord.maDonHang,
          ngayTao: formatDateVN(ord.createdAt),
          danhsachGame: tenGames,
          tongTien: Number(ord.tongTien) || 0,
          phuongThucThanhToan: ord.phuongThucThanhToan || 'Ví STEAL',
          trangThaiDonHang
        };
      });

      // 2. Lấy thư viện game thực tế từ danhSachGameDaMua đã populate
      const danhSachGameThuVien = Array.isArray(user.danhSachGameDaMua)
        ? user.danhSachGameDaMua
            .filter(Boolean)
            .map(game => ({
              maGame: game.maGame,
              tenGame: game.tenTroChoi,
              anhGame: game.anhBia || game.anhThuNho || '',
              ngayMua:
                gamePurchaseDateMap.get(game.maGame) ||
                formatDateVN(user.ngayDangKy || user.createdAt)
            }))
        : [];

      // 3. Lấy danh sách đánh giá (Review) của khách hàng
      const reviews = await Review.find({ maTaiKhoan: user._id })
        .populate('maGame', 'maGame tenTroChoi anhBia anhThuNho')
        .sort({ ngayDanhGia: -1 })
        .lean();

      const danhSachReviews = reviews.map(rv => ({
        _id: rv._id,
        maTaiKhoanNguoiDung: user.maTaiKhoan,
        tenTaiKhoanNguoiDung: user.tenDangNhap,
        anhDaiDien: user.anhDaiDien || '',
        maGame: rv.maGame?.maGame || '',
        tenGame: rv.maGame?.tenTroChoi || 'Không xác định',
        anhGame: rv.maGame?.anhBia || rv.maGame?.anhThuNho || '',
        danhGia: rv.khuyenNghi ? 'khuyen_dung' : 'khong_khuyen_dung',
        rating: rv.rating || 5,
        noiDung: rv.noiDung || '',
        ngayDanhGia: formatDateVN(rv.ngayDanhGia || rv.createdAt),
        trangThai: rv.an ? 'an' : 'hien_thi'
      }));

      const lyDo =
        user.lyDoKhoa && user.lyDoKhoa !== 'null' ? user.lyDoKhoa : '';

      const khachHang = {
        _id: user._id,
        maTaiKhoanNguoiDung: user.maTaiKhoan,
        tenTaiKhoanNguoiDung: user.tenDangNhap,
        hoTen: user.hoTen || user.tenDangNhap,
        email: user.email,
        soDienThoai: user.soDienThoai || 'Chưa cập nhật',
        anhDaiDien: user.anhDaiDien || null,
        ngayDangKy: formatDateVN(user.ngayDangKy || user.createdAt),
        quocTich: user.quocTich || '',
        viTien: Number(user.viTien) || 0,
        trangThaiKhoa: Boolean(user.biKhoa),
        dangChoXoa: Boolean(user.yeuCauXoaTaiKhoan),
        ngayYeuCauXoa: formatDateVN(user.ngayYeuCauXoaTaiKhoan),
        hanXoaTaiKhoan: formatDateVN(user.hanXoaTaiKhoan),
        lyDoKhoa: lyDo,
        ngayKhoa: formatDateVN(user.ngayKhoa || (user.biKhoa ? user.updatedAt : null)),
        soNgayDaKhoa: tinhSoNgayDaKhoa(user.biKhoa, user.ngayKhoa, user.updatedAt),
        danhSachDonHang,
        danhSachGameThuVien
      };

      return res.json({
        success: true,
        data: {
          khachHang,
          danhSachReviews
        }
      });
    } catch (error) {
      console.error('Lỗi Admin xem chi tiết khách hàng:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy thông tin chi tiết khách hàng'
      });
    }
  }
);

// ========================================
// 4. ADMIN: KHÓA / MỞ KHÓA TÀI KHOẢN KHÁCH HÀNG
// PATCH /api/store/admin/customers/:id/lock-status
// ========================================

// ========================================
// 4. ADMIN: KHÓA / MỞ KHÓA TÀI KHOẢN KHÁCH HÀNG
// PATCH /api/store/admin/customers/:id/lock-status
// ========================================

router.patch(
  '/admin/customers/:id/lock-status',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { trangThaiKhoa, lyDoKhoa } = req.body;

      const isLocked = Boolean(trangThaiKhoa);
      const reason = isLocked
        ? String(lyDoKhoa || 'Vi phạm chính sách').trim()
        : '';

      const query = mongoose.Types.ObjectId.isValid(id)
        ? { vaiTro: 'customer', $or: [{ _id: id }, { maTaiKhoan: id }] }
        : { vaiTro: 'customer', maTaiKhoan: id };

      const user = await User.findOne(query);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản khách hàng'
        });
      }

      if (!isLocked && user.yeuCauXoaTaiKhoan) {
        // Chỉ Admin được mở khóa khi chưa hết thời gian khôi phục.
        // Đồng thời hủy lịch xóa để tác vụ tự động không xóa nhầm.
        const restored = await User.findOneAndUpdate(
          {
            _id: user._id,
            yeuCauXoaTaiKhoan: true,
            hanXoaTaiKhoan: { $gt: new Date() }
          },
          {
            $set: {
              biKhoa: false,
              lyDoKhoa: '',
              ngayKhoa: null,
              yeuCauXoaTaiKhoan: false,
              ngayYeuCauXoaTaiKhoan: null,
              hanXoaTaiKhoan: null
            }
          },
          { new: true }
        );

        if (!restored) {
          return res.status(410).json({
            success: false,
            message: 'Đã hết hạn khôi phục. Hệ thống sẽ tự xóa tài khoản.'
          });
        }
        user.biKhoa = restored.biKhoa;
        user.lyDoKhoa = restored.lyDoKhoa;
        user.ngayKhoa = restored.ngayKhoa;
        user.yeuCauXoaTaiKhoan = false;
        user.ngayYeuCauXoaTaiKhoan = null;
        user.hanXoaTaiKhoan = null;
      } else {
        user.biKhoa = isLocked;
        user.lyDoKhoa = reason;
        user.ngayKhoa = isLocked ? new Date() : null;
        await user.save();
      }

      // GHI NHẬT KÝ KIỂM VẾT KHÓA / MỞ KHÓA KHÁCH HÀNG
      await ghiNhatKy(
        req,
        isLocked ? 'KHÓA TÀI KHOẢN KHÁCH HÀNG' : 'MỞ KHÓA TÀI KHOẢN KHÁCH HÀNG',
        isLocked
          ? `Khóa tài khoản ${user.tenDangNhap} (${user.maTaiKhoan}). Lý do: ${reason}`
          : `Mở khóa hoạt động lại cho tài khoản ${user.tenDangNhap} (${user.maTaiKhoan})`
      );

      return res.json({
        success: true,
        message: isLocked
          ? 'Đã khóa tài khoản khách hàng'
          : 'Đã mở khóa tài khoản khách hàng',
        data: {
          maTaiKhoanNguoiDung: user.maTaiKhoan,
          trangThaiKhoa: user.biKhoa,
          dangChoXoa: Boolean(user.yeuCauXoaTaiKhoan),
          hanXoaTaiKhoan: formatDateVN(user.hanXoaTaiKhoan),
          lyDoKhoa: user.lyDoKhoa,
          ngayKhoa: formatDateVN(user.ngayKhoa),
          soNgayDaKhoa: tinhSoNgayDaKhoa(user.biKhoa, user.ngayKhoa, user.updatedAt)
        }
      });
    } catch (error) {
      console.error('Lỗi Admin cập nhật trạng thái khóa:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật trạng thái tài khoản'
      });
    }
  }
);

// ========================================
// 5. ADMIN: ẨN / HIỆN ĐÁNH GIÁ CỦA KHÁCH HÀNG
// PATCH /api/store/admin/reviews/:reviewId/visibility
// ========================================

router.patch(
  '/admin/reviews/:reviewId/visibility',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { isHienThi } = req.body;

      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        return res.status(400).json({
          success: false,
          message: 'Mã đánh giá không hợp lệ'
        });
      }

      const review = await Review.findByIdAndUpdate(
        reviewId,
        { an: !Boolean(isHienThi) },
        { new: true }
      );

      if (!review) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy đánh giá'
        });
      }

      return res.json({
        success: true,
        message: review.an
          ? 'Đã ẩn đánh giá'
          : 'Đã hiển thị đánh giá',
        data: {
          _id: review._id,
          an: review.an,
          trangThai: review.an ? 'an' : 'hien_thi'
        }
      });
    } catch (error) {
      console.error('Lỗi Admin ẩn/hiện đánh giá:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật trạng thái đánh giá'
      });
    }
  }
);
// ========================================
// 6. ADMIN: LẤY DANH SÁCH TÀI KHOẢN QUẢN TRỊ VIÊN
// GET /api/store/admin/staff
// ========================================

router.get(
  '/admin/staff',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const admins = await User.find({ vaiTro: 'admin' })
        .select('-matKhau')
        .sort({ maTaiKhoan: 1, createdAt: 1 })
        .lean();

      const data = admins.map((u, idx) => {
        const roleLabel =
          Array.isArray(u.quyen) && u.quyen.length > 0
            ? u.quyen[0]
            : idx === 0
              ? 'Super Admin'
              : 'Staff';

        return {
          _id: u._id,
          stt: idx + 1,
          maTaiKhoan: u.maTaiKhoan,
          username: u.tenDangNhap,
          avatar:
            u.anhDaiDien ||
            'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992540/6622870c-0de9-43b7-bacb-902a48cd55d9.png',
          hoTen: u.hoTen || u.tenDangNhap,
          email: u.email,
          vaiTro: ['Super Admin', 'Editor', 'Staff'].includes(roleLabel)
            ? roleLabel
            : 'Staff',
          trangThai: u.biKhoa ? 'Đã khóa' : 'Hoạt động',
          lanCuoiCapNhat: formatDateVN(u.updatedAt || u.ngayDangKy || u.createdAt)
        };
      });

      return res.json({
        success: true,
        total: data.length,
        data
      });
    } catch (error) {
      console.error('Lỗi lấy danh sách Admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách tài khoản quản trị'
      });
    }
  }
);

// ========================================
// 7. ADMIN: THÊM TÀI KHOẢN QUẢN TRỊ VIÊN MỚI
// POST /api/store/admin/staff
// ========================================

// ========================================
// 7. ADMIN: THÊM TÀI KHOẢN QUẢN TRỊ VIÊN MỚI
// POST /api/store/admin/staff
// ========================================

router.post(
  '/admin/staff',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { username, hoTen, email, matKhau, vaiTro } = req.body;

      if (!username || !hoTen || !email || !matKhau) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ username, họ tên, email và mật khẩu'
        });
      }

      const cleanUsername = String(username).trim();
      const cleanEmail = String(email).trim().toLowerCase();

      const existed = await User.findOne({
        $or: [{ tenDangNhap: cleanUsername }, { email: cleanEmail }]
      });

      if (existed) {
        return res.status(400).json({
          success: false,
          message: 'Tên đăng nhập hoặc email đã tồn tại trong hệ thống'
        });
      }

      const passwordHash = await bcrypt.hash(String(matKhau), 10);
      const maTaiKhoan = 'ADM-' + Date.now().toString().slice(-5);

      const newAdmin = await User.create({
        maTaiKhoan,
        tenDangNhap: cleanUsername,
        email: cleanEmail,
        hoTen: String(hoTen).trim(),
        matKhau: passwordHash,
        anhDaiDien:
          'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992540/6622870c-0de9-43b7-bacb-902a48cd55d9.png',
        vaiTro: 'admin',
        quyen: [vaiTro || 'Staff'],
        biKhoa: false,
        ngayDangKy: new Date()
      });

      // GHI NHẬT KÝ KIỂM VẾT TẠO MỚI ADMIN
      await ghiNhatKy(
        req,
        'THÊM QUẢN TRỊ VIÊN',
        `Tạo mới tài khoản quản trị ${newAdmin.tenDangNhap} (${newAdmin.maTaiKhoan}) với vai trò [${newAdmin.quyen[0]}]`
      );

      return res.status(201).json({
        success: true,
        message: 'Thêm tài khoản quản trị thành công',
        data: {
          _id: newAdmin._id,
          maTaiKhoan: newAdmin.maTaiKhoan,
          username: newAdmin.tenDangNhap,
          hoTen: newAdmin.hoTen,
          email: newAdmin.email,
          vaiTro: vaiTro || 'Staff',
          trangThai: 'Hoạt động',
          lanCuoiCapNhat: formatDateVN(newAdmin.createdAt)
        }
      });
    } catch (error) {
      console.error('Lỗi thêm Admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể thêm tài khoản quản trị'
      });
    }
  }
);

// ========================================
// 8. ADMIN: CẬP NHẬT THÔNG TIN / KHÓA / MỞ KHÓA QUẢN TRỊ VIÊN
// PUT /api/store/admin/staff/:id
// ========================================

router.put(
  '/admin/staff/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { hoTen, email, matKhauMoi, vaiTro, trangThai } = req.body;

      const query = mongoose.Types.ObjectId.isValid(id)
        ? { vaiTro: 'admin', $or: [{ _id: id }, { maTaiKhoan: id }, { tenDangNhap: id }] }
        : { vaiTro: 'admin', $or: [{ maTaiKhoan: id }, { tenDangNhap: id }] };

      const adminUser = await User.findOne(query);

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản quản trị'
        });
      }

      // 1. Cập nhật Họ tên
      if (hoTen !== undefined && String(hoTen).trim()) {
        adminUser.hoTen = String(hoTen).trim();
      }

      // 2. Cập nhật Email
      if (email !== undefined && String(email).trim()) {
        const cleanEmail = String(email).trim().toLowerCase();
        const duplicateEmail = await User.findOne({
          _id: { $ne: adminUser._id },
          email: cleanEmail
        });
        if (duplicateEmail) {
          return res.status(400).json({
            success: false,
            message: 'Email này đã được sử dụng bởi tài khoản khác'
          });
        }
        adminUser.email = cleanEmail;
      }

      // 3. Cập nhật Vai trò & Ghi vết thay đổi vai trò
      if (vaiTro !== undefined) {
        const vaiTroCu = adminUser.quyen[0] || 'Staff';
        if (vaiTroCu !== String(vaiTro)) {
          adminUser.quyen = [String(vaiTro)];
          await ghiNhatKy(
            req,
            'ĐỔI VAI TRÒ ADMIN',
            `Đổi vai trò của ${adminUser.tenDangNhap} từ [${vaiTroCu}] sang [${vaiTro}]`
          );
        }
      }

      // 4. KHÓA / MỞ KHÓA ADMIN VÀ GHI NHẬT KÝ KIỂM VẾT
      if (trangThai !== undefined) {
        const muonKhoa = (trangThai === 'Đã khóa' || trangThai === true);

        // Chặn Super Admin không được tự khóa chính mình
        if (muonKhoa && String(adminUser._id) === String(req.user._id)) {
          return res.status(400).json({
            success: false,
            message: 'Bạn không thể tự khóa tài khoản quản trị của chính mình'
          });
        }

        const trangThaiCu = adminUser.biKhoa;
        adminUser.biKhoa = muonKhoa;

        // Chỉ ghi vết khi có sự thay đổi trạng thái thực tế
        if (trangThaiCu !== muonKhoa) {
          await ghiNhatKy(
            req,
            muonKhoa ? 'KHÓA TÀI KHOẢN ADMIN' : 'MỞ KHÓA TÀI KHOẢN ADMIN',
            muonKhoa
              ? `Super Admin ${req.user.tenDangNhap} đã khóa tài khoản quản trị viên ${adminUser.tenDangNhap} (${adminUser.maTaiKhoan})`
              : `Super Admin ${req.user.tenDangNhap} đã mở khóa hoạt động lại cho quản trị viên ${adminUser.tenDangNhap} (${adminUser.maTaiKhoan})`
          );
        }
      }

      // 5. Cập nhật Mật khẩu
      if (matKhauMoi && String(matKhauMoi).trim()) {
        adminUser.matKhau = await bcrypt.hash(String(matKhauMoi).trim(), 10);
        await ghiNhatKy(
          req,
          'ĐẶT LẠI MẬT KHẨU ADMIN',
          `Đặt lại mật khẩu mới cho quản trị viên ${adminUser.tenDangNhap}`
        );
      }

      await adminUser.save();

      return res.json({
        success: true,
        message: 'Cập nhật tài khoản quản trị thành công'
      });
    } catch (error) {
      console.error('Lỗi cập nhật Admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật tài khoản quản trị'
      });
    }
  }
);

// ========================================
// 9. ADMIN: XÓA TÀI KHOẢN QUẢN TRỊ VIÊN
// DELETE /api/store/admin/staff/:id
// ========================================

router.delete(
  '/admin/staff/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      const query = mongoose.Types.ObjectId.isValid(id)
        ? { vaiTro: 'admin', $or: [{ _id: id }, { maTaiKhoan: id }, { tenDangNhap: id }] }
        : { vaiTro: 'admin', $or: [{ maTaiKhoan: id }, { tenDangNhap: id }] };

      const adminUser = await User.findOne(query);

      if (!adminUser) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản quản trị'
        });
      }

      if (String(adminUser._id) === String(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: 'Bạn không thể tự xóa tài khoản đang đăng nhập của chính mình'
        });
      }

      const tenXoa = adminUser.tenDangNhap;
      const maXoa = adminUser.maTaiKhoan;

      await User.deleteOne({ _id: adminUser._id });

      // GHI NHẬT KÝ KIỂM VẾT XÓA ADMIN
      await ghiNhatKy(
        req,
        'XÓA QUẢN TRỊ VIÊN',
        `Xóa vĩnh viễn tài khoản quản trị viên ${tenXoa} (${maXoa}) khỏi hệ thống`
      );

      return res.json({
        success: true,
        message: 'Đã xóa tài khoản quản trị thành công'
      });
    } catch (error) {
      console.error('Lỗi xóa Admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể xóa tài khoản quản trị'
      });
    }
  }
);



module.exports = router;