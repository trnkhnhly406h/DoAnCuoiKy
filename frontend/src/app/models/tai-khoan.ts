
// ========================================
// 1. ĐĂNG NHẬP ADMIN
// ========================================

// Interface yêu cầu dữ liệu gửi lên khi đăng nhập
export interface DangNhapRequest {
  email: string;
  matKhau: string;
}

// Interface dữ liệu trả về sau khi đăng nhập thành công
export interface DangNhapResponse {
  token: string;
  adminInfo: {
    id: string;
    email: string;
    hoTen: string;
  };
}

// Interface lưu thông tin Session phiên làm việc
export interface PhienLamViec {
  token: string;
  ngayTao: string;
  ngayHetHan: string;
}


// ========================================
// 2. ĐƠN HÀNG KHÁCH HÀNG
// ========================================

export interface DonHangKhach {
  stt: number;
  maDon: string;
  ngay: string;
  game: string;
  tongTien: number;
  phuongThuc: string;
  trangThai: 'Thành công' | 'Đã hủy' | 'Đã hoàn tiền';
  nguoiNhan?: string;
}


// ========================================
// 3. THÔNG TIN KHÁCH HÀNG
// ========================================

export interface KhachHang {
  maTaiKhoanNguoiDung: string;
  tenTaiKhoanNguoiDung: string;
  hoTen: string;
  email: string;
  anhDaiDien: string | null;
  trangThaiKhoa: boolean;
  tongChiTieu: number;
  tongDon: number;
  soNgayDaKhoa: number;
}


// ========================================
// 4. ĐÁNH GIÁ GAME
// ========================================

export interface ReviewEntity {
  _id?: string;
  maTaiKhoanNguoiDung: string;
  tenTaiKhoanNguoiDung?: string;
  hoTen?: string;
  anhDaiDien?: string;
  ngayThamGia?: string;
  maGame: string;
  tenGame: string;
  ngayMuaGame?: string;
  danhGia: 'khuyen_dung' | 'khong_khuyen_dung' | string;
  rating?: number;
  noiDung: string;
  ngayDanhGia: string;
  trangThai: 'hien_thi' | 'an' | 'da_an' | string;

  // UI fallback compatibility
  anhGame?: string;
  isKhuyenDung?: boolean;
  isHienThi?: boolean;
}


// ========================================
// 5. SẢN PHẨM TRONG ĐƠN HÀNG
// ========================================

export interface RefundOrderProduct {
  maGame: string;
  tenGame: string;
  donGia: number;
}


// ========================================
// 6. THÔNG TIN ĐƠN HÀNG ĐƯỢC POPULATE
// ========================================

export interface RefundOrderInfo {
  _id: string;
  maDonHang: string;
  maTaiKhoan: string;
  sanPham: RefundOrderProduct[];
  tongTien: number;
  phuongThucThanhToan: string;
  trangThai: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
}


// ========================================
// 7. THÔNG TIN KHÁCH HÀNG TRONG YÊU CẦU HOÀN TIỀN
// ========================================

export interface RefundCustomerInfo {
  maTaiKhoan: string;
  tenDangNhap: string;
  hoTen: string;
  email: string;
  soDienThoai: string;
}


// ========================================
// 8. THÔNG TIN GAME TRONG YÊU CẦU HOÀN TIỀN
// ========================================

export interface RefundGameInfo {
  maGame: string;
  tenTroChoi: string;
  giaHienTai: number;
  phanTramGiamGia: number;
}


// ========================================
// 9. SẢN PHẨM ĐƯỢC YÊU CẦU HOÀN TIỀN
// ========================================

export interface RefundProductInfo {
  maGame: string;
  tenGame: string;
  donGia: number;
}


// ========================================
// 10. YÊU CẦU HOÀN TIỀN
// ========================================

export interface RefundRequestEntity {
  // ID MongoDB của yêu cầu hoàn tiền
  _id: string;

  // Mã yêu cầu hoàn tiền
  maYeuCau: string;

  // Thông tin đơn hàng đã populate
  maDonHang: RefundOrderInfo | null;

  // Mã tài khoản và mã game
  maTaiKhoan: string;
  maGame: string;

  // Thông tin được Backend kết hợp
  khachHang: RefundCustomerInfo | null;
  game: RefundGameInfo | null;
  sanPham: RefundProductInfo | null;

  // Lý do khách hàng yêu cầu
  lyDoKhachHang: string;

  // Trạng thái yêu cầu
  trangThaiHoanTien: 'pending' | 'approved' | 'rejected';

  // Thông tin xử lý của Admin
  soTienHoan: number;
  lyDoTuChoi?: string;
  adminXuLy?: string | null;

  // Thời gian xử lý
  ngayYeuCau: string;
  ngayXuLy?: string | null;
  ngayHoanTien?: string | null;

  createdAt?: string;
  updatedAt?: string;

  // Tên game hỗ trợ giao diện cũ
  tenGame?: string;
}
