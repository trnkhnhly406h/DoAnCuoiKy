import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
interface KhuyenMai {
  id: string;
  maKhuyenMai: string;
  moTa: string;
  phanTramGiamGia: number;
  ngayBatDau: string;
  ngayKetThuc: string;
  daSuDung: number;
}

@Component({
  selector: 'app-chi-tiet-khuyen-mai-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chi-tiet-khuyen-mai-component.html',
  styleUrl: './chi-tiet-khuyen-mai-component.css'
})
export class ChiTietKhuyenMaiComponent implements OnInit {
  dangTaoMoi = false;
  idKhuyenMai = '';
  maKhuyenMai = '';
  phanTramGiamGia: number | null = null;
  moTa = '';
  ngayBatDau = '';
  ngayKetThuc = '';
  coThoiGianKetThuc = true;
  hienPopupThanhCong = false;
  thongBaoLoi = '';

  // Dữ liệu mẫu đồng bộ mã và ID với trang quản lý khuyến mãi.
  
  private readonly API_URL = 'http://localhost:3000/api/store/promotions';

  dangLuu = false;
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private http: HttpClient,
  private cdr: ChangeDetectorRef
) {}
  async ngOnInit(): Promise<void> {
  const id = this.route.snapshot.paramMap.get('id');

  this.dangTaoMoi = !id || ['tao-moi', 'new'].includes(id);

  // Trường hợp tạo mới
  if (this.dangTaoMoi) {
    this.idKhuyenMai = '';
    this.coThoiGianKetThuc = true;
    return;
  }

  // Trường hợp chỉnh sửa: lấy dữ liệu từ MongoDB
  try {
    const response = await firstValueFrom(
      this.http.get<{
        success: boolean;
        message?: string;
        data?: any[];
      }>(this.API_URL)
    );

    if (!response.success || !Array.isArray(response.data)) {
      throw new Error(
        response.message || 'Không thể tải danh sách khuyến mãi.'
      );
    }

    // Tìm mã khuyến mãi theo _id MongoDB
    const ma = response.data.find(
      item => item._id === id
    );

    if (!ma) {
      this.thongBaoLoi =
        'Không tìm thấy mã khuyến mãi. Vui lòng quay lại danh sách.';
      return;
    }

    // Đổ dữ liệu vào biểu mẫu
    this.idKhuyenMai = ma._id;
    this.maKhuyenMai = ma.maKhuyenMai || '';
    this.moTa = ma.moTa || '';
    this.phanTramGiamGia = Number(ma.phanTramGiamGia);

    this.ngayBatDau = this.chuyenNgayDeHienThi(ma.ngayBatDau);

    if (ma.ngayKetThuc) {
      this.ngayKetThuc = this.chuyenNgayDeHienThi(ma.ngayKetThuc);
      this.coThoiGianKetThuc = true;
    } else {
      this.ngayKetThuc = '';
      this.coThoiGianKetThuc = false;
    }
    this.cdr.detectChanges();

  } catch (error: any) {
    console.error('Lỗi tải chi tiết khuyến mãi:', error);

    this.thongBaoLoi =
      error?.error?.message ||
      error?.message ||
      'Không thể tải thông tin khuyến mãi.';
      this.cdr.detectChanges();
  }
}
private chuyenNgayDeHienThi(ngay: string): string {
  if (!ngay) return '';

  const date = new Date(ngay);

  if (isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);

  return localDate.toISOString().slice(0, 16);
}

  doiTrangThaiKetThuc(): void {
    if (!this.coThoiGianKetThuc) this.ngayKetThuc = '';
  }

  async luuKhuyenMai(): Promise<void> {
  this.thongBaoLoi = '';

  // 1. Kiểm tra dữ liệu
  const phanTram = Number(this.phanTramGiamGia);

  if (
    !this.maKhuyenMai.trim() ||
    this.phanTramGiamGia === null ||
    !Number.isFinite(phanTram) ||
    phanTram < 1 ||
    phanTram > 100 ||
    !this.moTa.trim() ||
    !this.ngayBatDau ||
    (this.coThoiGianKetThuc && !this.ngayKetThuc)
  ) {
    this.thongBaoLoi =
      'Vui lòng điền đầy đủ thông tin bắt buộc.';
    return;
  }

  // 2. Kiểm tra thời gian
  if (
    this.coThoiGianKetThuc &&
    new Date(this.ngayKetThuc) < new Date(this.ngayBatDau)
  ) {
    this.thongBaoLoi =
      'Thời gian kết thúc không được trước thời gian bắt đầu.';
    return;
  }

  // 3. Chống nhấn nút Lưu nhiều lần
  if (this.dangLuu) {
    return;
  }

  this.dangLuu = true;

  // 4. Chuẩn bị dữ liệu gửi Backend
  const duLieuKhuyenMai: any = {
    maKhuyenMai: this.maKhuyenMai.trim().toUpperCase(),
    moTa: this.moTa.trim(),
    phanTramGiamGia: phanTram,
    ngayBatDau: this.ngayBatDau,
    ngayKetThuc: this.coThoiGianKetThuc
      ? this.ngayKetThuc
      : null
  };

  if (this.dangTaoMoi) {
    duLieuKhuyenMai.trangThai = true;
    duLieuKhuyenMai.chiApDungLanDau = false;
  }

  try {
    // 5. Gọi API tạo mới hoặc cập nhật khuyến mãi
const response = await firstValueFrom(
  this.dangTaoMoi
    ? this.http.post<{
        success: boolean;
        message?: string;
        data?: any;
      }>(
        this.API_URL,
        duLieuKhuyenMai
      )
    : this.http.put<{
        success: boolean;
        message?: string;
        data?: any;
      }>(
        `${this.API_URL}/${this.idKhuyenMai}`,
        duLieuKhuyenMai
      )
);

// 6. Kiểm tra kết quả từ Backend
if (!response.success || !response.data) {
  throw new Error(
    response.message ||
    (this.dangTaoMoi
      ? 'Không thể tạo mã khuyến mãi.'
      : 'Không thể cập nhật mã khuyến mãi.')
  );
}

// Cập nhật thông tin mã vừa lưu
this.maKhuyenMai = response.data.maKhuyenMai;
this.idKhuyenMai = response.data._id;

// Hiện popup thành công
this.hienPopupThanhCong = true;

setTimeout(() => {
  this.router.navigate(['/admin/promotions']);
}, 1500);

    // Cập nhật mã vừa tạo
    this.maKhuyenMai = response.data.maKhuyenMai;
    this.idKhuyenMai = response.data._id;

    // Chỉ hiện popup khi MongoDB đã lưu thành công
this.hienPopupThanhCong = true;

setTimeout(() => {
  this.router.navigate(['/admin/promotions']);
}, 1500);
  } catch (error: any) {
    console.error('Lỗi tạo khuyến mãi:', error);

    this.thongBaoLoi =
      error?.error?.message ||
      error?.message ||
      'Không thể lưu khuyến mãi. Vui lòng thử lại.';

  } finally {
    this.dangLuu = false;
  }
}

  dongPopupThanhCong(): void {
    this.hienPopupThanhCong = false;
    this.quayVe();
  }

  quayVe(): void {
    this.router.navigate(['/admin/promotions']);
  }

  huy(): void {
    this.quayVe();
  }
}
