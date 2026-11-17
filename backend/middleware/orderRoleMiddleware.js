
const orderRoleMiddleware = (req, res, next) => {

  // 1. Bắt buộc đăng nhập bằng tài khoản Admin
  if (!req.user || req.user.vaiTro !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền quản trị'
    });
  }

  // 2. Lấy thông tin tài khoản từ MongoDB
  const user = req.user;

  const username = String(
    user.tenDangNhap || ''
  ).trim().toLowerCase();

  const quyen = (
    Array.isArray(user.quyen)
      ? user.quyen
      : [user.quyen]
  )
    .filter(Boolean)
    .map(role =>
      String(role).trim().toUpperCase()
    );

  // 3. Editor tuyệt đối không được quản lý
  // đơn hàng hoặc yêu cầu hoàn tiền
  const isEditor = quyen.some(role =>
    role.includes('EDITOR') ||
    role.includes('BIÊN TẬP')
  );

  if (isEditor) {
    return res.status(403).json({
      success: false,
      message:
        'Editor không có quyền quản lý đơn hàng và hoàn tiền'
    });
  }

  // 4. Kiểm tra quyền được gán trong MongoDB
  const hasOrderPermission = quyen.some(role =>
    [
      'SUPER ADMIN',
      'SUPER_ADMIN',
      'SUPERADMIN',
      'STAFF'
    ].includes(role)
  );

  // 5. Hỗ trợ tài khoản Admin cũ chưa có quyen
  // Chỉ áp dụng cho những tài khoản được xác định
  // từ dữ liệu Admin gốc của dự án STEAL
  const legacyAuthorizedAccounts = new Set([
    'admin01',
    'admin_master',
    'backup_admin',
    'staff_phuong',
    'staffadmin'
  ]);

  const isLegacyAuthorized =
    quyen.length === 0 &&
    legacyAuthorizedAccounts.has(username);

  // 6. Chỉ cho phép tài khoản có quyền hợp lệ
  if (!hasOrderPermission && !isLegacyAuthorized) {
    return res.status(403).json({
      success: false,
      message:
        'Bạn không có quyền quản lý đơn hàng và hoàn tiền'
    });
  }

  // 7. Cho phép tiếp tục xử lý API
  next();
};

module.exports = orderRoleMiddleware;
