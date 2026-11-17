import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { QuanTri } from '../../../../services/quan-tri';

export interface ItemSanPham {
  tenGame: string;
  soLuong: number;
  donGia: number;
  giamGia: number;
  thanhTien: number;
}

export interface DonHangChiTiet {
  maDonHang: string;
  nhanVienTao?: string;
  ngayTao: string;
  trangThai: 'thanh_cong' | 'da_huy';

  khachHang: {
    maTaiKhoan: string;
    tenTaiKhoan: string;
    email: string;
    soDienThoai: string;
  };

  nguoiNhan: {
    maTaiKhoan: string;
    tenTaiKhoan: string;
  };

  danhSachSanPham: ItemSanPham[];
  sanPhamKhac: ItemSanPham[];

  thanhToan: {
    phuongThuc: string;
    maGiaoDich: string;
    tongTienHang: number;
    giamGia: number;
    tongTienPhaiTra: number;
    daThanhToan: number;
    daHoanTra: number;
  };

  xuLyHoanTien?: {
    idYeuCau: string;
    maTaiKhoanYeuCau: string;
    ngayYeuCau: string;
    lyDoKhachHang: string;
    trangThaiXuLy:
      | 'cho_xu_ly'
      | 'da_hoan_tien'
      | 'tu_choi_hoan_tien';
    lyDoTuChoi?: string;
    ngayXuLy?: string;
    ngayHoanTien?: string;
    soTienHoan: number;
  };
}

@Component({
  selector: 'app-chi-tiet-don-hang',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chi-tiet-don-hang-component.html',
  styleUrls: ['./chi-tiet-don-hang-component.css']
})
export class ChiTietDonHangComponent implements OnInit, OnDestroy {

  donHang!: DonHangChiTiet;

  isLoading: boolean = false;
  errorMessage: string = '';

  private refundId: string = '';
  private currentOrderId: string = '';

  private subscriptions = new Subscription();

  showApproveModal: boolean = false;
  showRejectModal: boolean = false;
  showSuccessModal: boolean = false;

  successMessage: string = '';
  lyDoTuChoiInput: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quanTri: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.paramMap.subscribe(params => {
        const id = params.get('id') || '';
        this.loadOrderData(id);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ========================================
  // LẤY CHI TIẾT ĐƠN HÀNG TỪ BACKEND
  // ========================================

  loadOrderData(id: string): void {
    if (!id) {
      this.router.navigate(['/admin/orders']);
      return;
    }

    this.currentOrderId = id;
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.quanTri.layChiTietDonHangAdmin(id).subscribe({
        next: (data) => {
          try {
            this.donHang = this.buildOrderDetail(data);
            this.refundId = data.refund?._id || '';
            this.errorMessage = '';
          } catch (err) {
            console.error('Lỗi chuyển đổi dữ liệu đơn hàng:', err);
            this.errorMessage = 'Có lỗi khi hiển thị chi tiết đơn hàng.';
          } finally {
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Lỗi tải chi tiết đơn hàng:', err);
          this.errorMessage =
            err.error?.message ||
            'Không tìm thấy thông tin đơn hàng hoặc yêu cầu hoàn tiền.';
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Chuyển đổi dữ liệu từ API Admin /admin/orders/:id sang giao diện
  private buildOrderDetail(data: any): DonHangChiTiet {
    const order = data.order || {};
    const buyer = data.buyer || {};
    const refund = data.refund || null;
    const danhSachSP = Array.isArray(data.danhSachSanPham)
      ? data.danhSachSanPham
      : [];

    const orderStatus: 'thanh_cong' | 'da_huy' =
      order.trangThai === 'cancelled' ? 'da_huy' : 'thanh_cong';

    // RefundRequest chỉ yêu cầu hoàn 1 game, không phải toàn bộ giỏ hàng.
    const maGameHoan = String(refund?.maGame || '');
    const sanPhamYeuCau = refund
      ? danhSachSP.find((sp: any) => String(sp.maGame) === maGameHoan)
      : null;

    if (refund && !sanPhamYeuCau) {
      throw new Error('Không tìm thấy game của yêu cầu hoàn tiền trong đơn hàng');
    }

    const chuyenSanPham = (sp: any): ItemSanPham => ({
      tenGame: sp.tenGame || 'Không có tên',
      soLuong: 1,
      donGia: Number(sp.donGia) || 0,
      giamGia: Number(sp.giamGia) || 0,
      thanhTien: Number(sp.thanhTien ?? sp.donGia) || 0
    });

    // Bảng "Game được yêu cầu hoàn tiền": chỉ chứa game có mã trùng yêu cầu.
    const items: ItemSanPham[] = (
      refund ? [sanPhamYeuCau] : danhSachSP
    ).map(chuyenSanPham);

    // Nếu hóa đơn có các game khác (ví dụ quà tặng), liệt kê riêng.
    const sanPhamKhac: ItemSanPham[] = refund
      ? danhSachSP
          .filter((sp: any) => String(sp.maGame) !== maGameHoan)
          .map(chuyenSanPham)
      : [];

    // Giá một game, không dùng tổng tiền của toàn bộ đơn hàng.
    const giaGameYeuCau = Number(sanPhamYeuCau?.thanhTien ?? sanPhamYeuCau?.donGia) || 0;
    const soTienHoanHienThi = refund?.trangThaiHoanTien === 'approved'
      ? Math.max(0, Number(refund.soTienHoan) || 0)
      : giaGameYeuCau;

    const tongTien = Number(order.tongTien) || 0;
    const soTienGiam = Number(order.soTienGiam) || 0;
    const tongTienGoc = Number(order.tongTienGoc) || (tongTien + soTienGiam);

    let xuLyHoanTien: DonHangChiTiet['xuLyHoanTien'] = undefined;

    if (refund) {
      let refundStatus: 'cho_xu_ly' | 'da_hoan_tien' | 'tu_choi_hoan_tien' =
        'cho_xu_ly';

      if (refund.trangThaiHoanTien === 'approved') {
        refundStatus = 'da_hoan_tien';
      } else if (refund.trangThaiHoanTien === 'rejected') {
        refundStatus = 'tu_choi_hoan_tien';
      }

      xuLyHoanTien = {
        idYeuCau: refund.maYeuCau || '',
        maTaiKhoanYeuCau: refund.maTaiKhoan || order.maTaiKhoan || '',
        ngayYeuCau: this.formatDate(refund.ngayYeuCau || refund.createdAt),
        lyDoKhachHang: refund.lyDoKhachHang || 'Không có lý do',
        trangThaiXuLy: refundStatus,
        lyDoTuChoi: refund.lyDoTuChoi || '',
        ngayXuLy: refund.ngayXuLy ? this.formatDate(refund.ngayXuLy) : '',
        ngayHoanTien: refund.ngayHoanTien
          ? this.formatDate(refund.ngayHoanTien)
          : '',
        soTienHoan: soTienHoanHienThi
      };
    }

    return {
      maDonHang: order.maDonHang || 'Không xác định',
      ngayTao: this.formatDate(order.createdAt),
      trangThai: orderStatus,
      khachHang: {
        maTaiKhoan: buyer.maTaiKhoan || order.maTaiKhoan || '',
        tenTaiKhoan: buyer.tenDangNhap || buyer.hoTen || 'Khách hàng',
        email: buyer.email || 'Chưa cập nhật',
        soDienThoai: buyer.soDienThoai || 'Chưa cập nhật'
      },
      nguoiNhan: {
        maTaiKhoan: buyer.maTaiKhoan || order.maTaiKhoan || '',
        tenTaiKhoan: buyer.tenDangNhap || buyer.hoTen || 'Khách hàng'
      },
      danhSachSanPham: items,
      sanPhamKhac,
      thanhToan: {
        phuongThuc: order.phuongThucThanhToan || 'Ví STEAL',
        maGiaoDich: order._id || '',
        tongTienHang: tongTienGoc,
        giamGia: soTienGiam,
        tongTienPhaiTra: tongTien,
        daThanhToan: tongTien,
        daHoanTra: refund?.trangThaiHoanTien === 'approved' ? soTienHoanHienThi : 0
      },
      xuLyHoanTien
    };
  }

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }

  // ========================================
  // PHÊ DUYỆT HOÀN TIỀN
  // ========================================

  openApproveModal(): void {
    if (
      !this.donHang?.xuLyHoanTien ||
      this.donHang.xuLyHoanTien.trangThaiXuLy !== 'cho_xu_ly'
    ) {
      return;
    }
    this.showApproveModal = true;
  }

  closeApproveModal(): void {
    this.showApproveModal = false;
  }

  confirmApprove(): void {
    if (!this.refundId) {
      alert('Không tìm thấy mã yêu cầu hoàn tiền để phê duyệt.');
      return;
    }

    this.subscriptions.add(
      this.quanTri.pheDuyetRefund(this.refundId).subscribe({
        next: (response) => {
          if (!response.success) {
            this.errorMessage =
              response.message || 'Không thể phê duyệt yêu cầu hoàn tiền.';
            this.showApproveModal = false;
            return;
          }

          this.showApproveModal = false;
          this.loadOrderData(this.currentOrderId);
          this.successMessage = 'Phê duyệt yêu cầu hoàn tiền thành công!';
          this.showSuccessModal = true;
        },
        error: (error) => {
          console.error('Lỗi phê duyệt hoàn tiền:', error);
          this.errorMessage =
            error.error?.message ||
            'Không thể phê duyệt yêu cầu hoàn tiền. Vui lòng thử lại.';
          this.showApproveModal = false;
        }
      })
    );
  }

  // ========================================
  // TỪ CHỐI HOÀN TIỀN
  // ========================================

  openRejectModal(): void {
    if (
      !this.donHang?.xuLyHoanTien ||
      this.donHang.xuLyHoanTien.trangThaiXuLy !== 'cho_xu_ly'
    ) {
      return;
    }
    this.lyDoTuChoiInput = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
  }

  confirmReject(): void {
    if (!this.refundId) {
      alert('Không tìm thấy mã yêu cầu hoàn tiền để từ chối.');
      return;
    }

    const reason = this.lyDoTuChoiInput.trim();
    if (!reason) {
      alert('Vui lòng nhập lý do từ chối hoàn tiền.');
      return;
    }

    this.subscriptions.add(
      this.quanTri.tuChoiRefund(this.refundId, reason).subscribe({
        next: (response) => {
          if (!response.success) {
            this.errorMessage =
              response.message || 'Không thể từ chối yêu cầu hoàn tiền.';
            this.showRejectModal = false;
            return;
          }

          this.showRejectModal = false;
          this.loadOrderData(this.currentOrderId);
          this.successMessage = 'Từ chối yêu cầu hoàn tiền thành công!';
          this.showSuccessModal = true;
        },
        error: (error) => {
          console.error('Lỗi từ chối hoàn tiền:', error);
          this.errorMessage =
            error.error?.message ||
            'Không thể từ chối yêu cầu hoàn tiền. Vui lòng thử lại.';
          this.showRejectModal = false;
        }
      })
    );
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + 'đ';
  }

  private formatDate(value: string | Date): string {
    if (!value) return 'Không có dữ liệu';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  get tongSoLuongSanPham(): number {
    if (!this.donHang?.danhSachSanPham) return 0;
    return this.donHang.danhSachSanPham.reduce(
      (acc, item) => acc + item.soLuong,
      0
    );
  }
}