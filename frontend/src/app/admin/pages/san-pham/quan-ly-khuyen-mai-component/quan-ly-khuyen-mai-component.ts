import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

interface KhuyenMai {
  id: string;
  maKhuyenMai: string;
  moTa: string;
  phanTramGiamGia: number;
  ngayBatDau: string;
  ngayKetThuc: string | null;
  daSuDung: number;
  trangThai: boolean;
  chiApDungLanDau: boolean;
}

interface PromotionApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

type TabKhuyenMai = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-quan-ly-khuyen-mai-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-khuyen-mai-component.html',
  styleUrl: './quan-ly-khuyen-mai-component.css'
})
export class QuanLyKhuyenMaiComponent implements OnInit {

  private readonly API_URL =
    'http://localhost:3000/api/store/promotions';

  readonly soMaMoiTrang = 10;

  tabDangChon: TabKhuyenMai = 'all';

  tuKhoa = '';
  tuKhoaDaApDung = '';

  ngayBatDauLoc = '';
  ngayKetThucLoc = '';

  ngayBatDauDaApDung = '';
  ngayKetThucDaApDung = '';

  moDropdownHieuLuc = false;

  trangHienTai = 1;

  maKhuyenMaiDuocChon = new Set<string>();

  hienXacNhanXoa = false;
  idsChoXoa: string[] = [];

  thongBao = '';
  dangTai = false;

  private timeoutThongBao?: ReturnType<typeof setTimeout>;

  // Dữ liệu sẽ được lấy trực tiếp từ MongoDB
  danhSachKhuyenMai: KhuyenMai[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  // ========================================
  // KHỞI TẠO
  // ========================================

  ngOnInit(): void {
    this.taiDanhSachKhuyenMai();
  }

  // ========================================
  // CHUYỂN DỮ LIỆU BACKEND THÀNH DỮ LIỆU FRONTEND
  // ========================================

  private chuyenDuLieuBackend(data: any): KhuyenMai {
    return {
      id: String(data._id),
      maKhuyenMai: data.maKhuyenMai || '',
      moTa: data.moTa || '',
      phanTramGiamGia: Number(data.phanTramGiamGia || 0),
      ngayBatDau: data.ngayBatDau,
      ngayKetThuc: data.ngayKetThuc || null,
      daSuDung: Number(data.daSuDung || 0),
      trangThai: data.trangThai === true,
      chiApDungLanDau: data.chiApDungLanDau === true
    };
  }

  // ========================================
  // 1. LẤY DANH SÁCH KHUYẾN MÃI TỪ BACKEND
  // GET /api/store/promotions
  // ========================================

  async taiDanhSachKhuyenMai(): Promise<void> {
  this.dangTai = true;

  try {
    const response = await firstValueFrom(
      this.http.get<PromotionApiResponse>(this.API_URL)
    );

    if (!response.success || !Array.isArray(response.data)) {
      throw new Error(
        response.message || 'Dữ liệu khuyến mãi không hợp lệ'
      );
    }

    this.danhSachKhuyenMai = response.data.map(
      (item: any) => this.chuyenDuLieuBackend(item)
    );

    this.cdr.detectChanges();

    const idHopLe = new Set(
      this.danhSachKhuyenMai.map(ma => ma.id)
    );

    this.maKhuyenMaiDuocChon = new Set(
      [...this.maKhuyenMaiDuocChon].filter(
        id => idHopLe.has(id)
      )
    );

    this.trangHienTai = Math.min(
      this.trangHienTai,
      this.tongTrang
    );

  } catch (error: any) {
    console.error('Lỗi lấy danh sách khuyến mãi:', error);

    this.hienThongBao(
      error?.error?.message ||
      error?.message ||
      'Không thể tải danh sách khuyến mãi'
    );

  } finally {
    this.dangTai = false;
    this.cdr.detectChanges();
  }
}

  // ========================================
  // GETTERS
  // ========================================

  get danhSachSauLoc(): KhuyenMai[] {
    const keyword = this.chuanHoa(this.tuKhoaDaApDung);

    const start = this.ngayBatDauDaApDung
      ? new Date(
          `${this.ngayBatDauDaApDung}T00:00:00`
        ).getTime()
      : null;

    const end = this.ngayKetThucDaApDung
      ? new Date(
          `${this.ngayKetThucDaApDung}T23:59:59`
        ).getTime()
      : null;

    return this.danhSachKhuyenMai
      .filter(ma => {
        const matchKeyword =
          !keyword ||
          this.chuanHoa(ma.maKhuyenMai).includes(keyword);

        const active = ma.trangThai;

        const matchTab =
          this.tabDangChon === 'all' ||
          (
            this.tabDangChon === 'active'
              ? active
              : !active
          );

        const startTime = new Date(ma.ngayBatDau).getTime();

        const endTime = ma.ngayKetThuc
          ? new Date(ma.ngayKetThuc).getTime()
          : Infinity;

        const matchDate =
          (start === null || endTime >= start) &&
          (end === null || startTime <= end);

        return matchKeyword && matchTab && matchDate;
      })
      .sort(
        (a, b) =>
          new Date(b.ngayBatDau).getTime() -
          new Date(a.ngayBatDau).getTime()
      );
  }

  get tongMaSauLoc(): number {
    return this.danhSachSauLoc.length;
  }

  get tongTrang(): number {
    return Math.max(
      1,
      Math.ceil(this.tongMaSauLoc / this.soMaMoiTrang)
    );
  }

  get maHienThi(): KhuyenMai[] {
    const start =
      (this.trangHienTai - 1) * this.soMaMoiTrang;

    return this.danhSachSauLoc.slice(
      start,
      start + this.soMaMoiTrang
    );
  }

  get danhSachTrang(): number[] {
    return Array.from(
      { length: this.tongTrang },
      (_, i) => i + 1
    );
  }

  get trangDaChonHet(): boolean {
    return (
      this.maHienThi.length > 0 &&
      this.maHienThi.every(
        x => this.maKhuyenMaiDuocChon.has(x.id)
      )
    );
  }

  get trangChonMotPhan(): boolean {
    return (
      this.maHienThi.some(
        x => this.maKhuyenMaiDuocChon.has(x.id)
      ) &&
      !this.trangDaChonHet
    );
  }

  // ========================================
  // KIỂM TRA TRẠNG THÁI HIỆU LỰC
  // ========================================

  dangHieuLuc(ma: KhuyenMai): boolean {
    if (!ma.trangThai) {
      return false;
    }

    const now = Date.now();

    const startTime = new Date(ma.ngayBatDau).getTime();

    const endTime = ma.ngayKetThuc
      ? new Date(ma.ngayKetThuc).getTime()
      : Infinity;

    return (
      now >= startTime &&
      now <= endTime
    );
  }

  // ========================================
  // LỌC VÀ TÌM KIẾM
  // ========================================

  chonTab(tab: TabKhuyenMai): void {
    this.tabDangChon = tab;
    this.trangHienTai = 1;
  }

  apDungBoLoc(): void {
    this.tuKhoaDaApDung = this.tuKhoa.trim();

    this.ngayBatDauDaApDung = this.ngayBatDauLoc;
    this.ngayKetThucDaApDung = this.ngayKetThucLoc;

    this.trangHienTai = 1;
    this.moDropdownHieuLuc = false;
  }

  datLaiBoLoc(): void {
    this.tuKhoa = '';
    this.tuKhoaDaApDung = '';

    this.ngayBatDauLoc = '';
    this.ngayKetThucLoc = '';

    this.ngayBatDauDaApDung = '';
    this.ngayKetThucDaApDung = '';

    this.tabDangChon = 'all';
    this.trangHienTai = 1;
    this.moDropdownHieuLuc = false;
  }

  doiTrang(trang: number): void {
    if (trang >= 1 && trang <= this.tongTrang) {
      this.trangHienTai = trang;
    }
  }

  // ========================================
  // CHỌN MÃ KHUYẾN MÃI
  // ========================================

  doiChonMa(id: string, event: Event): void {
    const checked =
      (event.target as HTMLInputElement).checked;

    const next = new Set(this.maKhuyenMaiDuocChon);

    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }

    this.maKhuyenMaiDuocChon = next;
  }

  doiChonTatCaTrang(event: Event): void {
    const checked =
      (event.target as HTMLInputElement).checked;

    const next = new Set(this.maKhuyenMaiDuocChon);

    this.maHienThi.forEach(x => {
      if (checked) {
        next.add(x.id);
      } else {
        next.delete(x.id);
      }
    });

    this.maKhuyenMaiDuocChon = next;
  }

  // ========================================
  // 2. BẬT / TẮT MÃ KHUYẾN MÃI
  // PATCH /api/store/promotions/:id/status
  // ========================================

  async doiTrangThai(ma: KhuyenMai): Promise<void> {
  const trangThaiMoi = !ma.trangThai;

  try {
    const response = await firstValueFrom(
      this.http.patch<PromotionApiResponse>(
        `${this.API_URL}/${ma.id}/status`,
        {
          trangThai: trangThaiMoi
        }
      )
    );

    if (!response.success || !response.data) {
      throw new Error(
        response.message || 'Không thể thay đổi trạng thái'
      );
    }

    // Cập nhật dữ liệu theo kết quả Backend trả về
    const maCapNhat = this.chuyenDuLieuBackend(
      response.data
    );

    this.danhSachKhuyenMai =
      this.danhSachKhuyenMai.map(x =>
        x.id === ma.id ? maCapNhat : x
      );

    this.cdr.detectChanges();

    this.hienThongBao(
      trangThaiMoi
        ? `Đã kích hoạt mã ${ma.maKhuyenMai}`
        : `Đã tắt mã ${ma.maKhuyenMai}`
    );

  } catch (error: any) {
    console.error('Lỗi đổi trạng thái:', error);

    this.hienThongBao(
      error?.error?.message ||
      error?.message ||
      'Không thể thay đổi trạng thái khuyến mãi'
    );

  } finally {
    this.cdr.detectChanges();
  }
}

  // ========================================
  // 3. XÓA MÃ KHUYẾN MÃI
  // DELETE /api/store/promotions/:id
  // ========================================

  xacNhanXoaMot(ma: KhuyenMai): void {
    this.idsChoXoa = [ma.id];
    this.hienXacNhanXoa = true;
  }

  xacNhanXoaDaChon(): void {
    if (!this.maKhuyenMaiDuocChon.size) {
      return;
    }

    this.idsChoXoa = [
      ...this.maKhuyenMaiDuocChon
    ];

    this.hienXacNhanXoa = true;
  }

  huyXoa(): void {
    this.hienXacNhanXoa = false;
    this.idsChoXoa = [];
  }

  async thucHienXoa(): Promise<void> {
    if (!this.idsChoXoa.length) {
      return;
    }

    const ids = [...this.idsChoXoa];

    let soLuongXoaThanhCong = 0;
    let soLuongXoaThatBai = 0;

    for (const id of ids) {
      try {
        const response = await firstValueFrom(
          this.http.delete<PromotionApiResponse>(
            `${this.API_URL}/${id}`
          )
        );

        if (response.success) {
          soLuongXoaThanhCong++;
        } else {
          soLuongXoaThatBai++;
        }

      } catch (error) {
        console.error(`Lỗi xóa mã ${id}:`, error);
        soLuongXoaThatBai++;
      }
    }

    this.hienXacNhanXoa = false;
    this.idsChoXoa = [];

    await this.taiDanhSachKhuyenMai();

    this.trangHienTai = Math.min(
      this.trangHienTai,
      this.tongTrang
    );

    if (soLuongXoaThatBai === 0) {
      this.maKhuyenMaiDuocChon = new Set();

      this.hienThongBao(
        `Đã xóa ${soLuongXoaThanhCong} mã khuyến mãi thành công`
      );
    } else {
      this.hienThongBao(
        `Đã xóa ${soLuongXoaThanhCong} mã, thất bại ${soLuongXoaThatBai} mã`
      );
    }
  }

  // ========================================
  // ĐIỀU HƯỚNG
  // ========================================

  moChiTiet(ma: KhuyenMai): void {
    this.router.navigate([
      '/admin/promotions',
      ma.id
    ]);
  }

  moTaoKhuyenMai(): void {
    this.router.navigate([
      '/admin/promotions/tao-moi'
    ]);
  }

  // ========================================
  // XUẤT FILE CSV
  // ========================================

  xuatCsv(): void {
    const rows = [
      [
        'Mã khuyến mãi',
        'Mô tả',
        'Mức giảm (%)',
        'Ngày bắt đầu',
        'Ngày kết thúc',
        'Trạng thái',
        'Đã sử dụng'
      ],

      ...this.danhSachSauLoc.map(x => [
        x.maKhuyenMai,
        x.moTa,
        String(x.phanTramGiamGia),
        x.ngayBatDau
          ? x.ngayBatDau.replace('T', ' ')
          : '',
        x.ngayKetThuc
          ? x.ngayKetThuc.replace('T', ' ')
          : 'Không giới hạn',
        this.dangHieuLuc(x)
          ? 'Đang có hiệu lực'
          : 'Không có hiệu lực',
        String(x.daSuDung)
      ])
    ];

    const csv =
      '\uFEFF' +
      rows
        .map(row =>
          row
            .map(v =>
              `"${String(v).replace(/"/g, '""')}"`
            )
            .join(',')
        )
        .join('\r\n');

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');

    a.href = url;
    a.download = 'danh-sach-khuyen-mai.csv';
    a.click();

    URL.revokeObjectURL(url);
  }

  // ========================================
  // ĐỊNH DẠNG NGÀY GIỜ
  // ========================================

  dinhDangNgay(value: string | null): string {
    if (!value) {
      return 'Không giới hạn';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(value));
  }

  dinhDangGio(value: string | null): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(value));
  }

  // ========================================
  // HÀM HỖ TRỢ
  // ========================================

  private chuanHoa(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private hienThongBao(message: string): void {
    this.thongBao = message;

    if (this.timeoutThongBao) {
      clearTimeout(this.timeoutThongBao);
    }

    this.timeoutThongBao = setTimeout(() => {
      this.thongBao = '';
    }, 3000);
  }
}