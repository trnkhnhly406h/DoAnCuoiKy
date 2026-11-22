const express = require('express');
const Game = require('../models/Game');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const router = express.Router();

const Order = require('../models/Order');
const RefundRequest = require('../models/RefundRequest');


// =====================================================
// GET /api/store/games
// Lấy danh sách game
//
// Có thể dùng:
//
// /games
// /games?search=truck
// /games?category=simulation
//
// /games?featured=true
// /games?new=true
// /games?free=true
// /games?bestseller=true
// /games?deal=true
//
// Có thể kết hợp:
// /games?search=sim&category=simulation&free=true
// =====================================================
router.get('/games', async (req, res) => {
  try {

    const {
      search,
      category,
      featured,
      new: isNew,
      free,
      bestseller,
      deal
    } = req.query;


    // =================================================
    // Tạo bộ điều kiện tìm kiếm
    // =================================================

let filter = { trangThaiBan: true };

    // =================================================
    // 1. Tìm kiếm theo tên game
    // Ví dụ:
    // ?search=truck
    // =================================================

    if (search) {
      filter.tenTroChoi = {
        $regex: search,
        $options: 'i'
      };
    }


    // =================================================
    // 2. Lọc theo thể loại
    // Ví dụ:
    // ?category=simulation
    // =================================================

    if (category) {
      filter.maTheLoai = category;
    }


    // =================================================
    // 3. Game nổi bật
    // ?featured=true
    // =================================================

    if (featured === 'true') {
      filter.laGameNoiBat = true;
    }


    // =================================================
    // 4. Game mới
    // ?new=true
    // =================================================

    if (isNew === 'true') {
      filter.laGameMoi = true;
    }


    // =================================================
    // 5. Game miễn phí
    // ?free=true
    // =================================================

    if (free === 'true') {
      filter.laGameMienPhi = true;
    }


    // =================================================
    // 6. Game bán chạy
    // ?bestseller=true
    // =================================================

    if (bestseller === 'true') {
      filter.laGameBanChay = true;
    }


    // =================================================
    // 7. Game ưu đãi
    // ?deal=true
    // =================================================

    if (deal === 'true') {
      filter.laGameUuDai = true;
    }


    // =================================================
    // 8. Lấy dữ liệu từ MongoDB
    // =================================================

    const games = await Game.find(filter);


    // =================================================
    // 9. Trả kết quả
    // =================================================

    res.json({
      success: true,
      data: games
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách game'
    });
  }
});


// =====================================================
// GET /api/store/games/:id
// Lấy chi tiết game
//
// Ví dụ:
// /games/6ad5a980dd26c97ce5828b49
// =====================================================

router.get('/games/:id', async (req, res) => {
  try {

const game = await Game.findOne({
  _id: req.params.id,
  trangThaiBan: true
});

    // Không tìm thấy game
    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy game'
      });
    }


    // Trả game
    res.json({
      success: true,
      data: game
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Không thể lấy thông tin game'
    });
  }
});

// ========================================
// ADMIN - QUẢN LÝ TRÒ CHƠI
// ========================================


// 1. LẤY TẤT CẢ TRÒ CHƠI KÈM SỐ LƯỢT BÁN
router.get(
  '/admin/games',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      // Lấy game, đơn thành công và yêu cầu hoàn đã duyệt
      const [games, orders, refunds] = await Promise.all([
        Game.find()
          .sort({ createdAt: -1 })
          .lean(),

        Order.find({
          trangThai: 'completed'
        })
          .select('_id sanPham.maGame')
          .lean(),

        RefundRequest.find({
          trangThaiHoanTien: 'approved'
        })
          .select('maDonHang maGame')
          .lean()
      ]);

      // Xác định từng game đã được hoàn trong mỗi đơn
      const refundedItems = new Set(
        refunds.map(refund =>
          `${refund.maDonHang}:${refund.maGame}`
        )
      );

      // Thống kê số lượt bán theo mã game
      const salesMap = new Map();

      for (const order of orders) {
        for (const item of order.sanPham || []) {
          const maGame = String(item.maGame);

          const key = `${order._id}:${maGame}`;

          // Không tính game đã được duyệt hoàn tiền
          if (refundedItems.has(key)) {
            continue;
          }

          salesMap.set(
            maGame,
            (salesMap.get(maGame) || 0) + 1
          );
        }
      }

      // Bổ sung lượt bán vào dữ liệu trả về Angular
      const data = games.map(game => ({
        ...game,
        luotBan: salesMap.get(String(game.maGame)) || 0
      }));

      return res.status(200).json({
        success: true,
        data
      });

    } catch (error) {
      console.error('Lỗi lấy danh sách trò chơi:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách trò chơi'
      });
    }
  }
);



// 2. THÊM TRÒ CHƠI
router.post(
  '/admin/games',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        maGame,
        tenTroChoi,
        duongDanSlug,
        giaGoc,
        phanTramGiamGia = 0,
        ...otherFields
      } = req.body;

      if (!maGame || !tenTroChoi || !duongDanSlug || giaGoc === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mã game, tên game, slug và giá gốc'
        });
      }

      const gia = Number(giaGoc);
      const giamGia = Number(phanTramGiamGia);

      if (
        !Number.isFinite(gia) || gia < 0 ||
        !Number.isFinite(giamGia) || giamGia < 0 || giamGia > 100
      ) {
        return res.status(400).json({
          success: false,
          message: 'Giá hoặc phần trăm giảm giá không hợp lệ'
        });
      }

      const giaHienTai = Math.round(gia * (1 - giamGia / 100));

      const game = await Game.create({
  ...otherFields,
  maGame,
  tenTroChoi,
  duongDanSlug,
  giaGoc: gia,
  phanTramGiamGia: giamGia,
  giaHienTai
});

      return res.status(201).json({
        success: true,
        message: 'Thêm trò chơi thành công',
        data: game
      });

    } catch (error) {
      console.error('Lỗi thêm trò chơi:', error);

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Mã game hoặc đường dẫn slug đã tồn tại'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Không thể thêm trò chơi'
      });
    }
  }
);


// 3. CẬP NHẬT TRÒ CHƠI
router.put(
  '/admin/games/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const {
        giaGoc,
        phanTramGiamGia,
        ...otherFields
      } = req.body;

      const game = await Game.findById(req.params.id);

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy trò chơi'
        });
      }

      if (giaGoc !== undefined) {
        const gia = Number(giaGoc);

        if (!Number.isFinite(gia) || gia < 0) {
          return res.status(400).json({
            success: false,
            message: 'Giá gốc không hợp lệ'
          });
        }

        game.giaGoc = gia;
      }

      if (phanTramGiamGia !== undefined) {
        const giamGia = Number(phanTramGiamGia);

        if (
          !Number.isFinite(giamGia) ||
          giamGia < 0 ||
          giamGia > 100
        ) {
          return res.status(400).json({
            success: false,
            message: 'Phần trăm giảm giá phải từ 0 đến 100'
          });
        }

        game.phanTramGiamGia = giamGia;
      }

      const allowedFields = [
        'maGame',
        'tenTroChoi',
        'duongDanSlug',
        'anhBia',
        'anhThuNho',
        'videoTrailer',
        'danhSachAnh',
        'moTaNgan',
        'moTaChiTiet',
        'maTheLoai',
        'tenTheLoai',
        'doTuoi',
        'nhaPhatHanh',
        'nhaPhatTrien',
        'ngayPhatHanh',
        'laGameNoiBat',
        'laGameMoi',
        'laGameMienPhi',
        'laGameBanChay',
        'laGameUuDai',
        'trangThaiBan',
        'osToiThieu',
        'cpuToiThieu',
        'ramToiThieu',
        'gpuToiThieu',
        'diskToiThieu',
        'osDeNghi',
        'cpuDeNghi',
        'ramDeNghi',
        'gpuDeNghi',
        'diskDeNghi'
      ];

      allowedFields.forEach(field => {
        if (otherFields[field] !== undefined) {
          game[field] = otherFields[field];
        }
      });

      game.giaHienTai = Math.round(
        game.giaGoc * (1 - game.phanTramGiamGia / 100)
      );

      await game.save();

      return res.status(200).json({
        success: true,
        message: 'Cập nhật trò chơi thành công',
        data: game
      });

    } catch (error) {
      console.error('Lỗi cập nhật trò chơi:', error);

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Mã game hoặc đường dẫn slug đã tồn tại'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật trò chơi'
      });
    }
  }
);


// 4. ẨN / HIỆN TRÒ CHƠI
router.patch(
  '/admin/games/:id/status',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { trangThaiBan } = req.body;

      if (typeof trangThaiBan !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái trò chơi không hợp lệ'
        });
      }

      const game = await Game.findByIdAndUpdate(
        req.params.id,
        { trangThaiBan },
        { new: true, runValidators: true }
      );

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy trò chơi'
        });
      }

      return res.status(200).json({
        success: true,
        message: trangThaiBan
          ? 'Đã hiển thị trò chơi'
          : 'Đã ẩn trò chơi',
        data: game
      });

    } catch (error) {
      console.error('Lỗi thay đổi trạng thái trò chơi:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể thay đổi trạng thái trò chơi'
      });
    }
  }
);


// 5. XÓA TRÒ CHƠI (ẨN KHỎI CỬA HÀNG)
router.delete(
  '/admin/games/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const game = await Game.findByIdAndUpdate(
        req.params.id,
        { trangThaiBan: false },
        { new: true }
      );

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy trò chơi'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Đã ẩn trò chơi thành công',
        data: game
      });

    } catch (error) {
      console.error('Lỗi ẩn trò chơi:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể ẩn trò chơi'
      });
    }
  }
);
module.exports = router;
