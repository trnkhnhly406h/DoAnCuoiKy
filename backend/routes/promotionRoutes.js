const express = require('express');
const mongoose = require('mongoose');

const Promotion = require('../models/Promotion');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// ========================================
// PHÂN QUYỀN ADMIN
// Tất cả API quản lý khuyến mãi đều cần đăng nhập Admin
// ========================================

router.use(
  '/promotions',
  authMiddleware,
  adminMiddleware
);


// ========================================
// HÀM HỖ TRỢ
// ========================================

// Kiểm tra và chuyển đổi ngày
function parseDate(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// Kiểm tra và chuyển đổi boolean
function parseBoolean(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return null;
}

// Kiểm tra dữ liệu khuyến mãi
function validatePromotion(data) {
  const maKhuyenMai = String(data.maKhuyenMai || '')
    .trim()
    .toUpperCase();

  const moTa = String(data.moTa || '').trim();

  const phanTramGiamGia = Number(data.phanTramGiamGia);

  const ngayBatDau = parseDate(data.ngayBatDau);

  const ngayKetThuc =
    data.ngayKetThuc === null ||
    data.ngayKetThuc === undefined ||
    data.ngayKetThuc === ''
      ? null
      : parseDate(data.ngayKetThuc);

  const trangThai = parseBoolean(data.trangThai, true);

  const chiApDungLanDau = parseBoolean(
    data.chiApDungLanDau,
    false
  );

  if (!maKhuyenMai) {
    return {
      error: 'Vui lòng nhập mã khuyến mãi'
    };
  }

  if (
    !Number.isFinite(phanTramGiamGia) ||
    phanTramGiamGia < 1 ||
    phanTramGiamGia > 100
  ) {
    return {
      error: 'Phần trăm giảm giá phải từ 1 đến 100'
    };
  }

  if (!ngayBatDau) {
    return {
      error: 'Ngày bắt đầu không hợp lệ'
    };
  }

  if (
    data.ngayKetThuc &&
    !ngayKetThuc
  ) {
    return {
      error: 'Ngày kết thúc không hợp lệ'
    };
  }

  if (
    ngayKetThuc &&
    ngayKetThuc < ngayBatDau
  ) {
    return {
      error: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'
    };
  }

  if (trangThai === null) {
    return {
      error: 'Trạng thái khuyến mãi không hợp lệ'
    };
  }

  if (chiApDungLanDau === null) {
    return {
      error: 'Điều kiện áp dụng lần đầu không hợp lệ'
    };
  }

  return {
    data: {
      maKhuyenMai,
      moTa,
      phanTramGiamGia,
      ngayBatDau,
      ngayKetThuc,
      trangThai,
      chiApDungLanDau
    }
  };
}


// ========================================
// 1. LẤY DANH SÁCH KHUYẾN MÃI
// GET /api/store/promotions
// ========================================

router.get('/promotions', async (req, res) => {
  try {
    const promotions = await Promotion.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      message: 'Lấy danh sách khuyến mãi thành công',
      data: promotions
    });

  } catch (error) {
    console.error('Lỗi lấy danh sách khuyến mãi:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách khuyến mãi'
    });
  }
});


// ========================================
// 2. XEM CHI TIẾT KHUYẾN MÃI
// GET /api/store/promotions/:id
// ========================================

router.get('/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID khuyến mãi không hợp lệ'
      });
    }

    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy mã khuyến mãi'
      });
    }

    return res.json({
      success: true,
      message: 'Lấy chi tiết khuyến mãi thành công',
      data: promotion
    });

  } catch (error) {
    console.error('Lỗi xem chi tiết khuyến mãi:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy chi tiết khuyến mãi'
    });
  }
});


// ========================================
// 3. THÊM MÃ KHUYẾN MÃI
// POST /api/store/promotions
// ========================================

router.post('/promotions', async (req, res) => {
  try {
    const validation = validatePromotion(req.body);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    const promotion = new Promotion({
      ...validation.data,
      daSuDung: 0
    });

    await promotion.save();

    return res.status(201).json({
      success: true,
      message: 'Thêm mã khuyến mãi thành công',
      data: promotion
    });

  } catch (error) {
    console.error('Lỗi thêm khuyến mãi:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Mã khuyến mãi đã tồn tại'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Không thể thêm mã khuyến mãi',
      error: error.message
    });
  }
});


// ========================================
// 4. CẬP NHẬT MÃ KHUYẾN MÃI
// PUT /api/store/promotions/:id
// ========================================

router.put('/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID khuyến mãi không hợp lệ'
      });
    }

    const promotion = await Promotion.findById(id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy mã khuyến mãi'
      });
    }

    // Chỉ cập nhật những trường được gửi lên.
    const duLieuCapNhat = {
      maKhuyenMai:
        req.body.maKhuyenMai !== undefined
          ? req.body.maKhuyenMai
          : promotion.maKhuyenMai,

      moTa:
        req.body.moTa !== undefined
          ? req.body.moTa
          : promotion.moTa,

      phanTramGiamGia:
        req.body.phanTramGiamGia !== undefined
          ? req.body.phanTramGiamGia
          : promotion.phanTramGiamGia,

      ngayBatDau:
        req.body.ngayBatDau !== undefined
          ? req.body.ngayBatDau
          : promotion.ngayBatDau,

      ngayKetThuc:
        req.body.ngayKetThuc !== undefined
          ? req.body.ngayKetThuc
          : promotion.ngayKetThuc,

      trangThai:
        req.body.trangThai !== undefined
          ? req.body.trangThai
          : promotion.trangThai,

      chiApDungLanDau:
        req.body.chiApDungLanDau !== undefined
          ? req.body.chiApDungLanDau
          : promotion.chiApDungLanDau
    };

    const validation = validatePromotion(duLieuCapNhat);

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    Object.assign(promotion, validation.data);

    await promotion.save();

    return res.json({
      success: true,
      message: 'Cập nhật mã khuyến mãi thành công',
      data: promotion
    });

  } catch (error) {
    console.error('Lỗi cập nhật khuyến mãi:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Mã khuyến mãi đã tồn tại'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật mã khuyến mãi',
      error: error.message
    });
  }
});


// ========================================
// 5. BẬT / TẮT MÃ KHUYẾN MÃI
// PATCH /api/store/promotions/:id/status
// ========================================

router.patch('/promotions/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID khuyến mãi không hợp lệ'
      });
    }

    const trangThai = parseBoolean(req.body.trangThai, null);

    if (trangThai === null) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp trạng thái hợp lệ'
      });
    }

    const promotion = await Promotion.findByIdAndUpdate(
      id,
      { trangThai },
      {
        new: true,
        runValidators: true
      }
    );

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy mã khuyến mãi'
      });
    }

    return res.json({
      success: true,
      message: trangThai
        ? 'Đã kích hoạt mã khuyến mãi'
        : 'Đã tắt mã khuyến mãi',
      data: promotion
    });

  } catch (error) {
    console.error('Lỗi thay đổi trạng thái khuyến mãi:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể thay đổi trạng thái khuyến mãi'
    });
  }
});


// ========================================
// 6. XÓA MÃ KHUYẾN MÃI
// DELETE /api/store/promotions/:id
// ========================================

router.delete('/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID khuyến mãi không hợp lệ'
      });
    }

    const promotion = await Promotion.findByIdAndDelete(id);

    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy mã khuyến mãi'
      });
    }

    return res.json({
      success: true,
      message: 'Xóa mã khuyến mãi thành công',
      data: {
        _id: promotion._id,
        maKhuyenMai: promotion.maKhuyenMai
      }
    });

  } catch (error) {
    console.error('Lỗi xóa khuyến mãi:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể xóa mã khuyến mãi'
    });
  }
});


module.exports = router;