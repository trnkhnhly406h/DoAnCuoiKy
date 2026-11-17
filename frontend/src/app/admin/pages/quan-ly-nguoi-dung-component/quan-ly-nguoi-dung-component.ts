import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { QuanTri } from '../../../services/quan-tri';
import * as XLSX from 'xlsx';

export interface KhachHang {
  maTaiKhoanNguoiDung: string;
  tenTaiKhoanNguoiDung: string;
  hoTen: string;
  email: string;
  soDienThoai?: string;
  anhDaiDien: string | null;
  trangThaiKhoa: boolean;
  dangChoXoa?: boolean;
  hanXoaTaiKhoan?: string;
  tongChiTieu: number;
  tongDon: number;
  soNgayDaKhoa: number;
}

@Component({
  selector: 'app-quan-ly-nguoi-dung',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-nguoi-dung-component.html',
  styleUrl: './quan-ly-nguoi-dung-component.css'
})
export class QuanLyNguoiDungComponent implements OnInit {
  tuKhoa = '';
  trangThaiTam = '';
  chiTieuTam = '';
  trangHienTai = 1;
  soDongMoiTrang = 12;

  dangTaiDuLieu = false;
  danhSachKhachHang: KhachHang[] = [];

  constructor(
    private router: Router,
    private quanTriService: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiDanhSachKhachHang();
  }

  // TẢI DANH SÁCH KHÁCH HÀNG TỪ BACKEND API
  taiDanhSachKhachHang(): void {
    this.dangTaiDuLieu = true;

    this.quanTriService.layDanhSachKhachHang().subscribe({
      next: (data) => {
        this.danhSachKhachHang = Array.isArray(data) ? data : [];
        this.trangHienTai = 1;
        this.dangTaiDuLieu = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách người dùng:', err);
        this.danhSachKhachHang = [];
        this.dangTaiDuLieu = false;
        this.cdr.detectChanges();
      }
    });
  }

  get tongTaiKhoan(): number {
    return this.danhSachKhachHang.length;
  }

  get danhSachDaLoc(): KhachHang[] {
    return this.danhSachKhachHang.filter(kh => {
      const khopTuKhoa = this.khopTuKhoa(kh);
      const khopTrangThai =
        !this.trangThaiTam ||
        (this.trangThaiTam === 'hoat-dong' && !kh.trangThaiKhoa) ||
        (this.trangThaiTam === 'da-khoa' && kh.trangThaiKhoa);
      const khopChiTieu =
        !this.chiTieuTam ||
        (this.chiTieuTam === 'duoi-1m' && kh.tongChiTieu < 1000000) ||
        (this.chiTieuTam === '1m-5m' && kh.tongChiTieu >= 1000000 && kh.tongChiTieu <= 5000000) ||
        (this.chiTieuTam === 'tren-5m' && kh.tongChiTieu > 5000000);
      return khopTuKhoa && khopTrangThai && khopChiTieu;
    });
  }

  private khopTuKhoa(kh: KhachHang): boolean {
    const tuKhoa = this.tuKhoa.trim().toLowerCase();
    if (!tuKhoa) return true;

    return (
      (kh.maTaiKhoanNguoiDung || '').toLowerCase().includes(tuKhoa) ||
      (kh.tenTaiKhoanNguoiDung || '').toLowerCase().includes(tuKhoa) ||
      (kh.hoTen || '').toLowerCase().includes(tuKhoa) ||
      (kh.email || '').toLowerCase().includes(tuKhoa) ||
      (kh.soDienThoai || '').toLowerCase().includes(tuKhoa)
    );
  }

  get tongSoTrang(): number {
    return Math.max(1, Math.ceil(this.danhSachDaLoc.length / this.soDongMoiTrang));
  }

  get danhSachTrang(): number[] {
    return Array.from({ length: this.tongSoTrang }, (_, i) => i + 1);
  }

  get danhSachHienThi(): KhachHang[] {
    const batDau = (this.trangHienTai - 1) * this.soDongMoiTrang;
    return this.danhSachDaLoc.slice(batDau, batDau + this.soDongMoiTrang);
  }

  chuyenTrang(trang: number): void {
    if (trang >= 1 && trang <= this.tongSoTrang) {
      this.trangHienTai = trang;
    }
  }

  trangTruoc(): void {
    if (this.trangHienTai > 1) {
      this.trangHienTai--;
    }
  }

  trangSau(): void {
    if (this.trangHienTai < this.tongSoTrang) {
      this.trangHienTai++;
    }
  }

  locKhachHang(): void {
    this.trangHienTai = 1;
  }

  datLaiBoLoc(): void {
    this.tuKhoa = '';
    this.trangThaiTam = '';
    this.chiTieuTam = '';
    this.trangHienTai = 1;
  }

  lamMoi(): void {
    this.datLaiBoLoc();
    this.taiDanhSachKhachHang();
  }

  // HÀM XUẤT DANH SÁCH NGƯỜI DÙNG RA FILE EXCEL
  xuatExcel(): void {
    const dsXuat = this.danhSachDaLoc;
    if (!dsXuat || dsXuat.length === 0) {
      alert('Không có dữ liệu người dùng để xuất!');
      return;
    }

    const dataExcel = dsXuat.map((kh, index) => ({
      'STT': index + 1,
      'Mã tài khoản': kh.maTaiKhoanNguoiDung,
      'Tên tài khoản': kh.tenTaiKhoanNguoiDung,
      'Họ tên': kh.hoTen,
      'Email': kh.email,
      'Số điện thoại': kh.soDienThoai || '',
      'Tổng chi tiêu (VNĐ)': kh.tongChiTieu,
      'Tổng đơn': kh.tongDon,
      'Trạng thái': kh.trangThaiKhoa ? 'Đã khóa' : 'Hoạt động',
      'Số ngày đã khóa': kh.soNgayDaKhoa
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataExcel);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
      { wch: 25 },
      { wch: 15 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
      { wch: 15 }
    ];

    const workbook: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách khách hàng');

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Danh_Sach_Khach_Hang_${dateStr}.xlsx`);
  }

  layChuCaiDaiDien(kh: KhachHang): string {
    const ten = kh.hoTen || kh.tenTaiKhoanNguoiDung || 'U';
    return ten.charAt(0).toUpperCase();
  }

  dinhDangTien(soTien: number): string {
    return new Intl.NumberFormat('vi-VN').format(soTien || 0) + 'đ';
  }

  xemKhachHang(kh: KhachHang): void {
    this.router.navigate(['/admin/users', kh.maTaiKhoanNguoiDung]);
  }
}