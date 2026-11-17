
const express = require('express');
const Category = require('../models/Category');
const Game = require('../models/Game');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// =====================================================
// 1. GET /api/store/categories
// Lấy danh sách thể loại (Customer và Admin)
// =====================================================
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ tenTheLoai: 1 });

    return res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách thể loại:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách thể loại'
    });
  }
});

// =====================================================
// 2. POST /api/store/admin/categories
// Thêm nhóm thể loại
// =====================================================
router.post(
  '/admin/categories',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { maTheLoai, tenTheLoai, moTa = '' } = req.body;

      if (
        !maTheLoai ||
        !tenTheLoai ||
        !String(maTheLoai).trim() ||
        !String(tenTheLoai).trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mã nhóm và tên nhóm'
        });
      }

      const ma = String(maTheLoai).trim().toLowerCase();
      const ten = String(tenTheLoai).trim();

      const daTonTai = await Category.findOne({
        $or: [
          { maTheLoai: ma },
          { tenTheLoai: ten }
        ]
      });

      if (daTonTai) {
        return res.status(400).json({
          success: false,
          message: 'Mã nhóm hoặc tên nhóm đã tồn tại'
        });
      }

      const category = await Category.create({
        maTheLoai: ma,
        tenTheLoai: ten,
        moTa: String(moTa).trim()
      });

      return res.status(201).json({
        success: true,
        message: 'Thêm nhóm sản phẩm thành công',
        data: category
      });
    } catch (error) {
      console.error('Lỗi thêm nhóm thể loại:', error);

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Mã nhóm đã tồn tại'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Không thể thêm nhóm sản phẩm'
      });
    }
  }
);

// =====================================================
// 3. PUT /api/store/admin/categories/:id
// Cập nhật tên và mô tả nhóm
// maTheLoai được giữ cố định để tránh sai liên kết game.
// =====================================================
router.put(
  '/admin/categories/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { tenTheLoai, moTa } = req.body;

      const category = await Category.findById(req.params.id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhóm sản phẩm'
        });
      }

      if (
        tenTheLoai === undefined ||
        !String(tenTheLoai).trim()
      ) {
        return res.status(400).json({
          success: false,
          message: 'Tên nhóm không được để trống'
        });
      }

      const tenMoi = String(tenTheLoai).trim();
      const tenCu = category.tenTheLoai;

      const trungTen = await Category.findOne({
        _id: { $ne: category._id },
        tenTheLoai: tenMoi
      });

      if (trungTen) {
        return res.status(400).json({
          success: false,
          message: 'Tên nhóm đã tồn tại'
        });
      }

      // Nếu đổi tên nhóm, cập nhật tên thể loại trong các game liên quan.
      if (tenMoi !== tenCu) {
        await Game.updateMany(
          { maTheLoai: category.maTheLoai },
          { $set: { 'tenTheLoai.$[item]': tenMoi } },
          {
            arrayFilters: [{ item: tenCu }]
          }
        );
      }

      category.tenTheLoai = tenMoi;

      if (moTa !== undefined) {
        category.moTa = String(moTa).trim();
      }

      await category.save();

      return res.json({
        success: true,
        message: 'Cập nhật nhóm sản phẩm thành công',
        data: category
      });
    } catch (error) {
      console.error('Lỗi cập nhật nhóm thể loại:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể cập nhật nhóm sản phẩm'
      });
    }
  }
);

// =====================================================
// 4. DELETE /api/store/admin/categories/:id
// Xóa nhóm và gỡ liên kết khỏi các game
// =====================================================
router.delete(
  '/admin/categories/:id',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy nhóm sản phẩm'
        });
      }

      // Gỡ mã nhóm khỏi tất cả game đang thuộc nhóm.
      await Game.updateMany(
        { maTheLoai: category.maTheLoai },
        {
          $pull: {
            maTheLoai: category.maTheLoai,
            tenTheLoai: category.tenTheLoai
          }
        }
      );

      await Category.findByIdAndDelete(category._id);

      return res.json({
        success: true,
        message: 'Xóa nhóm sản phẩm thành công'
      });
    } catch (error) {
      console.error('Lỗi xóa nhóm thể loại:', error);

      return res.status(500).json({
        success: false,
        message: 'Không thể xóa nhóm sản phẩm'
      });
    }
  }
);

module.exports = router;
