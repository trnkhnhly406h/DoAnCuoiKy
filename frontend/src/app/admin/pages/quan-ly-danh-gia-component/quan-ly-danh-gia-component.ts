import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ReviewEntity } from '../../../models/tai-khoan';
import { QuanTri } from '../../../services/quan-tri';

@Component({
  selector: 'app-quan-ly-danh-gia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-danh-gia-component.html',
  styleUrl: './quan-ly-danh-gia-component.css'
})
export class QuanLyDanhGiaComponent implements OnInit {
  // Trạng thái bật/tắt các Dropdown
  isGameOpen = false;
  isStatusOpen = false;
  isSortOpen = false;

  // Từ khóa & giá trị bộ lọc
  tuKhoa = '';
  tuKhoaTimGame = '';

  boLocGame = '';
  boLocTrangThai = '';
  boLocSapXep = 'moi_nhat';

  // Thống kê số liệu
  tongDanhGia = 0;
  tyLeKhuyenDung = 0;
  soHienThi = 0;
  soDaAn = 0;
  soKhuyenDung = 0;
  soKhongKhuyenDung = 0;

  // Biến phục vụ Popup Modal xem chi tiết
  selectedReview: ReviewEntity | null = null;

  // Danh sách game hiển thị trong dropdown (tự động lấy từ dữ liệu thực tế)
  danhSachTenGame: string[] = [];

  // DỮ LIỆU GỐC LẤY TỪ BACKEND API
  danhSachGoc: ReviewEntity[] = [];
  danhSachHienThi: ReviewEntity[] = [];

  readonly defaultAvatar =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="%233d445e"/><circle cx="20" cy="15" r="7" fill="%23a685ff"/><path d="M8 34c2-6 7-9 12-9s10 3 12 9" fill="%23a685ff"/></svg>';

  readonly defaultGameImg =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><rect width="40" height="40" rx="6" fill="%23252e4c"/><circle cx="20" cy="20" r="10" fill="%23ebc849"/></svg>';

  constructor(
    private router: Router,
    private quanTriService: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiDanhSachDanhGia();
  }

  // ===== TẢI DANH SÁCH ĐÁNH GIÁ TỪ MONGODB ATLAS =====
  taiDanhSachDanhGia(): void {
    this.quanTriService.layDanhSachDanhGiaAdmin().subscribe({
      next: (data) => {
        this.danhSachGoc = Array.isArray(data) ? data : [];

        // Trích xuất danh sách tên game duy nhất để đưa vào dropdown lọc
        const gameSet = new Set<string>();
        this.danhSachGoc.forEach(item => {
          if (item.tenGame && item.tenGame !== 'Không xác định') {
            gameSet.add(item.tenGame);
          }
        });
        this.danhSachTenGame = Array.from(gameSet).sort((a, b) =>
          a.localeCompare(b, 'vi')
        );

        this.tinhThongKe();
        this.locDanhSach();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách đánh giá:', err);
        this.danhSachGoc = [];
        this.tinhThongKe();
        this.locDanhSach();
        this.cdr.detectChanges();
      }
    });
  }

  // ===== LOGIC DROPDOWN FILTER =====
  get danhSachGameLoc(): string[] {
    if (!this.tuKhoaTimGame.trim()) {
      return this.danhSachTenGame;
    }
    return this.danhSachTenGame.filter(g =>
      g.toLowerCase().includes(this.tuKhoaTimGame.toLowerCase())
    );
  }

  toggleDropdown(type: 'game' | 'status' | 'sort', event: Event) {
    event.stopPropagation();
    if (type === 'game') {
      this.isGameOpen = !this.isGameOpen;
      this.isStatusOpen = false;
      this.isSortOpen = false;
    } else if (type === 'status') {
      this.isStatusOpen = !this.isStatusOpen;
      this.isGameOpen = false;
      this.isSortOpen = false;
    } else if (type === 'sort') {
      this.isSortOpen = !this.isSortOpen;
      this.isGameOpen = false;
      this.isStatusOpen = false;
    }
  }

  selectGame(game: string) {
    this.boLocGame = game;
    this.isGameOpen = false;
    this.locDanhSach();
  }

  selectStatus(status: string) {
    this.boLocTrangThai = status;
    this.isStatusOpen = false;
    this.locDanhSach();
  }

  selectSort(sort: string) {
    this.boLocSapXep = sort;
    this.isSortOpen = false;
    this.locDanhSach();
  }

  @HostListener('document:click')
  closeAllDropdowns() {
    this.isGameOpen = false;
    this.isStatusOpen = false;
    this.isSortOpen = false;
  }

  // ===== TÍNH THỐNG KÊ TỰ ĐỘNG =====
  tinhThongKe() {
    this.tongDanhGia = this.danhSachGoc.length;

    this.soHienThi = this.danhSachGoc.filter(
      x => x.trangThai === 'hien_thi'
    ).length;
    this.soDaAn = this.danhSachGoc.filter(
      x => x.trangThai === 'an' || x.trangThai === 'da_an'
    ).length;

    this.soKhuyenDung = this.danhSachGoc.filter(
      x => x.danhGia === 'khuyen_dung'
    ).length;
    this.soKhongKhuyenDung = this.danhSachGoc.filter(
      x => x.danhGia === 'khong_khuyen_dung'
    ).length;

    this.tyLeKhuyenDung =
      this.tongDanhGia > 0
        ? Math.round((this.soKhuyenDung / this.tongDanhGia) * 100)
        : 0;
  }

  // ===== LỌC DANH SÁCH BẢNG =====
  locDanhSach() {
    let ketQua = [...this.danhSachGoc];

    // 1. Lọc theo từ khóa tìm kiếm
    if (this.tuKhoa.trim()) {
      const k = this.tuKhoa.trim().toLowerCase();
      ketQua = ketQua.filter(item =>
        (item.tenGame?.toLowerCase() || '').includes(k) ||
        (item.tenTaiKhoanNguoiDung?.toLowerCase() || '').includes(k) ||
        (item.maTaiKhoanNguoiDung?.toLowerCase() || '').includes(k) ||
        (item.noiDung?.toLowerCase() || '').includes(k)
      );
    }

    // 2. Lọc theo Game
    if (this.boLocGame) {
      ketQua = ketQua.filter(item => item.tenGame === this.boLocGame);
    }

    // 3. Lọc theo Trạng thái
    if (this.boLocTrangThai) {
      if (this.boLocTrangThai === 'da_an') {
        ketQua = ketQua.filter(
          item => item.trangThai === 'da_an' || item.trangThai === 'an'
        );
      } else {
        ketQua = ketQua.filter(
          item => item.trangThai === this.boLocTrangThai
        );
      }
    }

    // 4. SẮP XẾP THEO THỜI GIAN (NGÀY ĐÁNH GIÁ)
    if (this.boLocSapXep === 'moi_nhat') {
      ketQua.sort(
        (a, b) => this.parseDate(b.ngayDanhGia) - this.parseDate(a.ngayDanhGia)
      );
    } else if (this.boLocSapXep === 'cu_nhat') {
      ketQua.sort(
        (a, b) => this.parseDate(a.ngayDanhGia) - this.parseDate(b.ngayDanhGia)
      );
    }

    this.danhSachHienThi = ketQua;
  }

  // Hàm phụ trợ chuyển chuỗi "dd/mm/yyyy" thành timestamp để so sánh chính xác
  private parseDate(dateStr?: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      return dateObj.getTime();
    }
    return 0;
  }

  // ===== LOGIC MODAL POPUP CHI TIẾT =====
// ===== LOGIC MODAL POPUP CHI TIẾT =====
  openModal(review: ReviewEntity): void {
    this.selectedReview = { ...review };
  }

  closeModal(): void {
    this.selectedReview = null;
    this.cdr.detectChanges();
  }

  private capNhatTrangThaiTrongDanhSachGoc(
    review: ReviewEntity,
    trangThaiMoi: string
  ): void {
    this.danhSachGoc = this.danhSachGoc.map(r => {
      const khopId =
        review._id && r._id && String(r._id) === String(review._id);
      const khopThongTin =
        !review._id &&
        r.maTaiKhoanNguoiDung === review.maTaiKhoanNguoiDung &&
        r.tenGame === review.tenGame &&
        r.noiDung === review.noiDung;

      if (khopId || khopThongTin) {
        return { ...r, trangThai: trangThaiMoi };
      }
      return r;
    });

    this.tinhThongKe();
    this.locDanhSach();
    this.cdr.detectChanges();
  }

  toggleReviewStatus(review: ReviewEntity): void {
    const dangHienThi = review.trangThai === 'hien_thi';
    const isHienThiMoi = !dangHienThi;
    const trangThaiMoi = isHienThiMoi ? 'hien_thi' : 'da_an';

    if (review._id) {
      this.quanTriService
        .capNhatHienThiDanhGia(review._id, isHienThiMoi)
        .subscribe({
          next: () => {
            review.trangThai = trangThaiMoi;
            if (this.selectedReview) {
              this.selectedReview = {
                ...this.selectedReview,
                trangThai: trangThaiMoi
              };
            }
            this.capNhatTrangThaiTrongDanhSachGoc(review, trangThaiMoi);
          },
          error: (err) => {
            console.error('Lỗi cập nhật trạng thái đánh giá:', err);
            alert(err.error?.message || 'Không thể cập nhật trạng thái đánh giá');
          }
        });
    } else {
      review.trangThai = trangThaiMoi;
      if (this.selectedReview) {
        this.selectedReview = {
          ...this.selectedReview,
          trangThai: trangThaiMoi
        };
      }
      this.capNhatTrangThaiTrongDanhSachGoc(review, trangThaiMoi);
    }
  }
}