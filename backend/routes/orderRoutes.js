const express = require('express');
const mongoose = require('mongoose');
const Promotion = require('../models/Promotion');
const Order = require('../models/Order');
const User = require('../models/User');
const Game = require('../models/Game');
const RefundRequest = require('../models/RefundRequest');
const { phanBoTienThucTra, tienHoanTheoGame } = require('../utils/refundPricing');
const authMiddleware = require('../middleware/authMiddleware');
const orderRoleMiddleware = require('../middleware/orderRoleMiddleware');
const Notification = require('../models/Notification');

const router = express.Router();

console.log('===== ORDER ROUTES ĐÃ ĐƯỢC LOAD =====');

async function ghiThongBaoDonHang(orderInfo) {
  try {
    if (
      !orderInfo?.maDonHang ||
      !orderInfo?.maTaiKhoan
    ) {
      return;
    }

    await Notification.create({
      maTaiKhoan: orderInfo.maTaiKhoan,

      title:
        `ĐƠN HÀNG ${orderInfo.maDonHang} ĐÃ THANH TOÁN`,

      desc:
        `Đơn hàng ${orderInfo.maDonHang} trị giá ` +
        `${Number(orderInfo.tongTien || 0).toLocaleString('vi-VN')} VNĐ ` +
        `đã thanh toán thành công.`,

      icon: '📦',
      category: 'system',
      loaiThongBao: 'system',

      isRead: false,
      daDoc: false
    });

  } catch (error) {
    console.error(
      'Không tạo được thông báo đơn hàng:',
      error.message
    );
  }
}


// ========================================
// TEST
// GET /api/store/orders/test
// ========================================

router.get('/orders/test', (req, res) => {
  res.json({
    success: true,
    message: 'ORDER ROUTES ĐANG HOẠT ĐỘNG'
  });
});


// ========================================
// MUA GAME
// POST /api/store/orders/purchase
// ========================================

router.post(
  '/orders/purchase',
  authMiddleware,
  async (req, res) => {

    console.log('===== PURCHASE API ĐƯỢC GỌI =====');
    console.log('BODY:', req.body);
    console.log('USER:', req.user);

    try {

      const {
        maGame,
        phuongThucThanhToan
      } = req.body;


      // ========================================
      // 1. KIỂM TRA DỮ LIỆU
      // ========================================

      if (!maGame) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp maGame'
        });
      }

      if (!phuongThucThanhToan) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn phương thức thanh toán'
        });
      }


      // ========================================
      // 2. TÌM GAME
      // ========================================

      const game = await Game.findOne({
        maGame
      });

      console.log(
        'maGame frontend gửi:',
        maGame
      );

      console.log(
        'GAME TÌM ĐƯỢC:',
        game
      );

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy game'
        });
      }


      // ========================================
      // 3. LẤY USER HIỆN TẠI
      // ========================================

      const user = await User.findById(
        req.user._id
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }


      // ========================================
      // 4. KIỂM TRA ĐÃ SỞ HỮU GAME
      // ========================================

      const daSoHuu =
        user.danhSachGameDaMua.some(
          (gameId) =>
            gameId.toString() ===
            game._id.toString()
        );


      if (daSoHuu) {
        return res.status(400).json({
          success: false,
          message: 'Bạn đã sở hữu game này'
        });
      }


      // ========================================
      // 5. LẤY GIÁ GAME
      // ========================================

      const giaGame =
        Number(game.giaHienTai || 0);


      // ========================================
      // 6. TẠO MÃ ĐƠN HÀNG
      // ========================================

      const maDonHang =
        'ORD-' +
        new Date().getFullYear() +
        '-' +
        Date.now();


      // ========================================
      // 7. TẠO ORDER
      // ========================================

      const order = new Order({

        maDonHang,

        maTaiKhoan:
          user.maTaiKhoan,

        sanPham: [
          {
            maGame:
              game.maGame,

            tenGame:
              game.tenTroChoi,

            donGia:
              giaGame
          }
        ],

        tongTien:
          giaGame,

        phuongThucThanhToan,

        trangThai:
          'completed'
      });


      // ========================================
      // 8. THÊM GAME VÀO LIBRARY
      // ========================================

      user.danhSachGameDaMua.push(
        game._id
      );


      // ========================================
      // 9. LƯU ORDER + USER
      // ========================================

      await order.save();

      await user.save();

await ghiThongBaoDonHang(order);

await ghiThongBaoDonHang(ketQuaThanhToan);


      // ========================================
      // 10. TRẢ KẾT QUẢ
      // ========================================

      return res.status(201).json({

        success: true,

        message:
          'Thanh toán thành công và mua game thành công',

        data: {

          maDonHang:
            order.maDonHang,

          maGame:
            game.maGame,

          tenGame:
            game.tenTroChoi,

          tongTien:
            order.tongTien,

          phuongThucThanhToan:
            order.phuongThucThanhToan,

          trangThai:
            order.trangThai
        }
      });

    } catch (error) {

      console.error(
        'Lỗi mua game:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Không thể mua game',

        error:
          error.message
      });
    }
  }
);



// ========================================
// TẶNG GAME
// POST /api/store/orders/gift
// ========================================

router.post(
  '/orders/gift',
  authMiddleware,
  async (req, res) => {

    console.log('===== GIFT API ĐƯỢC GỌI =====');
    console.log('BODY:', req.body);
    console.log('USER:', req.user);


    try {

      const {
        maGame,
        phuongThucThanhToan,
        nguoiNhan,
        loiNhan
      } = req.body;


      // ========================================
      // 1. KIỂM TRA DỮ LIỆU
      // ========================================

      if (!maGame) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp maGame'
        });
      }

      if (!phuongThucThanhToan) {
        return res.status(400).json({
          success: false,
          message:
            'Vui lòng chọn phương thức thanh toán'
        });
      }

      if (!nguoiNhan) {
        return res.status(400).json({
          success: false,
          message:
            'Vui lòng cung cấp tài khoản người nhận'
        });
      }


      // ========================================
      // 2. TÌM GAME
      // ========================================

      const game =
        await Game.findOne({
          maGame
        });

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy game'
        });
      }


      // ========================================
      // 3. LẤY NGƯỜI TẶNG
      // ========================================

      const sender =
        await User.findById(
          req.user._id
        );

      if (!sender) {
        return res.status(404).json({
          success: false,
          message:
            'Không tìm thấy tài khoản người tặng'
        });
      }


      // ========================================
      // 4. TÌM NGƯỜI NHẬN
      // username hoặc email
      // ========================================

      const receiver =
        await User.findOne({
          $or: [
            {
              tenDangNhap:
                nguoiNhan.trim()
            },
            {
              email:
                nguoiNhan.trim().toLowerCase()
            }
          ]
        });


      if (!receiver) {
        return res.status(404).json({
          success: false,
          message:
            'Không tìm thấy tài khoản người nhận'
        });
      }


      // ========================================
      // 5. KHÔNG CHO TỰ TẶNG
      // ========================================

      if (
        receiver._id.toString() ===
        sender._id.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Bạn không thể tự tặng game cho chính mình'
        });
      }


      // ========================================
      // 6. KIỂM TRA NGƯỜI NHẬN ĐÃ CÓ GAME
      // ========================================

      const receiverAlreadyOwns =
        receiver.danhSachGameDaMua.some(
          (gameId) =>
            gameId.toString() ===
            game._id.toString()
        );


      if (receiverAlreadyOwns) {
        return res.status(400).json({
          success: false,
          message:
            'Người nhận đã sở hữu game này'
        });
      }


      // ========================================
      // 7. LẤY GIÁ GAME
      // ========================================

      const giaGame =
        Number(game.giaHienTai || 0);


      // ========================================
      // 8. TẠO MÃ ĐƠN HÀNG
      // ========================================

      const maDonHang =
        'GFT-' +
        new Date().getFullYear() +
        '-' +
        Date.now();


      // ========================================
      // 9. TẠO ORDER
      // ========================================

      const order =
        new Order({

          maDonHang,

          // Người thanh toán
          maTaiKhoan:
            sender.maTaiKhoan,

          sanPham: [
            {

              maGame:
                game.maGame,

              tenGame:
                game.tenTroChoi,

              donGia:
                giaGame
            }
          ],

          tongTien:
            giaGame,

          phuongThucThanhToan,

          trangThai:
            'completed'
        });


      // ========================================
      // 10. THÊM GAME VÀO LIBRARY
      // CỦA NGƯỜI NHẬN
      // ========================================

      receiver.danhSachGameDaMua.push(
        game._id
      );


      // ========================================
      // 11. LƯU ORDER + RECEIVER
      // ========================================

      await order.save();

      await receiver.save();

await ghiThongBaoDonHang(order);


      // ========================================
      // 12. TRẢ KẾT QUẢ
      // ========================================

      return res.status(201).json({

        success: true,

        message:
          'Tặng game thành công',

        data: {

          maDonHang:
            order.maDonHang,

          maGame:
            game.maGame,

          tenGame:
            game.tenTroChoi,

          nguoiTang:
            sender.tenDangNhap,

          nguoiNhan:
            receiver.tenDangNhap,

          emailNguoiNhan:
            receiver.email,

          loiNhan:
            loiNhan?.trim() || '',

          tongTien:
            order.tongTien,

          phuongThucThanhToan:
            order.phuongThucThanhToan,

          trangThai:
            order.trangThai
        }
      });

    } catch (error) {

      console.error(
        'Lỗi tặng game:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          'Không thể tặng game',

        error:
          error.message
      });
    }
  }
);

// ========================================
// KIỂM TRA MÃ KHUYẾN MÃI
// POST /api/store/orders/check-coupon
// ========================================

router.post(
  '/orders/check-coupon',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        maKhuyenMai,
        items
      } = req.body;

      const code = String(maKhuyenMai || '')
        .trim()
        .toUpperCase();

      // 1. Kiểm tra dữ liệu
      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mã khuyến mãi'
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng chưa có sản phẩm'
        });
      }

      const maGameList = items.map(item =>
        String(item.maGame || '').trim()
      );

      if (
        maGameList.some(ma => !ma) ||
        new Set(maGameList).size !== maGameList.length
      ) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách game không hợp lệ hoặc có game bị trùng'
        });
      }

      // 2. Tìm mã khuyến mãi trong MongoDB
      const promotion = await Promotion.findOne({
        maKhuyenMai: code
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Mã khuyến mãi không hợp lệ'
        });
      }

      if (!promotion.trangThai) {
        return res.status(400).json({
          success: false,
          message: 'Mã khuyến mãi hiện không được kích hoạt'
        });
      }
      
      // 3. Kiểm tra thời hạn
      const now = new Date();

      if (
        !promotion.ngayBatDau ||
        Number.isNaN(new Date(promotion.ngayBatDau).getTime())
      ) {
        return res.status(400).json({
          success: false,
          message: 'Thời gian bắt đầu của mã khuyến mãi không hợp lệ'
        });
      }

      if (now < new Date(promotion.ngayBatDau)) {
        return res.status(400).json({
          success: false,
          message: 'Mã khuyến mãi chưa đến thời gian áp dụng'
        });
      }

      // Ngày kết thúc có thể để trống
      if (
        promotion.ngayKetThuc &&
        now > new Date(promotion.ngayKetThuc)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Mã khuyến mãi đã hết hạn'
        });
      }

      // 4. Kiểm tra phần trăm giảm giá
const phanTram = Number(promotion.phanTramGiamGia);

if (
  !Number.isFinite(phanTram) ||
  phanTram < 1 ||
  phanTram > 100
) {
  return res.status(400).json({
    success: false,
    message: 'Phần trăm giảm giá của mã không hợp lệ'
  });
}
      // 5. Lấy tài khoản hiện tại
      const buyer = await User.findById(req.user._id);

      if (!buyer) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy tài khoản'
        });
      }

      // 6. Kiểm tra điều kiện mua lần đầu
      if (promotion.chiApDungLanDau) {
        const daTungMua = await Order.findOne({
          maTaiKhoan: buyer.maTaiKhoan,
          trangThai: 'completed'
        });

        if (daTungMua) {
          return res.status(400).json({
            success: false,
            message: 'Mã này chỉ áp dụng cho đơn hàng đầu tiên của tài khoản'
          });
        }
      }

      // 7. Lấy giá game trực tiếp từ MongoDB
      const games = await Game.find({
        maGame: { $in: maGameList },
        trangThaiBan: true
      });

      if (games.length !== items.length) {
        return res.status(400).json({
          success: false,
          message: 'Có game không tồn tại hoặc hiện không được bán'
        });
      }

      const gameMap = new Map(
        games.map(game => [game.maGame, game])
      );

      let tongTienGoc = 0;

      for (const item of items) {
        const game = gameMap.get(
          String(item.maGame).trim()
        );

        if (!game) {
          return res.status(400).json({
            success: false,
            message: `Không tìm thấy game ${item.maGame}`
          });
        }

        const giaGame = Number(game.giaHienTai);

        if (
          !Number.isFinite(giaGame) ||
          giaGame < 0
        ) {
          return res.status(400).json({
            success: false,
            message: `Giá game ${game.tenTroChoi} không hợp lệ`
          });
        }

        tongTienGoc += giaGame;
      }

      if (tongTienGoc <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng không có game trả phí để áp dụng mã'
        });
      }

      // 8. Tính tiền giảm trên toàn bộ giỏ hàng,
      // bao gồm cả game mua và game tặng.
      const soTienGiam = Math.min(
        Math.round(tongTienGoc * phanTram / 100),
        tongTienGoc
      );

      const tongTien = tongTienGoc - soTienGiam;

      // 9. Trả kết quả cho Angular
      return res.json({
        success: true,
        message: 'Áp dụng mã khuyến mãi thành công',
        data: {
          maKhuyenMai: promotion.maKhuyenMai,
          moTa: promotion.moTa,
          phanTramGiamGia: phanTram,
          ngayBatDau: promotion.ngayBatDau,
          ngayKetThuc: promotion.ngayKetThuc,
          chiApDungLanDau: promotion.chiApDungLanDau,
          tongTienGoc,
          soTienGiam,
          tongTien
        }
      });

    } catch (error) {
      console.error(
        'Lỗi kiểm tra mã khuyến mãi:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Không thể kiểm tra mã khuyến mãi',
        error: error.message
      });
    }
  }
);

// ========================================
// THANH TOÁN TOÀN BỘ GIỎ HÀNG
// POST /api/store/orders/checkout
// ========================================

router.post(
  '/orders/checkout',
  authMiddleware,
  async (req, res) => {
    let session;

    try {
      const {
        items,
        phuongThucThanhToan,
        maKhuyenMai
      } = req.body;

      // 1. Kiểm tra dữ liệu đầu vào
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Giỏ hàng chưa có sản phẩm'
        });
      }

      if (!phuongThucThanhToan) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng chọn phương thức thanh toán'
        });
      }

      // Không cho gửi trùng game trong cùng một đơn
      const maGameList = items.map(item =>
        String(item.maGame || '').trim()
      );

      if (
        maGameList.some(ma => !ma) ||
        new Set(maGameList).size !== maGameList.length
      ) {
        return res.status(400).json({
          success: false,
          message: 'Danh sách game không hợp lệ hoặc có game bị trùng'
        });
      }

      // 2. Bắt đầu giao dịch MongoDB
      session = await mongoose.startSession();

      let ketQuaThanhToan = null;

      await session.withTransaction(async () => {
        // 3. Lấy tài khoản người mua
        const buyer = await User.findById(req.user._id).session(session);

        if (!buyer) {
          throw new Error('Không tìm thấy tài khoản người mua');
        }

        // 4. Lấy toàn bộ game từ database
        const games = await Game.find({
          maGame: { $in: maGameList },
          trangThaiBan: true
        }).session(session);

        if (games.length !== items.length) {
          throw new Error('Có game không tồn tại hoặc hiện không được bán');
        }

        const gameMap = new Map(
          games.map(game => [game.maGame, game])
        );

        const danhSachSanPham = [];
        const capNhatThuVien = new Map();

        let tongTienGoc = 0;

        // 5. Kiểm tra từng game và người nhận
        for (const item of items) {
          const maGame = String(item.maGame).trim();
          const game = gameMap.get(maGame);

          if (!game) {
            throw new Error(`Không tìm thấy game ${maGame}`);
          }

          const giaGame = Number(game.giaHienTai);

          if (!Number.isFinite(giaGame) || giaGame < 0) {
            throw new Error(`Giá game ${game.tenTroChoi} không hợp lệ`);
          }

          const laQua = item.laQua === true;


let nguoiNhan = '';
let receiver = buyer;

// Khai báo receiverId bên ngoài if để có thể sử dụng ở phía dưới.
let receiverId = buyer._id.toString();

if (laQua) {
          // 6. Kiểm tra thông tin người nhận quà
          const recipientInput = String(item.nguoiNhan || '').trim();

          if (!recipientInput) {
            throw new Error(
              `Vui lòng cung cấp người nhận game ${game.tenTroChoi}`
            );
          }

          receiver = await User.findOne({
            $or: [
              { tenDangNhap: recipientInput },
              { email: recipientInput.toLowerCase() }
            ]
          }).session(session);

          // NẾU NGƯỜI NHẬN LÀ BẠN BÈ MẠNG XÃ HỘI CHƯA CÓ TRONG MONGODB:
          // Tự động khởi tạo tài khoản người nhận để đơn hàng quà tặng luôn hoàn tất thành công!
          if (!receiver) {
            const maTaiKhoanMoi = 'USR-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const cleanSlug = recipientInput.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'friend';
            const [createdFriend] = await User.create([{
              maTaiKhoan: maTaiKhoanMoi,
              tenDangNhap: recipientInput,
              email: `${cleanSlug}_${Date.now()}@stealgame.vn`,
              matKhau: '$2b$10$EixZaYVK1Fsbw1ZfbX3OXePaWxn96p36WQmG6FeEwE8/i.4zK4bWy',
              hoTen: recipientInput,
              vaiTro: 'customer',
              quyen: [],
              viTien: 0,
              biKhoa: false,
              ngayDangKy: new Date(),
              danhSachGameDaMua: []
            }], { session });

            receiver = createdFriend;
          }

          // Lấy ID người nhận
          receiverId = receiver._id.toString();

          if (capNhatThuVien.has(receiverId)) {
            receiver = capNhatThuVien.get(receiverId);
          }

          if (receiver._id.toString() === buyer._id.toString()) {
            throw new Error('Bạn không thể tự tặng game cho chính mình');
          }

          nguoiNhan = receiver.tenDangNhap;
        }

// Kiểm tra người nhận đã sở hữu game chưa.
const daSoHuu = receiver.danhSachGameDaMua.some(
  gameId => gameId.toString() === game._id.toString()
);

if (daSoHuu) {
  throw new Error(
    laQua
      ? `${receiver.tenDangNhap} đã sở hữu game ${game.tenTroChoi}`
      : `Bạn đã sở hữu game ${game.tenTroChoi}`
  );
}

// Lưu document người nhận vào Map nếu chưa có.
if (!capNhatThuVien.has(receiverId)) {
  capNhatThuVien.set(receiverId, receiver);
}

// Cập nhật thư viện của người nhận.
receiver.danhSachGameDaMua.push(game._id);

          // 9. Lưu thông tin sản phẩm vào đơn hàng
          danhSachSanPham.push({
            maGame: game.maGame,
            tenGame: game.tenTroChoi,
            donGia: giaGame,
            laQua,
            nguoiNhan,
            loiNhan: laQua
              ? String(item.loiNhan || '').trim()
              : ''
          });

          tongTienGoc += giaGame;
        }

        // 10. Kiểm tra mã khuyến mãi
        let promotion = null;
        let soTienGiam = 0;
        let phanTramGiamGia = 0;
        let code = String(maKhuyenMai || '').trim().toUpperCase();

        if (code) {
          promotion = await Promotion.findOne({
            maKhuyenMai: code
          }).session(session);

          if (!promotion) {
            throw new Error('Mã khuyến mãi không hợp lệ');
          }

          if (!promotion.trangThai) {
  throw new Error('Mã khuyến mãi hiện không được kích hoạt');
}

// Kiểm tra phần trăm giảm giá
const phanTram = Number(promotion.phanTramGiamGia);

if (
  !Number.isFinite(phanTram) ||
  phanTram < 1 ||
  phanTram > 100
) {
  throw new Error('Phần trăm giảm giá của mã không hợp lệ');
}

const now = new Date();

          if (now < promotion.ngayBatDau) {
            throw new Error('Mã khuyến mãi chưa đến thời gian áp dụng');
          }

          if (
  promotion.ngayKetThuc &&
  now > new Date(promotion.ngayKetThuc)
) {
  throw new Error('Mã khuyến mãi đã hết hạn');
}

          if (promotion.chiApDungLanDau) {
            const daTungMua = await Order.findOne({
              maTaiKhoan: buyer.maTaiKhoan,
              trangThai: 'completed'
            }).session(session);

            if (daTungMua) {
              throw new Error(
                'Mã này chỉ áp dụng cho đơn hàng đầu tiên của tài khoản'
              );
            }
          }

          if (tongTienGoc <= 0) {
            throw new Error('Giỏ hàng không có game trả phí để áp dụng mã');
          }

phanTramGiamGia = phanTram;
          // Áp dụng cho TOÀN BỘ game, kể cả game tặng
          soTienGiam = Math.min(
            Math.round(tongTienGoc * phanTramGiamGia / 100),
            tongTienGoc
          );
        }

        const tongTien = tongTienGoc - soTienGiam;

        // 11. Tạo mã đơn hàng
        const maDonHang =
          'ORD-' +
          new Date().getFullYear() +
          '-' +
          Date.now() +
          '-' +
          Math.floor(Math.random() * 1000);

        // 12. Tạo đơn hàng
        const order = new Order({
          maDonHang,
          maTaiKhoan: buyer.maTaiKhoan,
          sanPham: danhSachSanPham,

          tongTienGoc,
          maKhuyenMai: code,
          phanTramGiamGia,
          soTienGiam,
          tongTien,

          phuongThucThanhToan,
          trangThai: 'completed'
        });

        await order.save({ session });

        // 13. Lưu thư viện của người mua và người nhận quà
        for (const receiver of capNhatThuVien.values()) {
          await receiver.save({ session });
        }

        // 14. Tăng lượt sử dụng mã đúng một lần cho đơn hàng
        if (promotion) {
          promotion.daSuDung += 1;
          await promotion.save({ session });
        }

        ketQuaThanhToan = {
          maDonHang: order.maDonHang,
          maTaiKhoan: order.maTaiKhoan,
          sanPham: order.sanPham,
          tongTienGoc: order.tongTienGoc,
          maKhuyenMai: order.maKhuyenMai,
          phanTramGiamGia: order.phanTramGiamGia,
          soTienGiam: order.soTienGiam,
          tongTien: order.tongTien,
          phuongThucThanhToan: order.phuongThucThanhToan,
          trangThai: order.trangThai,
          createdAt: order.createdAt
        };
      });

      return res.status(201).json({
        success: true,
        message: 'Thanh toán giỏ hàng thành công',
        data: ketQuaThanhToan
      });

    } catch (error) {
      console.error('Lỗi thanh toán giỏ hàng:', error);

      return res.status(400).json({
        success: false,
        message: error.message || 'Không thể thanh toán giỏ hàng'
      });

    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }
);
// ========================================
// ADMIN: XEM CHI TIẾT BẤT KỲ ĐƠN HÀNG NÀO (HOẶC THEO ID YÊU CẦU HOÀN TIỀN)
// GET /api/store/admin/orders/:id
// ========================================

const adminMiddleware = require('../middleware/adminMiddleware');

router.get(
  '/admin/orders',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {
    try {
      // Bao gồm đơn đã hoàn toàn bộ (trangThai='cancelled').
      const orders = await Order.find({
        trangThai: { $in: ['completed', 'cancelled'] }
      }).sort({ createdAt: -1 }).lean();

      const orderIds = orders.map(order => order._id);
      const accountCodes = [...new Set(
        orders.map(order => order.maTaiKhoan).filter(Boolean)
      )];

      const [customers, refunds] = await Promise.all([
        User.find({ maTaiKhoan: { $in: accountCodes } })
          .select('maTaiKhoan tenDangNhap hoTen').lean(),
        RefundRequest.find({ maDonHang: { $in: orderIds } })
          .select('_id maDonHang maGame maYeuCau trangThaiHoanTien soTienHoan ngayYeuCau createdAt')
          .sort({ ngayYeuCau: -1, createdAt: -1 }).lean()
      ]);

      const customerMap = new Map(
        customers.map(user => [String(user.maTaiKhoan), user])
      );

      // Một đơn có THỂ có nhiều yêu cầu: KHÔNG dùng Map(orderId -> một refund).
      const refundsByOrder = new Map();
      for (const refund of refunds) {
        const id = String(refund.maDonHang);
        if (!refundsByOrder.has(id)) refundsByOrder.set(id, []);
        refundsByOrder.get(id).push(refund);
      }

      const statusMap = {
        pending: 'cho_xu_ly',
        approved: 'da_hoan_tien',
        rejected: 'tu_choi_hoan_tien'
      };

      const data = [];

      for (const order of orders) {
        const danhSachYeuCau = refundsByOrder.get(String(order._id)) || [];

        // Không lấy các đơn hủy thông thường, chỉ giữ đơn đã có refund.
        if (order.trangThai === 'cancelled' && !danhSachYeuCau.length) {
          continue;
        }

        const products = Array.isArray(order.sanPham) ? order.sanPham : [];
        const customer = customerMap.get(String(order.maTaiKhoan));
        const base = {
          idDonHang: String(order._id),
          maDonHang: order.maDonHang,
          tenKhachHang: customer?.tenDangNhap || customer?.hoTen || order.maTaiKhoan,
          tongTien: Number(order.tongTien) || 0,
          phuongThucThanhToan: order.phuongThucThanhToan || 'wallet',
          ngayTao: order.createdAt
        };

        // 1 yêu cầu hoàn = 1 dòng, dù nhiều yêu cầu thuộc cùng một đơn.
        for (const refund of danhSachYeuCau) {
          const product = products.find(
            sp => String(sp.maGame) === String(refund.maGame)
          );
          const status = statusMap[refund.trangThaiHoanTien];
          if (!status) continue;

          data.push({
            ...base,
            idYeuCau: String(refund._id),
            maYeuCau: refund.maYeuCau || '',
            tenGame: product?.tenGame || product?.maGame || `Game ${refund.maGame}`,
            trangThai: status,
            soTienHoanDuKien: product
              ? tienHoanTheoGame(order, refund.maGame)
              : 0,
            soTienHoan: status === 'da_hoan_tien'
              ? Number(refund.soTienHoan) || 0
              : 0
          });
        }

        // Game chưa từng có yêu cầu hoàn vẫn thuộc phần Thành công,
        // không bị gộp thành game đã hoàn cùng những game khác trong đơn.
        const requestedGames = new Set(
          danhSachYeuCau.map(refund => String(refund.maGame))
        );
        const untouched = products.filter(
          product => !requestedGames.has(String(product.maGame))
        );

        if (untouched.length && order.trangThai === 'completed') {
          data.push({
            ...base,
            idYeuCau: '',
            maYeuCau: '',
            tenGame: untouched
              .map(product => product.tenGame || product.maGame)
              .filter(Boolean).join(', '),
            trangThai: 'thanh_cong',
            soTienHoanDuKien: 0,
            soTienHoan: 0
          });
        }
      }

      return res.json({ success: true, total: data.length, data });
    } catch (error) {
      console.error('Lỗi tải danh sách đơn hàng Admin:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải danh sách đơn hàng'
      });
    }
  }
);

router.get(
  '/admin/orders/:id',
  authMiddleware,
  adminMiddleware,
  orderRoleMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Kiểm tra xem id truyền vào là RefundRequest ID hay Order ID / maDonHang
      let refund = null;

      if (mongoose.Types.ObjectId.isValid(id)) {
        refund = await RefundRequest.findById(id)
          .populate('adminXuLy', 'tenDangNhap hoTen')
          .lean();
      }

      if (!refund) {
        refund = await RefundRequest.findOne({ maYeuCau: id })
          .populate('adminXuLy', 'tenDangNhap hoTen')
          .lean();
      }

      // 2. Tìm đơn hàng tương ứng
      let order = null;

      if (refund) {
        order = await Order.findById(refund.maDonHang).lean();
      } else {
        const orderQuery = mongoose.Types.ObjectId.isValid(id)
          ? { $or: [{ _id: id }, { maDonHang: id }] }
          : { maDonHang: id };

        order = await Order.findOne(orderQuery).lean();

        // Truy cập bằng Order ID nghĩa là xem hóa đơn gốc.
        // Không tự gắn yêu cầu hoàn tiền ngẫu nhiên khi đơn có nhiều refund.
        // Để xem từng yêu cầu, frontend chuyển bằng RefundRequest ID.
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin đơn hàng'
        });
      }

      // 3. Tìm thông tin người mua
      const buyer = await User.findOne({ maTaiKhoan: order.maTaiKhoan })
        .select('maTaiKhoan tenDangNhap hoTen email soDienThoai')
        .lean();

      // 4. Tìm thông tin ảnh và chi tiết các game trong đơn
      const gameCodes = order.sanPham.map(sp => sp.maGame);
      const games = await Game.find({ maGame: { $in: gameCodes } })
        .select('maGame tenTroChoi anhBia anhThuNho giaHienTai')
        .lean();

      const gameMap = new Map(games.map(g => [g.maGame, g]));

      const paidByGame = new Map(
        phanBoTienThucTra(order).map(item => [item.maGame, item.soTienThucTra])
      );
      const danhSachSanPham = order.sanPham.map(sp => {
        const gInfo = gameMap.get(sp.maGame);
        const soTienThucTra = paidByGame.get(String(sp.maGame)) ?? Number(sp.donGia);
        return {
          maGame: sp.maGame,
          tenGame: sp.tenGame,
          anhGame: gInfo?.anhBia || gInfo?.anhThuNho || '',
          soLuong: 1,
          donGia: sp.donGia,
          giamGia: Number(sp.donGia) - soTienThucTra,
          thanhTien: soTienThucTra,
          laQua: Boolean(sp.laQua),
          nguoiNhan: sp.nguoiNhan || '',
          loiNhan: sp.loiNhan || ''
        };
      });

      return res.json({
        success: true,
        data: {
          order,
          buyer,
          danhSachSanPham,
          refund
        }
      });
    } catch (error) {
      console.error('Lỗi Admin xem chi tiết đơn hàng:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy thông tin chi tiết đơn hàng'
      });
    }
  }
);
// ========================================
// ADMIN: DỮ LIỆU TỔNG QUAN DASHBOARD
// GET /api/store/admin/dashboard
// ========================================

router.get(
  '/admin/dashboard',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      // 1. Lấy toàn bộ đơn hàng (sắp xếp mới nhất lên đầu)
      const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .lean();

      // 2. Lấy danh sách yêu cầu hoàn tiền đã duyệt
      const approvedRefunds = await RefundRequest.find({
        trangThaiHoanTien: 'approved'
      })
        .select('maDonHang')
        .lean();

      const refundedOrderIds = new Set(
        approvedRefunds.map(rf => String(rf.maDonHang))
      );

      // 3. Lấy thông tin game để thống kê lượt bán và lấy ảnh bìa
      const games = await Game.find({})
        .select('_id maGame tenTroChoi anhBia anhThuNho duongDanSlug')
        .lean();

      const gameMap = new Map(games.map(g => [g.maGame, g]));
      const gameSalesCountMap = new Map();

      const danhSachDonHang = orders.map(ord => {
        const gameNames = Array.isArray(ord.sanPham)
          ? ord.sanPham.map(sp => sp.tenGame).filter(Boolean).join(', ')
          : '';

        let trangThai = 'Đã thanh toán';
        if (ord.trangThai === 'cancelled') {
          trangThai = 'Đã hủy';
        } else if (refundedOrderIds.has(String(ord._id))) {
          trangThai = 'Đã hoàn tiền';
        } else if (ord.trangThai === 'pending') {
          trangThai = 'Đang xử lý';
        }

        // Đếm lượt bán cho từng game nếu đơn thành công
        if (ord.trangThai === 'completed' && Array.isArray(ord.sanPham)) {
          for (const sp of ord.sanPham) {
            const current = gameSalesCountMap.get(sp.maGame) || 0;
            gameSalesCountMap.set(sp.maGame, current + 1);
          }
        }

        const firstGame = Array.isArray(ord.sanPham) && ord.sanPham[0] ? ord.sanPham[0] : null;
        const gInfo = firstGame ? gameMap.get(firstGame.maGame) : null;

        return {
          maDonHang: ord.maDonHang,
          tenGame: gameNames || 'Không có game',
          gameId: gInfo ? String(gInfo._id) : (firstGame?.maGame || ''),
          tongTien: Number(ord.tongTien) || 0,
          phuongThuc: (ord.phuongThucThanhToan || 'wallet').toLowerCase(),
          trangThai,
          ngayTao: ord.createdAt
        };
      });

      // 4. Lấy Top 5 game bán chạy (dùng MongoDB _id để điều hướng đúng sang /admin/games/:id)
      const topGameList = Array.from(gameSalesCountMap.entries())
        .map(([maGame, luotBan]) => {
          const g = gameMap.get(maGame);
          return {
            id: g ? String(g._id) : maGame,
            tenGame: g?.tenTroChoi || maGame,
            luotBan,
            hinhAnh: g?.anhBia || g?.anhThuNho || 'https://placehold.co/48x48/252b4b/ffffff?text=G'
          };
        })
        .sort((a, b) => b.luotBan - a.luotBan)
        .slice(0, 5);

      // 5. Lấy danh sách khách hàng để đếm khách hàng mới theo ngày đăng ký
      const customers = await User.find({ vaiTro: 'customer' })
        .select('maTaiKhoan tenDangNhap ngayDangKy createdAt')
        .lean();

      const danhSachKhachHang = customers.map(c => ({
        maTaiKhoan: c.maTaiKhoan,
        tenKhachHang: c.tenDangNhap,
        ngayTao: c.ngayDangKy || c.createdAt
      }));

      return res.json({
        success: true,
        data: {
          donHang: danhSachDonHang,
          gameBanChay: topGameList,
          taiKhoan: danhSachKhachHang
        }
      });
    } catch (error) {
      console.error('Lỗi lấy dữ liệu Dashboard:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy dữ liệu Dashboard'
      });
    }
  }
);

// ========================================
// ADMIN: DỮ LIỆU BÁO CÁO THỐNG KÊ DOANH THU
// GET /api/store/admin/analytics
// ========================================

// Hàm hỗ trợ: lấy thời gian tạo từ document hoặc trích xuất từ ObjectId của MongoDB
function layNgayTao(doc, fallbackField) {
  if (fallbackField && doc[fallbackField]) return doc[fallbackField];
  if (doc.createdAt) return doc.createdAt;
  if (doc.ngayTao) return doc.ngayTao;
  if (doc.ngayDat) return doc.ngayDat;
  if (doc._id && typeof doc._id.getTimestamp === 'function') {
    return doc._id.getTimestamp();
  }
  return new Date();
}

router.get(
  '/admin/analytics',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      // 1. Lấy toàn bộ đơn hàng
      const orders = await Order.find({})
        .sort({ createdAt: -1 })
        .lean();

      // 2. Lấy danh sách yêu cầu hoàn tiền đã duyệt
      const approvedRefunds = await RefundRequest.find({
        trangThaiHoanTien: 'approved'
      })
        .select('maDonHang')
        .lean();

      const refundedOrderIds = new Set(
        approvedRefunds.map(rf => String(rf.maDonHang))
      );

      // 3. Lấy thông tin game để lấy _id, thể loại, ảnh bìa
      const games = await Game.find({})
        .select('_id maGame tenTroChoi anhBia anhThuNho tenTheLoai maTheLoai')
        .lean();

      const gameMap = new Map();
      games.forEach(g => {
        if (g.maGame) gameMap.set(g.maGame, g);
        if (g._id) gameMap.set(String(g._id), g);
        if (g.tenTroChoi) gameMap.set(g.tenTroChoi.toLowerCase(), g);
      });

      // 4. Lấy thông tin tất cả tài khoản người dùng
      const users = await User.find({})
        .select('_id maTaiKhoan tenDangNhap hoTen email vaiTro ngayDangKy createdAt')
        .lean();

      const userMap = new Map();
      const canonicalAccountMap = new Map();
      users.forEach(u => {
        const displayName = u.hoTen || u.tenDangNhap || u.maTaiKhoan;
        const canonicalId = u.maTaiKhoan || String(u._id);
        if (u.maTaiKhoan) {
          userMap.set(u.maTaiKhoan, displayName);
          canonicalAccountMap.set(u.maTaiKhoan, canonicalId);
        }
        if (u.tenDangNhap) {
          userMap.set(u.tenDangNhap, displayName);
          canonicalAccountMap.set(u.tenDangNhap, canonicalId);
        }
        if (u._id) {
          userMap.set(String(u._id), displayName);
          canonicalAccountMap.set(String(u._id), canonicalId);
        }
      });

      // 5. Chuẩn hóa dữ liệu đơn hàng (hỗ trợ cả schema mới lẫn dữ liệu seed cũ)
      const danhSachDonHang = orders.map(ord => {
        const rawStatus = String(ord.trangThai || 'completed').toLowerCase().trim();
        let trangThai = 'Đã thanh toán';
        if (rawStatus === 'cancelled' || rawStatus.includes('hủy') || rawStatus.includes('huy')) {
          trangThai = 'Đã hủy';
        } else if (
          refundedOrderIds.has(String(ord._id)) ||
          refundedOrderIds.has(String(ord.maDonHang)) ||
          rawStatus === 'refunded' ||
          rawStatus.includes('hoàn tiền') ||
          rawStatus.includes('hoan tien')
        ) {
          trangThai = 'Đã hoàn tiền';
        } else if (rawStatus === 'pending' || rawStatus.includes('chờ') || rawStatus.includes('đang xử lý')) {
          trangThai = 'Đang xử lý';
        } else {
          trangThai = 'Đã thanh toán';
        }

        const rawItems = Array.isArray(ord.sanPham) && ord.sanPham.length > 0
          ? ord.sanPham
          : (Array.isArray(ord.danhSachSanPham) ? ord.danhSachSanPham : []);

        const danhSachGame = rawItems.map(sp => {
          const code = sp.maGame || sp.gameId || sp.id || '';
          const name = sp.tenGame || sp.tenTroChoi || sp.title || code || 'Trò chơi STEAL';
          const g = gameMap.get(code) || gameMap.get(name.toLowerCase());

          const theLoaiStr = Array.isArray(g?.tenTheLoai) && g.tenTheLoai.length > 0
            ? g.tenTheLoai.join(', ')
            : 'Hành Động';

          return {
            id: g ? String(g._id) : (code || name),
            tenGame: g?.tenTroChoi || name,
            danhMuc: theLoaiStr,
            hinhAnh: g?.anhBia || g?.anhThuNho || 'https://placehold.co/48x48/252b4b/ffffff?text=G',
            soLuong: Number(sp.soLuong) > 0 ? Number(sp.soLuong) : 1,
            thanhTien: Number(sp.donGia ?? sp.gia ?? ord.tongTien ?? 0) || 0
          };
        });

        const rawBuyer = ord.maTaiKhoan || ord.maTaiKhoanNguoiMua || ord.tenNguoiMua || 'KHACH-LE';
        const buyerId = canonicalAccountMap.get(rawBuyer) || String(rawBuyer);
        const buyerName = userMap.get(rawBuyer) || ord.tenNguoiMua || String(rawBuyer);

        return {
          maDonHang: ord.maDonHang || String(ord._id),
          ngayTao: layNgayTao(ord),
          tongTien: Number(ord.tongTien) || 0,
          trangThai,
          phuongThucThanhToan: (ord.phuongThucThanhToan || 'Ví STEAL / MoMo'),
          maTaiKhoanNguoiMua: buyerId,
          tenNguoiMua: buyerName,
          danhSachGame
        };
      });

      // 6. Danh sách tài khoản khách hàng
      const customerUsers = users.filter(u => u.vaiTro !== 'admin');
      const danhSachTaiKhoan = customerUsers.map(u => ({
        maTaiKhoan: u.maTaiKhoan || String(u._id),
        tenTaiKhoan: u.hoTen || u.tenDangNhap || u.maTaiKhoan,
        ngayTao: layNgayTao(u, 'ngayDangKy')
      }));

      return res.json({
        success: true,
        data: {
          donHangData: danhSachDonHang,
          taiKhoanData: danhSachTaiKhoan
        }
      });
    } catch (error) {
      console.error('Lỗi lấy dữ liệu Báo cáo Analytics:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy dữ liệu báo cáo thống kê'
      });
    }
  }
);

module.exports = router;