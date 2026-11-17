import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { QuanTri } from '../../../../services/quan-tri';
import { ReviewEntity } from '../../../../models/tai-khoan';

// Kiểu dữ liệu yêu cầu hoàn tiền
interface RefundRequestView {
  _id: string;
  maDonHang: string;
  maTaiKhoan: string;
  maGame: string;
  tenGame: string;
  lyDoKhachHang: string;
  lyDoTuChoi?: string;
  trangThaiDonHang: 'cho_xu_ly' | 'tu_choi' | 'hoan_tien';
  ngayYeuCau: string;
  ngayXuLy?: string;
  ngayHoanTien?: string;
  soTienHoan: number;
}

@Component({
  selector: 'app-chi-tiet-nguoi-dung',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chi-tiet-nguoi-dung-component.html',
  styleUrl: './chi-tiet-nguoi-dung-component.css'
})
export class ChiTietNguoiDungComponent implements OnInit {

  maKhachHang = '';
  tabHienTai: 'lich-su' | 'thu-vien' | 'danh-gia' = 'lich-su';
  isLoading = false;

  // Dữ liệu thực tế lấy từ Backend API
  khachHang: any = null;
  danhSachReviews: ReviewEntity[] = [];
  danhSachRefundRequests: RefundRequestView[] = [];

  // Modal hoàn tiền
  hienModalHoanTien = false;
  thongTinHoanTienChon: RefundRequestView | null = null;

  // Modal khóa tài khoản
  hienModalKhoa = false;
  lyDoKhoaInput = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quanTriService: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.maKhachHang = params.get('id') || '';
      if (this.maKhachHang) {
        this.taiChiTietKhachHang();
      }
    });
  }

  // ========================================
  // 1. TẢI CHI TIẾT KHÁCH HÀNG TỪ BACKEND
  // ========================================

  taiChiTietKhachHang(): void {
    if (!this.maKhachHang) return;

    this.isLoading = true;

    this.quanTriService.layChiTietKhachHang(this.maKhachHang).subscribe({
      next: (res: any) => {
        this.isLoading = false;

        if (res) {
          this.khachHang = res.khachHang || res;
          this.danhSachReviews = Array.isArray(res.danhSachReviews)
            ? res.danhSachReviews
            : [];
          this.taiDanhSachRefund();
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        console.error('Lỗi tải chi tiết khách hàng:', err);
        this.cdr.detectChanges();
      }
    });
  }

  // ========================================
  // 2. TẢI DANH SÁCH YÊU CẦU HOÀN TIỀN
  // ========================================

  taiDanhSachRefund(): void {
    this.quanTriService.layDanhSachRefund().subscribe({
      next: (res: any[]) => {
        const maTaiKhoan = this.khachHang?.maTaiKhoanNguoiDung;

        this.danhSachRefundRequests = (res || [])
          .filter(rf => String(rf.maTaiKhoan) === String(maTaiKhoan))
          .map(rf => ({
            _id: rf._id,
            maDonHang: rf.maDonHang?.maDonHang || '',
            maTaiKhoan: rf.maTaiKhoan,
            maGame: rf.maGame,
            tenGame:
              rf.game?.tenTroChoi ||
              rf.sanPham?.tenGame ||
              'Không xác định',
            lyDoKhachHang: rf.lyDoKhachHang || '',
            lyDoTuChoi: rf.lyDoTuChoi || '',
            trangThaiDonHang:
              rf.trangThaiHoanTien === 'pending'
                ? 'cho_xu_ly'
                : rf.trangThaiHoanTien === 'approved'
                  ? 'hoan_tien'
                  : 'tu_choi',
            ngayYeuCau: rf.ngayYeuCau
              ? new Date(rf.ngayYeuCau).toLocaleDateString('vi-VN')
              : '',
            ngayXuLy: rf.ngayXuLy || '',
            ngayHoanTien: rf.ngayHoanTien || '',
            soTienHoan:
              Number(rf.soTienHoan) || Number(rf.sanPham?.donGia) || 0
          }));

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải danh sách yêu cầu hoàn tiền:', err);
      }
    });
  }

  // ========================================
  // 3. THỐNG KÊ KHÁCH HÀNG
  // ========================================

  get tongDonHang(): number {
    if (!this.khachHang?.danhSachDonHang) return 0;
    return this.khachHang.danhSachDonHang.length;
  }

  get tongChiTieu(): number {
    if (!this.khachHang?.danhSachDonHang) return 0;

    return this.khachHang.danhSachDonHang
      .filter((item: any) =>
        item.trangThaiDonHang === 'thanh_cong' ||
        item.trangThaiDonHang === 'hoan_tien' ||
        item.trangThai === 'Thành công'
      )
      .reduce(
        (sum: number, item: any) =>
          sum + (Number(item.tongTien) || 0),
        0
      );
  }

  get danhSachGameThuVien(): Array<{
    tenGame: string;
    ngayMua: string;
    anhGame: string;
  }> {
    const defaultSvg =
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="65" height="65" viewBox="0 0 65 65"><rect width="65" height="65" fill="%23c0392b"/><circle cx="32" cy="32" r="20" fill="%23e67e22"/><circle cx="25" cy="27" r="3" fill="%23000"/><circle cx="39" cy="27" r="3" fill="%23000"/><polygon points="32,33 28,39 36,39" fill="%23f1c40f"/></svg>';

    // Ưu tiên danh sách game trong thư viện thực tế từ Backend (populate danhSachGameDaMua)
    if (Array.isArray(this.khachHang?.danhSachGameThuVien)) {
      return this.khachHang.danhSachGameThuVien.map((g: any) => ({
        tenGame: g.tenGame,
        ngayMua: g.ngayMua || '',
        anhGame: g.anhGame || defaultSvg
      }));
    }

    if (!this.khachHang?.danhSachDonHang) return [];

    const result: Array<{
      tenGame: string;
      ngayMua: string;
      anhGame: string;
    }> = [];

    this.khachHang.danhSachDonHang.forEach((item: any) => {
      if (
        item.trangThaiDonHang === 'thanh_cong' ||
        item.trangThai === 'Thành công'
      ) {
        const strGame = item.danhsachGame || item.game || '';

        const listGameName = strGame
          .split(',')
          .map((g: string) => g.trim())
          .filter(Boolean);

        listGameName.forEach((gName: string) => {
          result.push({
            tenGame: gName,
            ngayMua: item.ngayTao || item.ngay,
            anhGame: defaultSvg
          });
        });
      }
    });

    return result;
  }

  get gameSoHuu(): number {
    return this.danhSachGameThuVien.length;
  }

  // ========================================
  // 4. ĐIỀU HƯỚNG VÀ TAB
  // ========================================

  quayLai(): void {
  window.history.back();
}

  chuyenTab(tab: 'lich-su' | 'thu-vien' | 'danh-gia'): void {
    this.tabHienTai = tab;
  }

  // ========================================
  // 5. KHÓA / MỞ KHÓA TÀI KHOẢN
  // ========================================

 // ========================================
  // 5. KHÓA / MỞ KHÓA TÀI KHOẢN
  // ========================================

  xuLyBamNutKhoaTaiKhoan(): void {
    if (!this.khachHang) return;

    if (this.khachHang.trangThaiKhoa) {
      if (this.khachHang.dangChoXoa && !window.confirm(
        'Chỉ mở khóa khi đã xác minh email yêu cầu khôi phục của khách hàng.\n' +
        'Mở khóa sẽ HỦY lịch xóa tự động. Bạn có xác nhận đã kiểm tra email không?'
      )) {
        return;
      }

      const targetId =
        this.khachHang.maTaiKhoanNguoiDung || this.khachHang._id;

      this.quanTriService
        .capNhatTrangThaiKhoa(targetId, false)
        .subscribe({
          next: () => {
            this.khachHang.trangThaiKhoa = false;
            this.khachHang.dangChoXoa = false;
            this.khachHang.hanXoaTaiKhoan = '';
            this.khachHang.soNgayDaKhoa = 0;
            this.khachHang.lyDoKhoa = '';
            this.khachHang.ngayKhoa = '';

            // Ghi Audit Log hành động MỞ KHÓA
            const targetName = this.khachHang.tenKhachHang || this.khachHang.hoTen || targetId;
            this.quanTriService.ghiAuditLog(
              'MỞ KHÓA TÀI KHOẢN',
              `Mở khóa tài khoản khách hàng [${targetName}]`
            ).subscribe();

            this.cdr.detectChanges();
          },
          error: (err: any) => {
            alert(err.error?.message || 'Không thể mở khóa tài khoản');
          }
        });
    } else {
      this.lyDoKhoaInput = '';
      this.hienModalKhoa = true;
    }
  }

  xacNhanKhoaTaiKhoan(): void {
    const today = new Date();
    const ngayDinhDang =
      `${String(today.getDate()).padStart(2, '0')}/` +
      `${String(today.getMonth() + 1).padStart(2, '0')}/` +
      `${today.getFullYear()}`;

    this.khachHang.trangThaiKhoa = true;
    this.khachHang.soNgayDaKhoa = 1;
    this.khachHang.lyDoKhoa = this.lyDoKhoaInput.trim() || 'Vi phạm chính sách';
    this.khachHang.ngayKhoa = ngayDinhDang;

    const targetId = this.khachHang.maTaiKhoanNguoiDung || this.khachHang._id || this.khachHang.id;

    this.quanTriService.capNhatTrangThaiKhoa(
      targetId,
      true,
      this.khachHang.lyDoKhoa,
      ngayDinhDang
    ).subscribe({
      next: () => {
        // Ghi Audit Log hành động KHÓA
        const targetName = this.khachHang.tenKhachHang || this.khachHang.hoTen || targetId;
        this.quanTriService.ghiAuditLog(
          'KHÓA TÀI KHOẢN',
          `Khóa tài khoản khách hàng [${targetName}] - Lý do: ${this.khachHang.lyDoKhoa}`
        ).subscribe();

        this.hienModalKhoa = false;
        this.lyDoKhoaInput = '';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        alert(err.error?.message || 'Không thể khóa tài khoản');
      }
    });
  }

  dongModalKhoa(): void {
    this.hienModalKhoa = false;
    this.lyDoKhoaInput = '';
  }

  chonLyDoMau(lyDo: string): void {
    this.lyDoKhoaInput = lyDo;
  }
  
  // ========================================
  // 6. QUẢN LÝ ĐÁNH GIÁ
  // ========================================

  toggleHienThiDanhGia(item: any): void {
    const dangHienThi = item.trangThai === 'hien_thi';
    const isHienThiMoi = !dangHienThi;
    const reviewId = item._id;

    if (reviewId) {
      this.quanTriService.capNhatHienThiDanhGia(reviewId, isHienThiMoi).subscribe({
        next: () => {
          item.trangThai = isHienThiMoi ? 'hien_thi' : 'an';
          item.isHienThi = isHienThiMoi;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Lỗi cập nhật trạng thái đánh giá:', err);
          alert(err.error?.message || 'Không thể cập nhật trạng thái đánh giá');
        }
      });
    } else {
      item.trangThai = isHienThiMoi ? 'hien_thi' : 'an';
      item.isHienThi = isHienThiMoi;
    }
  }

  cuonNgangSangPhai(element: HTMLElement): void {
    element.scrollBy({ left: 310, behavior: 'smooth' });
  }

  // ========================================
  // 7. ĐỊNH DẠNG TRẠNG THÁI VÀ TIỀN
  // ========================================

  formatTrangThaiDonHang(order: any): string {
    const status = order.trangThaiDonHang || order.trangThai;

    if (status === 'thanh_cong' || status === 'Thành công') {
      return 'Thành công';
    }

    if (status === 'da_huy' || status === 'Đã hủy') {
      return 'Đã hủy';
    }

    if (status === 'hoan_tien' || status === 'Đã hoàn tiền') {
      return 'Đã hoàn tiền';
    }

    return status;
  }

  formatTrangThaiHoanTien(trangThai: string | undefined): string {
    switch (trangThai) {
      case 'cho_xu_ly':
      case 'pending':
        return 'Chờ xử lý';

      case 'hoan_tien':
      case 'approved':
        return 'Đã hoàn tiền';

      case 'tu_choi':
      case 'rejected':
        return 'Đã từ chối';

      default:
        return 'Không xác định';
    }
  }

  dinhDangTien(val: number): string {
    return new Intl.NumberFormat('vi-VN').format(val || 0) + 'đ';
  }

  // ========================================
  // 8. XEM CHI TIẾT YÊU CẦU HOÀN TIỀN
  // ========================================

  moModalChiTietHoanTien(rfItem: RefundRequestView): void {
    this.thongTinHoanTienChon = rfItem;
    this.hienModalHoanTien = true;
  }

  dongModalHoanTien(): void {
    this.hienModalHoanTien = false;
    this.thongTinHoanTienChon = null;
  }

  // ========================================
  // 9. ADMIN DUYỆT HOÀN TIỀN
  // ========================================

  pheDuyetYeuCauHoanTien(): void {
    const refund = this.thongTinHoanTienChon;

    if (!refund?._id) {
      alert('Không tìm thấy mã yêu cầu hoàn tiền');
      return;
    }

    if (refund.trangThaiDonHang !== 'cho_xu_ly') {
      alert('Yêu cầu này đã được xử lý trước đó');
      return;
    }

    const xacNhan = confirm(
      `Bạn có chắc chắn muốn duyệt hoàn tiền cho game ${refund.tenGame}?`
    );

    if (!xacNhan) return;

    this.quanTriService.pheDuyetRefund(refund._id).subscribe({
      next: (res: any) => {
        alert(res.message || 'Duyệt hoàn tiền thành công');

        this.dongModalHoanTien();
        this.taiChiTietKhachHang();
      },
      error: (err: any) => {
        alert(
          err.error?.message || 'Không thể duyệt yêu cầu hoàn tiền'
        );
      }
    });
  }

  // ========================================
  // 10. ADMIN TỪ CHỐI HOÀN TIỀN
  // ========================================

  tuChoiYeuCauHoanTien(): void {
    const refund = this.thongTinHoanTienChon;

    if (!refund?._id) {
      alert('Không tìm thấy mã yêu cầu hoàn tiền');
      return;
    }

    if (refund.trangThaiDonHang !== 'cho_xu_ly') {
      alert('Yêu cầu này đã được xử lý trước đó');
      return;
    }

    const lyDo = prompt('Nhập lý do từ chối yêu cầu hoàn tiền:');

    if (lyDo === null) return;

    if (!lyDo.trim()) {
      alert('Vui lòng nhập lý do từ chối');
      return;
    }

    this.quanTriService.tuChoiRefund(
      refund._id,
      lyDo.trim()
    ).subscribe({
      next: (res: any) => {
        alert(res.message || 'Từ chối yêu cầu hoàn tiền thành công');

        this.dongModalHoanTien();
        this.taiChiTietKhachHang();
      },
      error: (err: any) => {
        alert(
          err.error?.message || 'Không thể từ chối yêu cầu hoàn tiền'
        );
      }
    });
  }
}