const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { randomInt } = require('crypto');
const router = express.Router();
// Lưu OTP tạm thời trong bộ nhớ Backend
const adminOtpStore = new Map();
const auditLogRoutes = require('./auditLogRoutes');
// =====================================================
// POST /api/store/auth/check-email
// Kiểm tra email đã tồn tại trong MongoDB hay chưa
// =====================================================

router.post('/auth/check-email', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        exists: false,
        message: 'Email không hợp lệ'
      });
    }

    const existingEmail = await User.findOne({
      email
    });

    return res.json({
      success: true,
      exists: !!existingEmail
    });

  } catch (error) {
    console.error('Lỗi kiểm tra email:', error);

    return res.status(500).json({
      success: false,
      exists: false,
      message: 'Không thể kiểm tra email'
    });
  }
});


// =====================================================
// POST /api/store/auth/register
// Đăng ký tài khoản customer
// =====================================================

/**
 * POST /api/store/auth/check-username
 * Kiểm tra tên tài khoản đã tồn tại trong MongoDB.
 */
router.post('/auth/check-username', async (req, res) => {
  try {
    const username = String(
      req.body.tenDangNhap || ''
    ).trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        exists: false,
        message: 'Vui lòng nhập tên tài khoản!'
      });
    }

    // Escape ký tự đặc biệt để tránh sai cú pháp RegExp.
    const escapedUsername = username.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    // Không phân biệt chữ hoa / chữ thường.
    const existingUser = await User.exists({
      tenDangNhap: new RegExp(
        `^${escapedUsername}$`,
        'i'
      )
    });

    return res.json({
      success: true,
      exists: !!existingUser
    });

  } catch (error) {
    console.error('Lỗi kiểm tra tên tài khoản:', error);

    return res.status(500).json({
      success: false,
      exists: false,
      message: 'Không thể kiểm tra tên tài khoản!'
    });
  }
});

router.post('/auth/register', async (req, res) => {
  try {
    const {
      tenDangNhap,
      email,
      matKhau,
      hoTen
    } = req.body;



    // 1. Kiểm tra dữ liệu bắt buộc
    if (!tenDangNhap || !email || !matKhau) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập, email và mật khẩu'
      });
    }

    // 2. Kiểm tra mật khẩu (bắt buộc có chữ hoa)
    const passwordRegex =
      /^(?=.*[A-Z])(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

    if (!passwordRegex.test(String(matKhau))) {
      return res.status(400).json({
        success: false,
        message:
          'Mật khẩu phải có ít nhất 8 ký tự, chữ hoa, chữ cái, số và ký tự đặc biệt!'
      });
    }

    // Chuẩn hóa email
    const normalizedEmail = String(email).trim().toLowerCase();


    // -----------------------------------------------
    // 2. Kiểm tra username đã tồn tại chưa
    // -----------------------------------------------

    
const normalizedUsername = String(tenDangNhap).trim();

const escapedUsername = normalizedUsername.replace(
  /[.*+?^${}()|[\]\\]/g,
  '\\$&'
);

const existingUsername = await User.exists({
  tenDangNhap: new RegExp(
    `^${escapedUsername}$`,
    'i'
  )
});


    if (existingUsername) {
  return res.status(409).json({
    success: false,
    message: 'Tên tài khoản này đã tồn tại. Vui lòng chọn tên khác!'
  });
}


    // -----------------------------------------------
    // 3. Kiểm tra email đã tồn tại chưa
    // -----------------------------------------------

    const existingEmail = await User.findOne({
      email: normalizedEmail
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Email đã tồn tại'
      });
    }


    // -----------------------------------------------
    // 4. Tạo mã tài khoản
    // -----------------------------------------------

    const maTaiKhoan = 'USR-' + Date.now();


    // -----------------------------------------------
    // 5. Hash mật khẩu
    // -----------------------------------------------

    const hashedPassword = await bcrypt.hash(matKhau, 10);


    // -----------------------------------------------
    // 6. Tạo user mới
    // -----------------------------------------------

    const user = new User({
      maTaiKhoan,
tenDangNhap: normalizedUsername,
      email: normalizedEmail,
      hoTen: hoTen || '',
      matKhau: hashedPassword,
      vaiTro: 'customer',
      quyen: [],
      viTien: 0,
      biKhoa: false,
      ngayDangKy: new Date()
    });


    // -----------------------------------------------
    // 7. Lưu vào MongoDB
    // -----------------------------------------------

    await user.save();


    console.log('ĐĂNG KÝ USER THÀNH CÔNG:', {
      maTaiKhoan: user.maTaiKhoan,
      tenDangNhap: user.tenDangNhap,
      email: user.email
    });


    // -----------------------------------------------
    // 8. Trả kết quả
    // Không trả matKhau về frontend
    // -----------------------------------------------

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        maTaiKhoan: user.maTaiKhoan,
        tenDangNhap: user.tenDangNhap,
        email: user.email,
        hoTen: user.hoTen,
        vaiTro: user.vaiTro
      }
    });

  } catch (error) {

    console.error('Lỗi đăng ký:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể đăng ký tài khoản'
    });
  }
});


// =====================================================
// POST /api/store/auth/login
// Đăng nhập
// =====================================================

router.post('/auth/login', async (req, res) => {
  try {

    const {
      tenDangNhap,
      matKhau
    } = req.body;


    // -----------------------------------------------
    // 1. Kiểm tra dữ liệu
    // -----------------------------------------------

    if (!tenDangNhap || !matKhau) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu'
      });
    }


    // -----------------------------------------------
    // 2. Tìm user
    // -----------------------------------------------

    const user = await User.findOne({
      tenDangNhap
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }


    // -----------------------------------------------
    // 3. Kiểm tra tài khoản bị khóa
    // -----------------------------------------------

    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: user.yeuCauXoaTaiKhoan
          ? 'Tài khoản đang chờ xóa theo yêu cầu. Vui lòng liên hệ hỗ trợ qua email trước hạn để được Admin xem xét mở khóa.'
          : 'Tài khoản đã bị khóa'
      });
    }


    // -----------------------------------------------
    // 4. So sánh mật khẩu
    // -----------------------------------------------

    const isPasswordCorrect = await bcrypt.compare(
      matKhau,
      user.matKhau
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Tên đăng nhập hoặc mật khẩu không đúng'
      });
    }


    // -----------------------------------------------
    // 5. Tạo JWT
    // -----------------------------------------------

    const token = jwt.sign(
      {
        userId: user._id,
        maTaiKhoan: user.maTaiKhoan,
        vaiTro: user.vaiTro
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );


    // -----------------------------------------------
    // 6. Trả kết quả
    // -----------------------------------------------

    return res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      data: {
        maTaiKhoan: user.maTaiKhoan,
        tenDangNhap: user.tenDangNhap,
        email: user.email,
        hoTen: user.hoTen,
        anhDaiDien: user.anhDaiDien,
        vaiTro: user.vaiTro,
        quyen: user.quyen,
        viTien: user.viTien
      }
    });

  } catch (error) {

    console.error('Lỗi đăng nhập:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể đăng nhập'
    });
  }
});

// =====================================================
// POST /api/store/auth/admin/login
// Đăng nhập Admin (Bước 1)
// =====================================================

router.post('/auth/admin/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const matKhau = String(req.body.matKhau || '');

    // 1. Kiểm tra dữ liệu
    if (!email || !matKhau) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu'
      });
    }

    // 2. Tìm tài khoản Admin
    const user = await User.findOne({
      email,
      vaiTro: 'admin'
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    // 3. Kiểm tra tài khoản bị khóa
    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản Admin đã bị khóa'
      });
    }

    // 4. Kiểm tra mật khẩu
    const isPasswordCorrect = await bcrypt.compare(
      matKhau,
      user.matKhau
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng'
      });
    }

    // 5. Nếu Admin bật 2FA
    if (user.xacThuc2FA) {
      const userKey = String(user._id);

      // Xóa OTP cũ nếu còn tồn tại trong bộ nhớ
      if (adminOtpStore.has(userKey)) {
        adminOtpStore.delete(userKey);
      }

      // Tạo duy nhất 1 OTP ngẫu nhiên gồm 6 chữ số
      const otp = String(randomInt(100000, 1000000));
      const expiresAt = Date.now() + 5 * 60 * 1000;

      // Lưu lại OTP mới nhất
      adminOtpStore.set(userKey, {
        otp,
        expiresAt,
        attempts: 0
      });

      // Tạo token tạm thời phục vụ xác thực OTP (thời hạn 5 phút)
      const secret = process.env.JWT_SECRET || 'STEAL_SECRET_KEY_2026';
      const otpToken = jwt.sign(
        {
          userId: user._id,
          tokenType: 'admin-2fa'
        },
        secret,
        { expiresIn: '5m' }
      );

      console.log('================================');
      console.log('MÃ OTP ADMIN MỚI NHẤT:', otp);
      console.log('EMAIL:', user.email);
      console.log('================================');

      return res.json({
        success: true,
        requires2FA: true,
        message: 'Vui lòng nhập mã OTP',
        otpToken
      });
    }

    // 6. Nếu không bật 2FA thì cấp JWT chính thức luôn
    const secret = process.env.JWT_SECRET || 'STEAL_SECRET_KEY_2026';
    const token = jwt.sign(
      {
        userId: user._id,
        maTaiKhoan: user.maTaiKhoan,
        vaiTro: user.vaiTro
      },
      secret,
      {
        expiresIn: '1d'
      }
    );

    auditLogRoutes.recordLog({
      tenTaiKhoan: user.tenDangNhap,
      vaiTro: 'admin',
      hanhDong: 'ĐĂNG NHẬP ADMIN',
      chiTiet: 'Đăng nhập thành công vào hệ thống Quản trị',
      req
    });

    return res.json({
      success: true,
      requires2FA: false,
      message: 'Đăng nhập Admin thành công',
      token,
      data: {
        maTaiKhoan: user.maTaiKhoan,
        tenDangNhap: user.tenDangNhap,
        email: user.email,
        hoTen: user.hoTen,
        anhDaiDien: user.anhDaiDien,
        vaiTro: user.vaiTro,
        quyen: user.quyen
      }
    });

  } catch (error) {
    console.error('Lỗi đăng nhập Admin:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể đăng nhập Admin'
    });
  }
});

// =====================================================
// POST /api/store/auth/admin/verify-otp
// Xác minh OTP và cấp JWT chính thức (Bước 2)
// =====================================================

// =====================================================
// POST /api/store/auth/admin/verify-otp
// Xác minh OTP và cấp JWT chính thức (Bước 2)
// =====================================================

router.post('/auth/admin/verify-otp', async (req, res) => {
  try {
    const otp = String(req.body.otp || '').trim();
    const otpToken = String(req.body.otpToken || '').trim();

    // 1. Kiểm tra dữ liệu đầu vào
    if (!otpToken || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mã OTP gồm 6 chữ số'
      });
    }

    // 2. Xác minh token tạm
    const secret = process.env.JWT_SECRET || 'STEAL_SECRET_KEY_2026';
    let decoded;
    try {
      decoded = jwt.verify(otpToken, secret);
    } catch (jwtErr) {
      console.error('Lỗi giải mã otpToken:', jwtErr.message);
      return res.status(401).json({
        success: false,
        message: 'Mã xác thực phiên đã hết hạn. Vui lòng đăng nhập lại!'
      });
    }

    if (decoded.tokenType !== 'admin-2fa') {
      return res.status(401).json({
        success: false,
        message: 'Token xác thực không hợp lệ'
      });
    }

    const userId = String(decoded.userId);

    // 3. Lấy dữ liệu OTP đã lưu
    const otpData = adminOtpStore.get(userId);

    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng đăng nhập lại!'
      });
    }

    // 4. Kiểm tra thời hạn OTP
    if (Date.now() > otpData.expiresAt) {
      adminOtpStore.delete(userId);
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn. Vui lòng đăng nhập lại'
      });
    }

    // 5. Giới hạn số lần thử
    if (otpData.attempts >= 5) {
      adminOtpStore.delete(userId);
      return res.status(429).json({
        success: false,
        message: 'Bạn đã nhập sai OTP quá 5 lần. Vui lòng đăng nhập lại!'
      });
    }

    if (otp !== String(otpData.otp).trim()) {
      otpData.attempts += 1;
      const attemptsLeft = Math.max(0, 5 - otpData.attempts);

      if (otpData.attempts >= 5) {
        adminOtpStore.delete(userId);
      }

      return res.status(400).json({
        success: false,
        message: `Mã OTP không chính xác (còn ${attemptsLeft} lần thử)`,
        attemptsLeft
      });
    }

    // 6. Kiểm tra tài khoản Admin trong Database
    const user = await User.findById(userId);

    if (!user || user.vaiTro !== 'admin' || user.biKhoa) {
      adminOtpStore.delete(userId);
      return res.status(403).json({
        success: false,
        message: 'Tài khoản Admin không hợp lệ hoặc đã bị khóa'
      });
    }

    // 7. Xóa OTP sau khi dùng thành công
    adminOtpStore.delete(userId);

    // 8. Cấp JWT chính thức
    const token = jwt.sign(
      {
        userId: user._id,
        maTaiKhoan: user.maTaiKhoan,
        vaiTro: user.vaiTro
      },
      secret,
      {
        expiresIn: '1d'
      }
    );

    // Ghi audit log an toàn trong try/catch nội bộ
    try {
      if (auditLogRoutes && typeof auditLogRoutes.recordLog === 'function') {
        await auditLogRoutes.recordLog({
          tenTaiKhoan: user.tenDangNhap,
          vaiTro: 'admin',
          hanhDong: 'ĐĂNG NHẬP ADMIN',
          chiTiet: 'Đăng nhập thành công với 2FA OTP vào hệ thống Quản trị',
          req
        });
      }
    } catch (logErr) {
      console.warn('Lỗi ghi audit log đăng nhập (được bỏ qua):', logErr.message);
    }

    return res.json({
      success: true,
      message: 'Xác thực Admin thành công',
      token,
      data: {
        maTaiKhoan: user.maTaiKhoan,
        tenDangNhap: user.tenDangNhap,
        email: user.email,
        hoTen: user.hoTen,
        anhDaiDien: user.anhDaiDien,
        vaiTro: user.vaiTro,
        quyen: user.quyen
      }
    });

  } catch (error) {
    console.error('Lỗi xác minh OTP Admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xác minh OTP'
    });
  }
});
// =====================================================
// GET /api/store/auth/me
// Lấy thông tin user đang đăng nhập
// =====================================================

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
router.get('/auth/me', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: {
      maTaiKhoan: req.user.maTaiKhoan,
      tenDangNhap: req.user.tenDangNhap,
      email: req.user.email,
      hoTen: req.user.hoTen,
      anhDaiDien: req.user.anhDaiDien,
      vaiTro: req.user.vaiTro,
      quyen: req.user.quyen,
      viTien: req.user.viTien
    }
  });
});

router.post('/auth/recovery/check', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email chưa được đăng ký tài khoản'
      });
    }

    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    return res.json({
      success: true,
      message: 'Email đã được đăng ký',
      data: {
        maTaiKhoan: user.maTaiKhoan,
        tenDangNhap: user.tenDangNhap,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Lỗi kiểm tra email khôi phục:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể kiểm tra email'
    });
  }
});
// =====================================================
// POST /api/store/auth/recovery/reset-password
// Cập nhật mật khẩu mới cho tài khoản
// =====================================================

router.post('/auth/recovery/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const matKhauMoi = String(req.body.matKhauMoi || '');

    // -----------------------------------------------
    // 1. Kiểm tra dữ liệu
    // -----------------------------------------------

    if (!email || !matKhauMoi) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email và mật khẩu mới'
      });
    }

    // -----------------------------------------------
    // 2. Kiểm tra mật khẩu
    // -----------------------------------------------

    

if (
  matKhauMoi.length < 8 ||
  !/[a-zA-Z]/.test(matKhauMoi) ||
  !/\d/.test(matKhauMoi) ||
  !/[^a-zA-Z0-9]/.test(matKhauMoi) ||
  !/[A-Z]/.test(matKhauMoi)
) {
  return res.status(400).json({
    success: false,
    message:
      'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ cái, số và ký tự đặc biệt!'
  });
}


    // -----------------------------------------------
    // 3. Tìm tài khoản theo email
    // -----------------------------------------------

    const user = await User.findOne({
      email
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy email để cập nhật mật khẩu'
      });
    }

    // -----------------------------------------------
    // 4. Kiểm tra tài khoản bị khóa
    // -----------------------------------------------

    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khóa'
      });
    }

    // -----------------------------------------------
    // 5. Hash mật khẩu mới
    // -----------------------------------------------

    user.matKhau = await bcrypt.hash(matKhauMoi, 10);

    // -----------------------------------------------
    // 6. Lưu vào MongoDB
    // -----------------------------------------------

    await user.save();

    console.log('KHÔI PHỤC MẬT KHẨU THÀNH CÔNG:', {
      maTaiKhoan: user.maTaiKhoan,
      tenDangNhap: user.tenDangNhap,
      email: user.email
    });

    // -----------------------------------------------
    // 7. Trả kết quả
    // -----------------------------------------------

    return res.json({
      success: true,
      message: 'Đã cập nhật mật khẩu.'
    });

  } catch (error) {
    console.error('Lỗi khôi phục mật khẩu:', error);

    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật mật khẩu'
    });
  }
});
// =====================================================
// GET /api/store/auth/admin-test
// Test quyền Admin
// =====================================================

router.get(
  '/auth/admin-test',
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    res.json({
      success: true,
      message: 'Bạn là Admin và có quyền truy cập API này',
      data: {
        maTaiKhoan: req.user.maTaiKhoan,
        tenDangNhap: req.user.tenDangNhap,
        vaiTro: req.user.vaiTro
      }
    });
  }
);

// =====================================================
// POST /api/store/auth/admin/recovery/check
// Kiểm tra quyền khôi phục mật khẩu Admin (Chỉ Super Admin)
// =====================================================

router.post('/auth/admin/recovery/check', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập email quản trị!'
      });
    }

    const user = await User.findOne({
      email,
      vaiTro: 'admin'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản Quản trị với email này!'
      });
    }

    if (user.biKhoa) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản Quản trị này đang bị khóa. Vui lòng liên hệ hỗ trợ!'
      });
    }

    // Kiểm tra vai trò: Phân biệt Super Admin vs Staff / Editor
    const roleLabel = Array.isArray(user.quyen) && user.quyen.length > 0 ? String(user.quyen[0]).toUpperCase() : '';
    const username = String(user.tenDangNhap || '').toLowerCase();
    const emailStr = String(user.email || '').toLowerCase();

    const isEditor = roleLabel.includes('EDITOR') || roleLabel.includes('BIÊN TẬP') || username === 'adminphu' || username.includes('editor') || emailStr.includes('editor');
    const isStaff = roleLabel.includes('STAFF') || roleLabel.includes('NHÂN VIÊN') || username === 'staffadmin' || username.includes('staff') || emailStr.includes('staff');

    // NẾU LÀ STAFF HOẶC EDITOR -> TỪ CHỐI VÀ YÊU CẦU LIÊN HỆ SUPER ADMIN
    if (isEditor || isStaff) {
      const roleName = isEditor ? 'Editor (Biên tập viên)' : 'Staff (Nhân viên vận hành)';
      return res.status(403).json({
        success: false,
        isSuperAdmin: false,
        role: roleName,
        message: 'Tài khoản của bạn thuộc quyền ' + roleName + '. Theo quy định bảo mật, chỉ Quản trị viên trưởng (Super Admin) mới được phép tự khôi phục mật khẩu. Vui lòng liên hệ Super Admin để được cấp lại mật khẩu!'
      });
    }

    // NẾU LÀ SUPER ADMIN -> CẤP MÃ OTP KHÔI PHỤC
    const otp = String(randomInt(100000, 1000000));
    const expiresAt = Date.now() + 5 * 60 * 1000;

    adminOtpStore.set('recovery_' + user._id, {
      otp,
      expiresAt,
      attempts: 0
    });

    const recoveryToken = jwt.sign(
      {
        userId: user._id,
        tokenType: 'admin-recovery'
      },
      process.env.JWT_SECRET || 'STEAL_SECRET_KEY_2026',
      { expiresIn: '15m' }
    );

    console.log('==================================================');
    console.log('MÃ OTP KHÔI PHỤC MẬT KHẨU SUPER ADMIN:', otp);
    console.log('EMAIL SUPER ADMIN:', user.email);
    console.log('==================================================');

    return res.json({
      success: true,
      isSuperAdmin: true,
      role: 'Super Admin',
      message: 'Xác thực Super Admin thành công! Mã OTP đã được gửi về email của bạn.',
      recoveryToken
    });

  } catch (error) {
    console.error('Lỗi kiểm tra quyền khôi phục Admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi kiểm tra quyền khôi phục'
    });
  }
});

// =====================================================
// POST /api/store/auth/admin/recovery/reset-password
// Cập nhật mật khẩu mới cho Super Admin
// =====================================================

router.post('/auth/admin/recovery/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const matKhauMoi = String(req.body.matKhauMoi || req.body.newPassword || '');

    if (!email || !otp || !matKhauMoi) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ email, mã OTP và mật khẩu mới'
      });
    }

    if (
      matKhauMoi.length < 8 ||
      !/[a-zA-Z]/.test(matKhauMoi) ||
      !/\d/.test(matKhauMoi) ||
      !/[^a-zA-Z0-9]/.test(matKhauMoi)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ cái, chữ số và ký tự đặc biệt!'
      });
    }

    const user = await User.findOne({
      email,
      vaiTro: 'admin'
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản Quản trị với email này'
      });
    }

    // Kiểm tra quyền Super Admin
    const roleLabel = Array.isArray(user.quyen) && user.quyen.length > 0 ? String(user.quyen[0]).toUpperCase() : '';
    const username = String(user.tenDangNhap || '').toLowerCase();
    const emailStr = String(user.email || '').toLowerCase();

    if (
      roleLabel.includes('EDITOR') || roleLabel.includes('STAFF') ||
      username === 'adminphu' || username === 'staffadmin' ||
      emailStr.includes('editor') || emailStr.includes('staff')
    ) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Super Admin mới có quyền đặt lại mật khẩu!'
      });
    }

    // Kiểm tra mã OTP
    const otpData = adminOtpStore.get('recovery_' + user._id);
    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không tồn tại hoặc đã hết hạn. Vui lòng bấm gửi lại mã!'
      });
    }

    if (Date.now() > otpData.expiresAt) {
      adminOtpStore.delete('recovery_' + user._id);
      return res.status(400).json({
        success: false,
        message: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới!'
      });
    }

    if (otp !== String(otpData.otp).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Mã OTP không chính xác!'
      });
    }

    // Xóa OTP sau khi sử dụng
    adminOtpStore.delete('recovery_' + user._id);

    // Cập nhật mật khẩu mới
    user.matKhau = await bcrypt.hash(matKhauMoi, 10);
    await user.save();

    // Ghi nhật ký kiểm vết
    try {
      if (auditLogRoutes && typeof auditLogRoutes.recordLog === 'function') {
        auditLogRoutes.recordLog({
          tenTaiKhoan: user.tenDangNhap,
          vaiTro: 'Super Admin',
          hanhDong: 'KHÔI PHỤC MẬT KHẨU SUPER ADMIN',
          chiTiet: 'Super Admin đã đặt lại mật khẩu mới thành công qua email ' + user.email,
          req
        });
      }
    } catch (e) {
      console.warn('Lỗi ghi log khôi phục mật khẩu:', e.message);
    }

    return res.json({
      success: true,
      message: 'Đặt lại mật khẩu Super Admin thành công! Vui lòng đăng nhập lại với mật khẩu mới.'
    });

  } catch (error) {
    console.error('Lỗi đặt lại mật khẩu Admin:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật mật khẩu mới'
    });
  }
});
module.exports = router;