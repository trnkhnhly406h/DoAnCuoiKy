
import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { QuanTri } from '../../../services/quan-tri';

export type TrangThaiDonHang =
  | 'thanh_cong'
  | 'cho_xu_ly'
  | 'da_hoan_tien'
  | 'tu_choi_hoan_tien';

export type TabDonHang = 'tat_ca' | TrangThaiDonHang;

export interface DonHang {
  idDonHang: string;
  idYeuCau: string;
  maYeuCau: string;
  maDonHang: string;
  tenKhachHang: string;
  tenGame: string;
  tongTien: number;
  soTienHoanDuKien: number;
  soTienHoan: number;
  phuongThucThanhToan: string;
  ngayTao: string;
  trangThai: TrangThaiDonHang;
}

@Component({
  selector: 'app-quan-ly-don-hang-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-don-hang-component.html',
  styleUrl: './quan-ly-don-hang-component.css'
})
export class QuanLyDonHangComponent implements OnInit, OnDestroy {

  readonly soDonHangMoiTrang = 10;

  readonly tabs: {
    key: TabDonHang;
    label: string;
  }[] = [
    { key: 'tat_ca', label: 'Tất cả đơn hàng' },
    { key: 'thanh_cong', label: 'Thành công' },
    { key: 'cho_xu_ly', label: 'Chờ xử lý' },
    { key: 'da_hoan_tien', label: 'Đã hoàn tiền' },
    {
      key: 'tu_choi_hoan_tien',
      label: 'Từ chối hoàn tiền'
    }
  ];

  danhSachDonHang: DonHang[] = [];

  dangTaiDuLieu = false;
  loiTaiDuLieu = '';

  tuKhoa = '';
  tuKhoaDangApDung = '';

  phuongThucLoc = '';
  phuongThucDangApDung = '';

  sapXep:
    | 'moi_nhat'
    | 'cu_nhat'
    | 'gia_tang'
    | 'gia_giam' = 'moi_nhat';

  tabDangChon: TabDonHang = 'tat_ca';
  trangHienTai = 1;

  private dataSub?: Subscription;
  private querySub?: Subscription;

  constructor(
    private router: Router,
    private quanTriService: QuanTri,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.querySub = this.route.queryParamMap.subscribe(
      params => {
        const tab = params.get('tab');

        if (this.tabs.some(x => x.key === tab)) {
          this.tabDangChon = tab as TabDonHang;
        } else {
          this.tabDangChon = 'tat_ca';
        }

        this.trangHienTai = 1;
      }
    );

    this.taiDanhSachDonHang();
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  // =====================================
  // TẢI ĐƠN HÀNG THẬT TỪ MONGODB
  // =====================================

  taiDanhSachDonHang(): void {
    this.dangTaiDuLieu = true;
    this.loiTaiDuLieu = '';

    this.dataSub?.unsubscribe();

    this.dataSub = this.quanTriService
      .layDanhSachDonHangAdmin()
      .subscribe({
        next: (data: DonHang[]) => {
          this.danhSachDonHang = data;
          this.dangTaiDuLieu = false;
          this.trangHienTai = 1;

          this.cdr.detectChanges();
        },

        error: error => {
          console.error(
            'Lỗi tải danh sách đơn hàng:',
            error
          );

          this.loiTaiDuLieu =
            error?.error?.message ||
            'Không thể tải danh sách đơn hàng. Kiểm tra Backend và quyền Admin.';

          this.danhSachDonHang = [];
          this.dangTaiDuLieu = false;

          this.cdr.detectChanges();
        }
      });
  }

  // =====================================
  // DANH SÁCH PHƯƠNG THỨC THANH TOÁN
  // =====================================

  get cacPhuongThuc(): string[] {
    return [
      ...new Set(
        this.danhSachDonHang
          .map(d => d.phuongThucThanhToan)
          .filter(Boolean)
      )
    ].sort();
  }

  // =====================================
  // LỌC THEO TAB, TỪ KHÓA, THANH TOÁN
  // =====================================

  get danhSachSauLoc(): DonHang[] {
    const keyword = this.tuKhoaDangApDung
      .trim()
      .toLocaleLowerCase('vi');

    const payment =
      this.phuongThucDangApDung.toLowerCase();

    const result = this.danhSachDonHang.filter(d => {
      const matchKeyword =
        !keyword ||
        [
          d.maDonHang,
          d.maYeuCau,
          d.tenKhachHang,
          d.tenGame
        ].some(value =>
          String(value || '')
            .toLocaleLowerCase('vi')
            .includes(keyword)
        );

      const matchTab =
        this.tabDangChon === 'tat_ca' ||
        d.trangThai === this.tabDangChon;

      const matchPayment =
        !payment ||
        d.phuongThucThanhToan.toLowerCase() === payment;

      return matchKeyword && matchTab && matchPayment;
    });

    result.sort((a, b) => {
      if (this.sapXep === 'gia_tang') {
        return a.tongTien - b.tongTien;
      }

      if (this.sapXep === 'gia_giam') {
        return b.tongTien - a.tongTien;
      }

      const delta =
        (new Date(b.ngayTao).getTime() || 0) -
        (new Date(a.ngayTao).getTime() || 0);

      return this.sapXep === 'cu_nhat' ? -delta : delta;
    });

    return result;
  }

  // =====================================
  // PHÂN TRANG
  // =====================================

  get danhSachTrangHienTai(): DonHang[] {
    const start =
      (this.trangHienTai - 1) *
      this.soDonHangMoiTrang;

    return this.danhSachSauLoc.slice(
      start,
      start + this.soDonHangMoiTrang
    );
  }

  get tongSoTrang(): number {
    return Math.max(
      1,
      Math.ceil(
        this.danhSachSauLoc.length /
        this.soDonHangMoiTrang
      )
    );
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

  // =====================================
  // CHUYỂN TAB
  // =====================================

  chonTab(tab: TabDonHang): void {
    this.tabDangChon = tab;
    this.trangHienTai = 1;

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  // =====================================
  // TÌM KIẾM, LỌC, ĐẶT LẠI
  // =====================================

  apDungBoLoc(): void {
    this.tuKhoaDangApDung = this.tuKhoa;
    this.phuongThucDangApDung = this.phuongThucLoc;
    this.trangHienTai = 1;
  }

  datLaiBoLoc(): void {
    this.tuKhoa = '';
    this.tuKhoaDangApDung = '';

    this.phuongThucLoc = '';
    this.phuongThucDangApDung = '';

    this.sapXep = 'moi_nhat';
    this.chonTab('tat_ca');
  }

  // =====================================
  // XEM CHI TIẾT
  // =====================================

  moChiTiet(don: DonHang): void {
    // API hỗ trợ cả ID yêu cầu hoàn tiền và ID đơn hàng
    this.router.navigate([
      '/admin/orders',
      don.idYeuCau || don.idDonHang
    ]);
  }

  // =====================================
  // HIỂN THỊ TRẠNG THÁI
  // =====================================

  nhanTrangThai(status: TrangThaiDonHang): string {
    const labels: Record<TrangThaiDonHang, string> = {
      thanh_cong: 'Thành công',
      cho_xu_ly: 'Chờ xử lý',
      da_hoan_tien: 'Đã hoàn tiền',
      tu_choi_hoan_tien: 'Từ chối hoàn tiền'
    };

    return labels[status];
  }

  dinhDangTien(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  nhanPhuongThuc(value: string): string {
    const key = value.toLowerCase();

    return key === 'wallet' ? 'Ví STEAL' : value;
  }

  // =====================================
  // XUẤT CSV DÙNG ĐƯỢC TRONG EXCEL
  // =====================================

  xuatCsv(): void {
    const headers = [
      'Mã đơn hàng',
      'Khách hàng',
      'Tên game',
      'Tổng tiền',
      'Phương thức thanh toán',
      'Trạng thái',
      'Ngày tạo'
    ];

    const rows = this.danhSachSauLoc.map(d => [
      d.maDonHang,
      d.tenKhachHang,
      d.tenGame,
      d.tongTien,
      d.phuongThucThanhToan,
      this.nhanTrangThai(d.trangThai),
      d.ngayTao
    ]);

    const escapeCell = (value: unknown): string => {
      let raw = String(value ?? '');

      if (
        /^[\s]*[=+@-]/.test(raw) &&
        typeof value === 'string'
      ) {
        raw = "'" + raw;
      }

      return '"' + raw.replace(/"/g, '""') + '"';
    };

    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(escapeCell).join(','))
        .join('\r\n');

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: 'text/csv;charset=utf-8'
      })
    );

    const link = document.createElement('a');

    link.href = url;
    link.download = 'danh-sach-don-hang.csv';
    link.click();

    URL.revokeObjectURL(url);
  }
}
