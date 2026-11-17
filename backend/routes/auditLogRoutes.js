const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// ==================================================
// HÀM HELPER: GHI NHẬT KÝ TỰ ĐỘNG CHO CÁC ROUTES KHÁC
// ==================================================
const recordLog = async ({ tenTaiKhoan, vaiTro, hanhDong, chiTiet, req }) => {
  try {
    if (req) {
      req._auditLogged = true;
    }
    const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
    await AuditLog.create({
      tenTaiKhoan: tenTaiKhoan || 'Hệ thống',
      vaiTro: vaiTro || 'admin',
      hanhDong: hanhDong || 'THAO TÁC ADMIN',
      chiTiet: chiTiet || '',
      phuongThuc: req?.method || 'POST',
      duongDan: req?.originalUrl || '',
      diaChiIp: String(ip).replace('::ffff:', '')
    });
  } catch (err) {
    console.error('Lỗi khi ghi audit log tự động:', err.message);
  }
};

// ==================================================
// 1. ADMIN: LẤY DANH SÁCH NHẬT KÝ KIỂM VẾT
// GET /api/store/admin/audit-logs
// (Tự động loại bỏ các log GET cũ chỉ đọc dữ liệu, chỉ hiển thị các thao tác có thay đổi dữ liệu)
// ==================================================
router.get('/admin/audit-logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { q, limit = 100 } = req.query;

    // Mặc định loại bỏ các bản ghi GET cũ từng lưu trong DB để bảng kiểm vết gọn sạch
    const filter = {
      phuongThuc: { $ne: 'GET' }
    };

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [
        { tenTaiKhoan: regex },
        { hanhDong: regex },
        { chiTiet: regex },
        { phuongThuc: regex }
      ];
    }

    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(500, Number(limit) || 100))
      .lean();

    const formatted = logs.map(l => ({
      id: String(l._id),
      tenTaiKhoan: l.tenTaiKhoan,
      vaiTro: l.vaiTro,
      hanhDong: l.hanhDong,
      chiTiet: l.chiTiet,
      phuongThuc: l.phuongThuc || 'POST',
      duongDan: l.duongDan,
      diaChiIp: l.diaChiIp,
      thoiGian: new Date(l.createdAt).toLocaleString('vi-VN')
    }));

    return res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Lỗi lấy audit logs:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy dữ liệu nhật ký kiểm vết'
    });
  }
});

// ==================================================
// 2. ADMIN: GHI NHẬT KÝ KIỂM VẾT THAO TÁC THỦ CÔNG
// POST /api/store/admin/audit-logs
// ==================================================
router.post('/admin/audit-logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    req._auditLogged = true;
    const { hanhDong, chiTiet } = req.body;
    const tenTaiKhoan = req.user?.tenDangNhap || req.user?.maTaiKhoan || 'Admin';
    const vaiTro = req.user?.vaiTro || 'admin';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

    const newLog = await AuditLog.create({
      tenTaiKhoan,
      vaiTro,
      hanhDong: hanhDong || 'THAO TÁC ADMIN',
      chiTiet: chiTiet || '',
      phuongThuc: req.method,
      duongDan: req.originalUrl,
      diaChiIp: String(ip).replace('::ffff:', '')
    });

    return res.status(201).json({
      success: true,
      data: newLog
    });
  } catch (error) {
    console.error('Lỗi lưu audit log:', error);
    return res.status(500).json({ success: false });
  }
});

router.recordLog = recordLog;
module.exports = router;
module.exports.recordLog = recordLog;