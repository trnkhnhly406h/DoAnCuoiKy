const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Lấy danh sách game đã mua của tài khoản đang đăng nhập
router.get('/library/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate(
        'danhSachGameDaMua',
        'maGame tenTroChoi duongDanSlug giaGoc giaHienTai anhBia anhThuNho videoTrailer'
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }

    res.json({
      success: true,
      data: user.danhSachGameDaMua
    });

  } catch (error) {
    console.error('Lỗi lấy Library:', error);

    res.status(500).json({
      success: false,
      message: 'Không thể lấy Library'
    });
  }
});

module.exports = router;