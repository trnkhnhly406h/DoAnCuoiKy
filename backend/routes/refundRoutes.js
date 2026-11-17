
const express = require('express');
const mongoose = require('mongoose');

const RefundRequest = require('../models/RefundRequest');
const Order = require('../models/Order');
const User = require('../models/User');
const Game = require('../models/Game');
const Notification = require('../models/Notification');
const { tienHoanTheoGame } = require('../utils/refundPricing');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const orderRoleMiddleware = require('../middleware/orderRoleMiddleware');
const router = express.Router();


// ========================================
// 1. KHÁCH HÀNG GỬI YÊU CẦU HOÀN TIỀN
// POST /refunds/request
// ========================================

router.post('/refunds/request', authMiddleware, async (req, res) => {
  try {
    const { maGame, lyDoKhachHang, soGioDaChoi } = req.body;

    if (!maGame) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã game cần hoàn tiền'
      });
    }

    const playHours = Number(soGioDaChoi);

    if (!Number.isFinite(playHours) || playHours < 0) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian chơi không hợp lệ'
      });
    }

    if (playHours > 2) {
      return res.status(400).json({
        success: false,
        message: 'Game đã chơi quá 2 giờ nên không đủ điều kiện hoàn tiền'
      });
    }

    const order = await Order.findOne({
      maTaiKhoan: req.user.maTaiKhoan,
      'sanPham.maGame': maGame,
      trangThai: 'completed',
      maDonHang: { $regex: /^ORD-/ }
    }).sort({ createdAt: -1 });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn mua game hợp lệ để hoàn tiền'
      });
    }

    const now = new Date();
    const purchaseDate = new Date(order.createdAt);

    const daysSincePurchase =
      (now.getTime() - purchaseDate.getTime()) /
      (1000 * 60 * 60 * 24);

    if (daysSincePurchase > 14) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng đã quá thời hạn hoàn tiền 14 ngày'
      });
    }

    const existingRequest = await RefundRequest.findOne({
      maDonHang: order._id,
      maGame,
      trangThaiHoanTien: { $in: ['pending', 'approved'] }
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: existingRequest.trangThaiHoanTien === 'pending'
          ? 'Game này đang có yêu cầu hoàn tiền chờ xử lý'
          : 'Game này đã được hoàn tiền trước đó'
      });
    }

    const refundRequest = new RefundRequest({
      maYeuCau: `REF-${Date.now()}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`,
      maDonHang: order._id,
      maTaiKhoan: req.user.maTaiKhoan,
      maGame,
      lyDoKhachHang: lyDoKhachHang || '',
      trangThaiHoanTien: 'pending'
    });

    await refundRequest.save();

    return res.status(201).json({
      success: true,
      message: 'Gửi yêu cầu hoàn tiền thành công. Vui lòng chờ Admin xử lý.',
      data: refundRequest
    });

  } catch (error) {
    console.error('Lỗi gửi yêu cầu hoàn tiền:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể gửi yêu cầu hoàn tiền'
    });
  }
});


// ========================================
// 2. KHÁCH HÀNG XEM LỊCH SỬ YÊU CẦU
// GET /refunds/me
// ========================================

router.get('/refunds/me', authMiddleware, async (req, res) => {
  try {
    const requests = await RefundRequest.find({
      maTaiKhoan: req.user.maTaiKhoan
    })
      .populate(
        'maDonHang',
        'maDonHang sanPham tongTien tongTienGoc soTienGiam phuongThucThanhToan createdAt'
      )
      .sort({ ngayYeuCau: -1 });

    return res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Lỗi lấy lịch sử hoàn tiền:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy lịch sử yêu cầu hoàn tiền'
    });
  }
});


// ========================================
// 3. ADMIN XEM TOÀN BỘ YÊU CẦU HOÀN TIỀN
// GET /refunds/admin/all
// ========================================

router.get(
  '/refunds/admin/all',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {
    try {

      // 1. Lấy toàn bộ yêu cầu hoàn tiền
      const requests = await RefundRequest.find()
        .populate(
          'maDonHang',
          'maDonHang maTaiKhoan sanPham tongTien phuongThucThanhToan trangThai createdAt'
        )
        .sort({ ngayYeuCau: -1 });

      // 2. Chuẩn hóa mã tài khoản và mã game
      const accountIds = [
        ...new Set(
          requests
            .map(item => String(item.maTaiKhoan || ''))
            .filter(Boolean)
        )
      ];

      const gameIds = [
        ...new Set(
          requests
            .map(item => String(item.maGame || ''))
            .filter(Boolean)
        )
      ];

      // 3. Tìm khách hàng theo cả maTaiKhoan và MongoDB _id
      const objectIdAccounts = accountIds
        .filter(id => /^[a-fA-F0-9]{24}$/.test(id))
        .map(id => new mongoose.Types.ObjectId(id));

      const users = await User.find({
        $or: [
          { maTaiKhoan: { $in: accountIds } },
          { _id: { $in: objectIdAccounts } }
        ]
      }).select(
        'maTaiKhoan tenDangNhap hoTen email soDienThoai'
      );

      // 4. Tìm thông tin game
      const games = await Game.find({
        maGame: { $in: gameIds }
      }).select(
        'maGame tenTroChoi giaHienTai phanTramGiamGia'
      );

      // 5. Tạo Map tra cứu khách hàng
      // Mỗi khách hàng được lưu theo cả _id và maTaiKhoan
      const userMap = new Map();

      users.forEach(user => {
        userMap.set(String(user._id), user);
        userMap.set(String(user.maTaiKhoan), user);
      });

      // 6. Tạo Map tra cứu game
      const gameMap = new Map();

      games.forEach(game => {
        gameMap.set(String(game.maGame), game);
      });

      // 7. Kết hợp dữ liệu
      const data = requests.map(request => {

        const refund = request.toObject();

        const order = refund.maDonHang;

        // Tìm sản phẩm trong đơn hàng
        const product = order?.sanPham?.find(
          item =>
            String(item.maGame) === String(refund.maGame)
        );

        // Tìm khách hàng bằng mã tài khoản hoặc MongoDB _id
        const user = userMap.get(
          String(refund.maTaiKhoan)
        );

        // Tìm game trong collection Game
        const game = gameMap.get(
          String(refund.maGame)
        );

        // Chuẩn hóa trạng thái dữ liệu cũ
        let trangThai = refund.trangThaiHoanTien;

        if (trangThai === 'hoan_tien' || trangThai === 'da_hoan_tien') {
          trangThai = 'approved';
        } else if (trangThai === 'cho_xu_ly') {
          trangThai = 'pending';
        } else if (trangThai === 'tu_choi') {
          trangThai = 'rejected';
        }

        // Ưu tiên số tiền đã lưu trong yêu cầu.
        // Nếu yêu cầu cũ chưa có số tiền, lấy giá từ đơn hàng.
        let soTienHoan = Number(refund.soTienHoan) || 0;

        if (
          soTienHoan <= 0 &&
          trangThai === 'approved' &&
          product
        ) {
          soTienHoan = tienHoanTheoGame(order, refund.maGame);
        }

        return {
          ...refund,

          // Trạng thái đã chuẩn hóa để giao diện sử dụng
          trangThaiHoanTien: trangThai,

          // Số tiền ghi nhận đã hoàn; dự kiến được tính theo giá THỰC TRẢ.
          soTienHoan,
          soTienHoanDuKien: product && order
            ? tienHoanTheoGame(order, refund.maGame)
            : 0,

          // Thông tin khách hàng
          khachHang: user
            ? {
                maTaiKhoan: user.maTaiKhoan,
                tenDangNhap: user.tenDangNhap,
                hoTen: user.hoTen,
                email: user.email,
                soDienThoai: user.soDienThoai
              }
            : null,

          // Thông tin game
          game: game
            ? {
                maGame: game.maGame,
                tenTroChoi: game.tenTroChoi,
                giaHienTai: game.giaHienTai,
                phanTramGiamGia: game.phanTramGiamGia
              }
            : product
              ? {
                  maGame: product.maGame,
                  tenTroChoi: product.tenGame,
                  giaHienTai: product.donGia,
                  phanTramGiamGia: 0
                }
              : null,

          // Thông tin sản phẩm trong đơn hàng
          sanPham: product
            ? {
                maGame: product.maGame,
                tenGame: product.tenGame,
                donGia: product.donGia
              }
            : null
        };
      });

      return res.json({
        success: true,
        total: data.length,
        data
      });

    } catch (error) {
      console.error('Lỗi Admin lấy danh sách hoàn tiền:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách yêu cầu hoàn tiền'
      });
    }
  }
);


// ========================================
// 4. ADMIN PHÊ DUYỆT YÊU CẦU HOÀN TIỀN
// PATCH /refunds/admin/:id/approve
// ========================================

router.patch(
  '/refunds/admin/:id/approve',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {

    let session;

    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Mã yêu cầu hoàn tiền không hợp lệ'
        });
      }

      session = await mongoose.startSession();
      session.startTransaction();

      const refundRequest = await RefundRequest.findById(id)
        .session(session);

      if (!refundRequest) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy yêu cầu hoàn tiền'
        });
      }

      if (refundRequest.trangThaiHoanTien !== 'pending') {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: 'Yêu cầu này đã được xử lý trước đó'
        });
      }

      const order = await Order.findById(
        refundRequest.maDonHang
      ).session(session);

      if (
        !order ||
        order.trangThai !== 'completed' ||
        order.maTaiKhoan !== refundRequest.maTaiKhoan ||
        !order.maDonHang.startsWith('ORD-')
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: 'Đơn hàng không hợp lệ để hoàn tiền'
        });
      }

      const item = order.sanPham.find(
        sp => sp.maGame === refundRequest.maGame
      );

      if (!item || !Number.isFinite(item.donGia) || item.donGia <= 0) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: 'Không tìm thấy giá game hợp lệ trong đơn hàng'
        });
      }

      const game = await Game.findOne({
        maGame: refundRequest.maGame
      }).session(session);

      if (!game) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy game trong hệ thống'
        });
      }
      const auditLogRoutes = require('./auditLogRoutes');
// Khi duyệt:
auditLogRoutes.recordLog({
  tenTaiKhoan: req.user?.tenDangNhap || req.user?.maTaiKhoan || 'admin',
  hanhDong: 'DUYỆT HOÀN TIỀN',
  chiTiet: `Chấp thuận hoàn tiền cho yêu cầu ${req.params.id}`,
  req
});
      // Thu hồi game: Nếu là quà tặng thì thu hồi ở người nhận, ngược lại thu hồi ở người mua
      let targetUserQuery = { maTaiKhoan: refundRequest.maTaiKhoan };
      if (item.laQua && item.nguoiNhan) {
        targetUserQuery = {
          $or: [
            { tenDangNhap: item.nguoiNhan },
            { email: item.nguoiNhan.toLowerCase() }
          ]
        };
      }

      await User.findOneAndUpdate(
        targetUserQuery,
        {
          $pull: {
            danhSachGameDaMua: game._id
          }
        },
        { session }
      );

      const today = new Date();

      refundRequest.trangThaiHoanTien = 'approved';
      refundRequest.soTienHoan = tienHoanTheoGame(order, refundRequest.maGame);
      refundRequest.lyDoTuChoi = '';
      refundRequest.adminXuLy = req.user._id;
      refundRequest.ngayXuLy = today;
      refundRequest.ngayHoanTien = today;

      await refundRequest.save({ session });

      // Chỉ đánh dấu đơn đã hoàn toàn bộ khi TẤT CẢ game trong đơn
      // có ít nhất một yêu cầu hoàn tiền đã được DUYỆT.
      // Yêu cầu pending/rejected của game khác không bị ảnh hưởng.
      const approvedRequests = await RefundRequest.find({
        maDonHang: order._id,
        trangThaiHoanTien: 'approved'
      }).select('maGame').session(session);

      const approvedCodes = new Set(
        approvedRequests.map(request => String(request.maGame))
      );

      if (
        order.sanPham.length > 0 &&
        order.sanPham.every(item => approvedCodes.has(String(item.maGame)))
      ) {
        order.trangThai = 'cancelled';
        await order.save({ session });
      }


      // Tạo thông báo cho đúng tài khoản Customer ngay trong transaction.
      await Notification.create([{
        maTaiKhoan: refundRequest.maTaiKhoan,
        title: 'KẾT QUẢ YÊU CẦU HOÀN TIỀN',
        desc: 'Kết quả xử lý yêu cầu hoàn tiền của bạn đã được cập nhật. Vui lòng kiểm tra chi tiết tại mục Lịch sử hoàn tiền.',
        icon: '↩️',
        category: 'system',
        isRead: false
      }], { session });

      await session.commitTransaction();

      return res.json({
        success: true,
        message: 'Phê duyệt yêu cầu hoàn tiền thành công',
        data: {
          maYeuCau: refundRequest.maYeuCau,
          maGame: refundRequest.maGame,
          soTienHoan: refundRequest.soTienHoan,
          trangThaiHoanTien: refundRequest.trangThaiHoanTien,
          ngayXuLy: refundRequest.ngayXuLy,
          ngayHoanTien: refundRequest.ngayHoanTien
        }
      });

    } catch (error) {

      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error('Lỗi Admin phê duyệt hoàn tiền:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể phê duyệt yêu cầu hoàn tiền'
      });

    } finally {

      if (session) {
        await session.endSession();
      }
    }
  }
);


// ========================================
// 5. ADMIN TỪ CHỐI YÊU CẦU HOÀN TIỀN
// PATCH /refunds/admin/:id/reject
// ========================================

router.patch(
  '/refunds/admin/:id/reject',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const lyDoTuChoi = String(req.body.lyDoTuChoi || '').trim();

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Mã yêu cầu hoàn tiền không hợp lệ'
        });
      }

      if (!lyDoTuChoi) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập lý do từ chối hoàn tiền'
        });
      }

      const refundRequest = await RefundRequest.findOneAndUpdate(
        {
          _id: id,
          trangThaiHoanTien: 'pending'
        },
        {
          $set: {
            trangThaiHoanTien: 'rejected',
            lyDoTuChoi,
            soTienHoan: 0,
            adminXuLy: req.user._id,
            ngayXuLy: new Date(),
            ngayHoanTien: null
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!refundRequest) {
        const existingRequest = await RefundRequest.findById(id);

        return res.status(existingRequest ? 400 : 404).json({
          success: false,
          message: existingRequest
            ? 'Yêu cầu này đã được xử lý trước đó'
            : 'Không tìm thấy yêu cầu hoàn tiền'
        });
      }

      // Tạo thông báo kết quả cho đúng Customer sau khi từ chối thành công.
      // Tạo thông báo kết quả cho đúng Customer sau khi từ chối thành công.
    await Notification.create({
      maTaiKhoan: refundRequest.maTaiKhoan,
      title: 'KẾT QUẢ YÊU CẦU HOÀN TIỀN',
      desc: `Yêu cầu hoàn tiền game ${refundRequest.maGame} đã bị từ chối. Lý do: ${lyDoTuChoi}`,
      icon: '↩️',
      category: 'system',
      isRead: false
    });

    // Bổ sung: Ghi Audit Log khi từ chối hoàn tiền
    try {
      const auditLogRoutes = require('./auditLogRoutes');
      if (auditLogRoutes && typeof auditLogRoutes.recordLog === 'function') {
        await auditLogRoutes.recordLog({
          tenTaiKhoan: req.user?.tenDangNhap || req.user?.maTaiKhoan || 'admin',
          vaiTro: 'admin',
          hanhDong: 'TỪ CHỐI HOÀN TIỀN',
          chiTiet: `Từ chối hoàn tiền yêu cầu ${refundRequest.maYeuCau || id}. Lý do: ${lyDoTuChoi}`,
          req
        });
      }
    } catch (logErr) {
      console.warn('Lỗi ghi audit log từ chối hoàn tiền:', logErr.message);
    }

    return res.json({
      success: true,
      message: 'Đã từ chối yêu cầu hoàn tiền',
      data: refundRequest
    });


    } catch (error) {
      console.error('Lỗi Admin từ chối hoàn tiền:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể từ chối yêu cầu hoàn tiền'
      });
    }
  }
);


module.exports = router;
