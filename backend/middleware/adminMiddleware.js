const AuditLog = require('../models/AuditLog');

// Hàm tự động phân tích và tạo mô tả hành động từ Request có thay đổi dữ liệu (POST, PUT, PATCH, DELETE)
function phanTichHanhDong(req) {
  const method = req.method.toUpperCase();
  const url = req.originalUrl || req.url || '';
  const body = req.body || {};
  const params = req.params || {};

  // 1. Quản lý Game / Trò chơi
  if (url.includes('/games') || url.includes('/admin/games')) {
    if (url.includes('/status') && (method === 'PATCH' || method === 'PUT')) {
      const id = params.id || url.split('/')[4] || '';
      const trangThai = body.trangThaiBan ? 'HIỂN THỊ (Mở bán)' : 'ẨN (Ngừng bán)';
      return {
        hanhDong: 'ẨN/HIỆN TRÒ CHƠI',
        chiTiet: `Chuyển trạng thái sang ${trangThai} cho game ID: ${id}`
      };
    }
    if (method === 'POST') {
      const ten = body.tenTroChoi || body.tenGame || body.maGame || '';
      return {
        hanhDong: 'THÊM TRÒ CHƠI',
        chiTiet: ten ? `Thêm trò chơi mới "${ten}"` : 'Thêm trò chơi mới vào hệ thống'
      };
    }
    if (method === 'PUT' || method === 'PATCH') {
      const ten = body.tenTroChoi || body.tenGame || '';
      const id = params.id || url.split('/').pop();
      return {
        hanhDong: 'CẬP NHẬT TRÒ CHƠI',
        chiTiet: ten ? `Cập nhật thông tin game "${ten}" (ID: ${id})` : `Cập nhật thông tin game ID: ${id}`
      };
    }
    if (method === 'DELETE') {
      const id = params.id || url.split('/').pop();
      return {
        hanhDong: 'XÓA TRÒ CHƠI',
        chiTiet: `Xóa / Ẩn trò chơi khỏi hệ thống (ID: ${id})`
      };
    }
  }

  // 2. Quản lý Khuyến mãi / Mã giảm giá
  if (url.includes('/promotions')) {
    if (url.includes('/status') && (method === 'PATCH' || method === 'PUT')) {
      const id = params.id || url.split('/')[4] || url.split('/')[3] || '';
      const trangThai = (body.kichHoat || body.trangThai) ? 'BẬT kích hoạt' : 'TẮT kích hoạt';
      return {
        hanhDong: 'BẬT/TẮT MÃ GIẢM GIÁ',
        chiTiet: `${trangThai} mã khuyến mãi ID: ${id}`
      };
    }
    if (method === 'POST') {
      const ma = body.maKhuyenMai || body.tenKhuyenMai || '';
      return {
        hanhDong: 'TẠO MÃ GIẢM GIÁ',
        chiTiet: ma ? `Tạo mã khuyến mãi mới "${ma}"` : 'Tạo mã khuyến mãi mới'
      };
    }
    if (method === 'PUT' || method === 'PATCH') {
      const ma = body.maKhuyenMai || body.tenKhuyenMai || '';
      const id = params.id || url.split('/').pop();
      return {
        hanhDong: 'CẬP NHẬT MÃ GIẢM GIÁ',
        chiTiet: ma ? `Cập nhật mã khuyến mãi "${ma}"` : `Cập nhật mã khuyến mãi ID: ${id}`
      };
    }
    if (method === 'DELETE') {
      const id = params.id || url.split('/').pop();
      return {
        hanhDong: 'XÓA MÃ GIẢM GIÁ',
        chiTiet: `Xóa mã khuyến mãi (ID: ${id})`
      };
    }
  }

  // 3. Quản lý Hoàn tiền
  if (url.includes('/refund')) {
    if (method === 'PUT' || method === 'PATCH') {
      const isApprove = url.includes('/approve') || body.trangThai === 'approved' || body.status === 'approved';
      const isReject = url.includes('/reject') || body.trangThai === 'rejected' || body.status === 'rejected';
      const id = params.id || url.split('/')[4] || url.split('/').pop();
      const actionName = isApprove ? 'DUYỆT HOÀN TIỀN' : (isReject ? 'TỪ CHỐI HOÀN TIỀN' : 'XỬ LÝ HOÀN TIỀN');
      return {
        hanhDong: actionName,
        chiTiet: isApprove
          ? `Chấp thuận hoàn tiền cho yêu cầu ID: ${id}`
          : `Từ chối yêu cầu hoàn tiền ID: ${id}${body.lyDoTuChoi ? ' - Lý do: ' + body.lyDoTuChoi : ''}`
      };
    }
  }

  // 4. Quản lý Đánh giá (Ẩn/Hiện review)
  if (url.includes('/reviews') && url.includes('/visibility')) {
    const reviewId = params.reviewId || url.split('/')[4] || '';
    const trangThai = body.isHienThi ? 'HIỂN THỊ' : 'ẨN';
    return {
      hanhDong: 'ẨN/HIỆN ĐÁNH GIÁ',
      chiTiet: `Chuyển trạng thái đánh giá ID: ${reviewId} sang ${trangThai}`
    };
  }

  // 5. Quản lý Khách hàng & Nhân sự Admin
  if (url.includes('/customers') || url.includes('/staff') || url.includes('/users')) {
    const id = params.id || url.split('/').pop();
    if (url.includes('/lock-status') || body.trangThaiKhoa !== undefined || body.biKhoa !== undefined) {
      const isLock = body.trangThaiKhoa === true || body.biKhoa === true;
      return {
        hanhDong: isLock ? 'KHÓA TÀI KHOẢN KHÁCH HÀNG' : 'MỞ KHÓA TÀI KHOẢN KHÁCH HÀNG',
        chiTiet: `${isLock ? 'Khóa' : 'Mở khóa'} tài khoản người dùng ID: ${id}`
      };
    }
    if (method === 'POST') {
      const ten = body.username || body.tenDangNhap || body.email || '';
      return {
        hanhDong: 'THÊM QUẢN TRỊ VIÊN',
        chiTiet: ten ? `Tạo tài khoản quản trị mới: ${ten}` : 'Tạo tài khoản quản trị mới'
      };
    }
    if (method === 'PUT' || method === 'PATCH') {
      return {
        hanhDong: 'CẬP NHẬT TÀI KHOẢN',
        chiTiet: `Cập nhật thông tin / quyền hạn tài khoản ID: ${id}`
      };
    }
    if (method === 'DELETE') {
      return {
        hanhDong: 'XÓA TÀI KHOẢN ADMIN',
        chiTiet: `Xóa tài khoản quản trị ID: ${id}`
      };
    }
  }

  // 6. Quản lý Thể loại / Danh mục
  if (url.includes('/categories')) {
    const id = params.id || url.split('/').pop();
    if (method === 'POST') return { hanhDong: 'TẠO THỂ LOẠI', chiTiet: `Thêm thể loại mới "${body.tenTheLoai || ''}"` };
    if (method === 'PUT' || method === 'PATCH') return { hanhDong: 'CẬP NHẬT THỂ LOẠI', chiTiet: `Sửa thể loại "${body.tenTheLoai || id}"` };
    if (method === 'DELETE') return { hanhDong: 'XÓA THỂ LOẠI', chiTiet: `Xóa thể loại ID: ${id}` };
  }

  // 7. Quản lý Thông báo
  if (url.includes('/notification')) {
    if (method === 'POST') return { hanhDong: 'GỬI THÔNG BÁO', chiTiet: `Gửi thông báo hệ thống: "${body.tieuDe || ''}"` };
    if (method === 'DELETE') return { hanhDong: 'XÓA THÔNG BÁO', chiTiet: `Xóa thông báo ID: ${params.id || url.split('/').pop()}` };
  }

  // Mặc định cho các thao tác POST, PUT, PATCH, DELETE khác
  const methodMap = {
    POST: 'TẠO MỚI DỮ LIỆU',
    PUT: 'CẬP NHẬT DỮ LIỆU',
    PATCH: 'SỬA ĐỔI DỮ LIỆU',
    DELETE: 'XÓA DỮ LIỆU'
  };

  return {
    hanhDong: methodMap[method] || `THAO TÁC ${method}`,
    chiTiet: `Thực hiện ${method} tại ${url}`
  };
}

const adminMiddleware = (req, res, next) => {
  try {
    // 1. Kiểm tra đã đi qua authMiddleware chưa
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập'
      });
    }

    // 2. Chỉ cho phép tài khoản Admin
    if (req.user.vaiTro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập chức năng quản trị'
      });
    }

    // 3. TỰ ĐỘNG GHI NHẬT KÝ KIỂM VẾT CHỈ CHO CÁC THAO TÁC CÓ THAY ĐỔI DỮ LIỆU (POST, PUT, PATCH, DELETE)
    // Bỏ qua GET để tránh làm loãng nhật ký khi Admin chuyển trang hoặc khi chuông thông báo tự động làm mới
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const currentMethod = String(req.method || '').toUpperCase();

    if (mutatingMethods.includes(currentMethod)) {
      res.on('finish', async () => {
        // Tránh ghi đè khi route con đã chủ động ghi log chi tiết trước đó
        if (req._auditLogged) return;

        // Tránh ghi lặp nếu gọi POST thủ công vào chính /admin/audit-logs
        if (req.originalUrl && req.originalUrl.includes('/admin/audit-logs')) {
          return;
        }

        // Chỉ ghi vết khi thao tác thực sự thành công (HTTP status < 400)
        if (res.statusCode >= 400) return;

        try {
          const { hanhDong, chiTiet } = phanTichHanhDong(req);
          const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';

          await AuditLog.create({
            tenTaiKhoan: req.user.tenDangNhap || req.user.maTaiKhoan || 'Admin',
            vaiTro: req.user.vaiTro || 'admin',
            hanhDong,
            chiTiet,
            phuongThuc: currentMethod,
            duongDan: req.originalUrl || req.url,
            diaChiIp: String(ip).replace('::ffff:', '')
          });
        } catch (logErr) {
          console.warn('Lỗi tự động ghi audit log (không nghiêm trọng):', logErr.message);
        }
      });
    }

    next();

  } catch (error) {
    console.error('Lỗi kiểm tra quyền Admin:', error);

    return res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra quyền truy cập'
    });
  }
};

module.exports = adminMiddleware;