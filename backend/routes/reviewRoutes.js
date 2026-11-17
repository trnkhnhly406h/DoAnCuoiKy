const express = require('express');
const mongoose = require('mongoose');

const Review = require('../models/Review');
const User = require('../models/User');
const Game = require('../models/Game');
const Order = require('../models/Order');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

function formatDateVN(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/*
|--------------------------------------------------------------------------
| GET /api/store/admin/reviews
|--------------------------------------------------------------------------
| Admin lấy toàn bộ danh sách đánh giá (bao gồm cả đang hiển thị và đã ẩn)
|--------------------------------------------------------------------------
*/
router.get(
  '/admin/reviews',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const reviews = await Review.find({})
        .populate(
          'maTaiKhoan',
          'maTaiKhoan tenDangNhap hoTen anhDaiDien ngayDangKy createdAt'
        )
        .populate(
          'maGame',
          'maGame tenTroChoi anhBia anhThuNho'
        )
        .sort({ ngayDanhGia: -1, createdAt: -1 })
        .lean();

      // Lấy các đơn hàng thành công để tra cứu ngày mua game của khách hàng
      const orders = await Order.find({ trangThai: 'completed' })
        .select('maTaiKhoan sanPham createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const purchaseDateMap = new Map();
      for (const ord of orders) {
        const maTK = String(ord.maTaiKhoan || '').trim();
        if (!maTK || !Array.isArray(ord.sanPham)) continue;
        for (const sp of ord.sanPham) {
          const key = `${maTK}_${sp.maGame}`;
          if (!purchaseDateMap.has(key)) {
            purchaseDateMap.set(key, formatDateVN(ord.createdAt));
          }
        }
      }

      const data = reviews.map(rv => {
        const user = rv.maTaiKhoan || {};
        const game = rv.maGame || {};
        const maTK = user.maTaiKhoan || '';
        const maG = game.maGame || '';
        const ngayMua =
          purchaseDateMap.get(`${maTK}_${maG}`) ||
          formatDateVN(user.ngayDangKy || user.createdAt);

        return {
          _id: rv._id,
          maTaiKhoanNguoiDung: maTK,
          tenTaiKhoanNguoiDung: user.tenDangNhap || 'Không xác định',
          hoTen: user.hoTen || user.tenDangNhap || '',
          anhDaiDien: user.anhDaiDien || '',
          ngayThamGia: formatDateVN(user.ngayDangKy || user.createdAt),
          maGame: maG,
          tenGame: game.tenTroChoi || 'Không xác định',
          anhGame: game.anhBia || game.anhThuNho || '',
          ngayMuaGame: ngayMua,
          danhGia: rv.khuyenNghi ? 'khuyen_dung' : 'khong_khuyen_dung',
          rating: rv.rating || (rv.khuyenNghi ? 5 : 1),
          noiDung: rv.noiDung || '',
          ngayDanhGia: formatDateVN(rv.ngayDanhGia || rv.createdAt),
          trangThai: rv.an ? 'da_an' : 'hien_thi'
        };
      });

      return res.json({
        success: true,
        total: data.length,
        data
      });
    } catch (error) {
      console.error('Lỗi Admin lấy danh sách đánh giá:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách đánh giá'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET /api/store/reviews
|--------------------------------------------------------------------------
| Lấy toàn bộ review.
|
| Route này dùng cho các trường hợp cần lấy danh sách review.
| Không bắt buộc đăng nhập.
|--------------------------------------------------------------------------
*/
router.get('/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({
      an: false
    })
      .populate(
        'maTaiKhoan',
        'tenDangNhap hoTen anhDaiDien'
      )
      .sort({
        ngayDanhGia: -1
      });

    res.json({
      success: true,
      data: reviews
    });

  } catch (error) {
    console.error(
      'Lỗi lấy danh sách review:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách review'
    });
  }
});


/*
|--------------------------------------------------------------------------
| GET /api/store/reviews/game/:gameId
|--------------------------------------------------------------------------
| Lấy review của một game.
|
| gameId ở backend phải là MongoDB ObjectId của Game.
|--------------------------------------------------------------------------
*/
router.get('/reviews/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;

    /*
     * Kiểm tra ObjectId trước khi truy vấn MongoDB.
     */
    if (!mongoose.Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã game không hợp lệ'
      });
    }

    const reviews = await Review.find({
      maGame: gameId,
      an: false
    })
      .populate(
        'maTaiKhoan',
        'tenDangNhap hoTen anhDaiDien'
      )
      .sort({
        ngayDanhGia: -1
      });

    res.json({
      success: true,
      data: reviews
    });

  } catch (error) {
    console.error(
      'Lỗi lấy review theo game:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Không thể lấy review của game'
    });
  }
});


/*
|--------------------------------------------------------------------------
| GET /api/store/reviews/me/:gameId
|--------------------------------------------------------------------------
| Lấy review của chính tài khoản đang đăng nhập cho một game.
|
| Route này dùng để frontend biết:
| - User đã review game chưa.
| - Nếu đã review thì lấy rating + nội dung cũ.
|--------------------------------------------------------------------------
*/
router.get(
  '/reviews/me/:gameId',
  authMiddleware,
  async (req, res) => {
    try {
      const { gameId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(gameId)) {
        return res.status(400).json({
          success: false,
          message: 'Mã game không hợp lệ'
        });
      }

      const review = await Review.findOne({
        maGame: gameId,
        maTaiKhoan: req.user._id,
        an: false
      }).populate(
        'maTaiKhoan',
        'tenDangNhap hoTen anhDaiDien'
      );

      res.json({
        success: true,
        data: review || null
      });

    } catch (error) {
      console.error(
        'Lỗi lấy review của tôi:',
        error
      );

      res.status(500).json({
        success: false,
        message: 'Không thể lấy đánh giá của bạn'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| POST /api/store/reviews
|--------------------------------------------------------------------------
| Tạo / cập nhật review.
|--------------------------------------------------------------------------
*/
router.post(
  '/reviews',
  authMiddleware,
  async (req, res) => {
    try {
      const {
        maGame,
        rating,
        khuyenNghi,
        noiDung
      } = req.body;

      if (
        !maGame ||
        !mongoose.Types.ObjectId.isValid(maGame)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Mã game không hợp lệ'
        });
      }

      if (
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
      ) {
        return res.status(400).json({
          success: false,
          message: 'Số sao đánh giá phải từ 1 đến 5'
        });
      }

      const content = String(
        noiDung || ''
      ).trim();

      if (content.length < 5) {
        return res.status(400).json({
          success: false,
          message:
            'Nội dung đánh giá cần ít nhất 5 ký tự'
        });
      }

      const recommend = rating >= 3;

      const user = await User.findById(
        req.user._id
      );

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

      const game = await Game.findById(
        maGame
      );

      if (!game) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy game'
        });
      }

      const hasPurchased =
        Array.isArray(
          user.danhSachGameDaMua
        ) &&
        user.danhSachGameDaMua.some(
          purchasedGameId =>
            purchasedGameId.toString() ===
            game._id.toString()
        );

      if (!hasPurchased) {
        return res.status(403).json({
          success: false,
          message:
            'Bạn phải mua game và có game trong Library mới được đánh giá.'
        });
      }

      let review = await Review.findOne({
        maGame: game._id,
        maTaiKhoan: user._id
      });

      if (review) {
        review.rating = rating;
        review.khuyenNghi = recommend;
        review.noiDung = content;
        review.ngayDanhGia = new Date();
        review.an = false;

        await review.save();

      } else {
        review = await Review.create({
          maGame: game._id,
          maTaiKhoan: user._id,
          rating: rating,
          khuyenNghi: recommend,
          noiDung: content,
          ngayDanhGia: new Date(),
          an: false
        });
      }

      await review.populate(
        'maTaiKhoan',
        'tenDangNhap hoTen anhDaiDien'
      );

      return res.status(200).json({
        success: true,
        message: 'Đăng đánh giá thành công',
        data: review
      });

    } catch (error) {
      console.error(
        'Lỗi tạo/cập nhật review:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Không thể đăng đánh giá'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| DELETE /api/store/reviews/:reviewId
|--------------------------------------------------------------------------
| Xóa review của chính tài khoản đang đăng nhập.
|--------------------------------------------------------------------------
*/
router.delete(
  '/reviews/:reviewId',
  authMiddleware,
  async (req, res) => {
    try {
      const { reviewId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          reviewId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: 'Mã review không hợp lệ'
        });
      }

      const review = await Review.findOne({
        _id: reviewId,
        maTaiKhoan: req.user._id
      });

      if (!review) {
        return res.status(404).json({
          success: false,
          message:
            'Không tìm thấy đánh giá của bạn'
        });
      }

      await Review.deleteOne({
        _id: review._id
      });

      return res.json({
        success: true,
        message: 'Đã xóa đánh giá'
      });

    } catch (error) {
      console.error(
        'Lỗi xóa review:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Không thể xóa review'
      });
    }
  }
);


module.exports = router;