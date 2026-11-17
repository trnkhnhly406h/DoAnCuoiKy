const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Lấy token từ Header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập hoặc thiếu token'
      });
    }

    // Tách chữ "Bearer " ra khỏi token
    const token = authHeader.split(' ')[1];

    // Kiểm tra token
    const decoded = jwt.verify(
  token,
  process.env.JWT_SECRET
      );

      // Không cho phép dùng token xác thực OTP
      // thay thế JWT đăng nhập chính thức
      if (decoded.tokenType === 'admin-2fa') {
        return res.status(401).json({
          success: false,
          message: 'Vui lòng hoàn tất xác thực 2FA'
        });
      }

    // Tìm user trong database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Không tìm thấy tài khoản'
      });
    }

    // Kiểm tra tài khoản có bị khóa không
    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // Lưu user vào request
    req.user = user;

    // Cho phép đi tiếp
    next();

  } catch (error) {
    console.error('Lỗi xác thực:', error);

    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn'
    });
  }
};

module.exports = authMiddleware;