import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';
import { Router } from '@angular/router';
import { Chart, registerables, TooltipItem } from 'chart.js';
import { QuanTri } from '../../../services/quan-tri';

Chart.register(...registerables);

type KhoangThongKe = 'week' | 'month' | 'quarter' | 'custom';
type KhoangBieuDo = 'today' | 'week' | 'month' | 'threeMonths' | 'year';
type LoaiBieuDo = 'both' | 'revenue' | 'orders';

interface DonHang {
  maDonHang: string;
  tenGame: string;
  gameId?: string;
  tongTien: number;
  phuongThuc: string;
  trangThai: string;
  ngayTao: string;
}

interface GameBanChay {
  id: string;
  tenGame: string;
  luotBan: number;
  hinhAnh: string;
}

interface KhachHang {
  maTaiKhoan: string;
  tenKhachHang?: string;
  ngayTao: string;
}

interface NhomBieuDo {
  nhan: string;
  batDau: Date;
  ketThuc: Date;
}

@Component({
  selector: 'app-tong-quan-admin-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tong-quan-admin-component.html',
  styleUrl: './tong-quan-admin-component.css',
})
export class TongQuanAdminComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas')
  chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private refreshTimer?: ReturnType<typeof setInterval>;
  private ngayCuoiCungCapNhat = '';

  khoangThongKe: KhoangThongKe = 'month';
  hienLich = false;
  ngayBatDau = this.toInputDate(this.addDays(new Date(), -29));
  ngayKetThuc = this.toInputDate(new Date());

  khoangBieuDo: KhoangBieuDo = 'month';
  loaiBieuDo: LoaiBieuDo = 'both';
  capNhatLuc = new Date();

  // Dữ liệu thực tế lấy từ MongoDB Atlas
  donHang: DonHang[] = [];
  gameBanChay: GameBanChay[] = [];
  taiKhoan: KhachHang[] = [];

  constructor(
    private router: Router,
    private quanTriService: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';
    this.taiDuLieuDashboard();
  }

  ngAfterViewInit(): void {
    this.ngayCuoiCungCapNhat = this.maNgay(new Date());

    // Làm mới dữ liệu định kỳ mỗi 30 giây
    this.refreshTimer = setInterval(() => {
      this.capNhatLuc = new Date();
      this.taiDuLieuDashboard(true);
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.chart?.destroy();
    document.body.style.overflow = 'auto';
  }

  // =========================
  // TẢI DỮ LIỆU TỪ BACKEND
  // =========================
  taiDuLieuDashboard(isBackground = false): void {
    this.quanTriService.layDuLieuDashboardAdmin().subscribe({
      next: (data) => {
        if (data) {
          this.donHang = Array.isArray(data.donHang) ? data.donHang : [];
          this.gameBanChay = Array.isArray(data.gameBanChay) ? data.gameBanChay : [];
          this.taiKhoan = Array.isArray(data.taiKhoan) ? data.taiKhoan : [];

          // Vẽ lại biểu đồ với dữ liệu mới
          this.veBieuDo();
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Lỗi tải dữ liệu Dashboard:', err);
      }
    });
  }

  // =========================
  // ĐIỀU HƯỚNG TRANG CHI TIẾT
  // =========================
  xemChiTietDonHang(maDonHang: string): void {
    if (maDonHang) {
      this.router.navigate(['/admin/orders', maDonHang]);
    }
  }

  xemChiTietGame(gameId?: string): void {
    if (gameId) {
      this.router.navigate(['/admin/games', gameId]);
    }
  }

  // =========================
  // DANH SÁCH & THỐNG KÊ
  // =========================
  get donHangGanDay(): DonHang[] {
    return [...this.donHang]
      .sort((a, b) => new Date(b.ngayTao).getTime() - new Date(a.ngayTao).getTime())
      .slice(0, 5);
  }

  get topGame(): GameBanChay[] {
    return [...this.gameBanChay]
      .sort((a, b) => b.luotBan - a.luotBan)
      .slice(0, 5);
  }

  get donHangTrongKhoang(): DonHang[] {
    const [start, end] = this.getRange(this.khoangThongKe);
    return this.donHang.filter(d => {
      const date = new Date(d.ngayTao);
      return date >= start && date <= end;
    });
  }

  get tongDoanhThu(): number {
    return this.donHangTrongKhoang
      .filter(d => d.trangThai === 'Đã thanh toán')
      .reduce((sum, d) => sum + (Number(d.tongTien) || 0), 0);
  }

  get tongDonHang(): number {
    return this.donHangTrongKhoang.length;
  }

  get tyLeThanhToan(): number {
    if (this.donHangTrongKhoang.length === 0) return 0;
    const daThanhToan = this.donHangTrongKhoang.filter(
      d => d.trangThai === 'Đã thanh toán'
    ).length;
    return (daThanhToan / this.donHangTrongKhoang.length) * 100;
  }

  get khachHangMoi(): number {
    const [start, end] = this.getRange(this.khoangThongKe);
    return this.taiKhoan.filter(kh => {
      const ngayTao = new Date(kh.ngayTao);
      return ngayTao >= start && ngayTao <= end;
    }).length;
  }

  // =========================
  // SO SÁNH VỚI KỲ TRƯỚC
  // =========================
  private tinhPhanTramThayDoi(hienTai: number, kyTruoc: number): number | null {
    if (kyTruoc === 0) return hienTai === 0 ? 0 : null;
    return ((hienTai - kyTruoc) / kyTruoc) * 100;
  }

  private getPreviousRange(): [Date, Date] {
    const [start, end] = this.getRange(this.khoangThongKe);
    const doDaiKy = end.getTime() - start.getTime() + 1;
    const endTruoc = new Date(start.getTime() - 1);
    const startTruoc = new Date(endTruoc.getTime() - doDaiKy + 1);
    return [startTruoc, endTruoc];
  }

  private get donHangKyTruoc(): DonHang[] {
    const [start, end] = this.getPreviousRange();
    return this.donHang.filter(d => {
      const ngay = new Date(d.ngayTao);
      return ngay >= start && ngay <= end;
    });
  }

  private get doanhThuKyTruoc(): number {
    return this.donHangKyTruoc
      .filter(d => d.trangThai === 'Đã thanh toán')
      .reduce((sum, d) => sum + (Number(d.tongTien) || 0), 0);
  }

  private get soDonHangKyTruoc(): number {
    return this.donHangKyTruoc.length;
  }

  private get tyLeThanhToanKyTruoc(): number {
    const donKyTruoc = this.donHangKyTruoc;
    if (donKyTruoc.length === 0) return 0;
    const daThanhToan = donKyTruoc.filter(
      d => d.trangThai === 'Đã thanh toán'
    ).length;
    return (daThanhToan / donKyTruoc.length) * 100;
  }

  private get soKhachHangMoiKyTruoc(): number {
    const [start, end] = this.getPreviousRange();
    return this.taiKhoan.filter(kh => {
      const ngayTao = new Date(kh.ngayTao);
      return ngayTao >= start && ngayTao <= end;
    }).length;
  }

  get thayDoiDoanhThu(): number | null {
    return this.tinhPhanTramThayDoi(this.tongDoanhThu, this.doanhThuKyTruoc);
  }

  get thayDoiDonHang(): number | null {
    return this.tinhPhanTramThayDoi(this.tongDonHang, this.soDonHangKyTruoc);
  }

  get thayDoiTyLeThanhToan(): number | null {
    return this.tinhPhanTramThayDoi(this.tyLeThanhToan, this.tyLeThanhToanKyTruoc);
  }

  get thayDoiKhachHangMoi(): number | null {
    return this.tinhPhanTramThayDoi(this.khachHangMoi, this.soKhachHangMoiKyTruoc);
  }

  // =========================
  // BỘ LỌC & BIỂU ĐỒ
  // =========================
  chonKhoangThongKe(khoang: KhoangThongKe): void {
    this.khoangThongKe = khoang;
    this.hienLich = khoang === 'custom';
  }

  apDungKhoangNgay(): void {
    if (!this.ngayBatDau || !this.ngayKetThuc) return;
    if (this.ngayBatDau > this.ngayKetThuc) {
      const tam = this.ngayBatDau;
      this.ngayBatDau = this.ngayKetThuc;
      this.ngayKetThuc = tam;
    }
    this.khoangThongKe = 'custom';
    this.hienLich = false;
  }

  private getRange(khoang: KhoangThongKe): [Date, Date] {
    const now = new Date();
    let start: Date;
    const end = this.cuoiNgay(now);
    switch (khoang) {
      case 'week':
        start = this.dauNgay(this.addDays(now, -6));
        break;
      case 'month':
        start = this.dauNgay(this.truThang(now, 1));
        break;
      case 'quarter':
        start = this.dauNgay(this.truThang(now, 3));
        break;
      case 'custom':
        return [
          new Date(`${this.ngayBatDau}T00:00:00`),
          new Date(`${this.ngayKetThuc}T23:59:59.999`)
        ];
      default:
        start = this.dauNgay(now);
    }
    return [start, end];
  }

  private getChartRange(): [Date, Date] {
    const now = new Date();
    const end = new Date(now);
    let start: Date;
    switch (this.khoangBieuDo) {
      case 'today':
        start = this.dauNgay(now);
        break;
      case 'week':
        start = this.dauNgay(this.addDays(now, -6));
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'threeMonths':
        start = this.truThang(now, 3);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
    }
    return [start, end];
  }

  private getChartGroups(): NhomBieuDo[] {
    const [start, end] = this.getChartRange();
    const groups: NhomBieuDo[] = [];
    const themNhom = (nhan: string, batDau: Date, ketThuc: Date): void => {
      const dau = new Date(Math.max(batDau.getTime(), start.getTime()));
      const cuoi = new Date(Math.min(ketThuc.getTime(), end.getTime()));
      if (dau <= cuoi) groups.push({ nhan, batDau: dau, ketThuc: cuoi });
    };

    if (this.khoangBieuDo === 'today') {
      for (let i = 0; i < 6; i++) {
        const batDau = new Date(start);
        batDau.setHours(i * 4, 0, 0, 0);
        const ketThuc = new Date(start);
        ketThuc.setHours(i * 4 + 3, 59, 59, 999);
        themNhom(
          `${String(i * 4).padStart(2, '0')}h-${String(i * 4 + 4).padStart(2, '0')}h`,
          batDau,
          ketThuc
        );
      }
      return groups;
    }

    if (this.khoangBieuDo === 'week') {
      const current = new Date(start);
      while (current <= end) {
        const batDau = this.dauNgay(current);
        const ketThuc = this.cuoiNgay(current);
        const tenThu = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][current.getDay()];
        themNhom(`${tenThu} ${current.getDate()}/${current.getMonth() + 1}`, batDau, ketThuc);
        current.setDate(current.getDate() + 1);
      }
      return groups;
    }

    if (this.khoangBieuDo === 'month') {
      const current = new Date(start);
      const offset = (current.getDay() + 6) % 7;
      current.setDate(current.getDate() - offset);
      current.setHours(0, 0, 0, 0);
      let weekNumber = 1;
      while (current <= end) {
        const batDau = new Date(current);
        const ketThuc = new Date(current);
        ketThuc.setDate(ketThuc.getDate() + 6);
        ketThuc.setHours(23, 59, 59, 999);
        themNhom(`Tuần ${weekNumber}`, batDau, ketThuc);
        current.setDate(current.getDate() + 7);
        weekNumber++;
      }
      return groups;
    }

    const current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const batDau = new Date(current);
      const ketThuc = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
      themNhom(`T${current.getMonth() + 1}/${current.getFullYear()}`, batDau, ketThuc);
      current.setMonth(current.getMonth() + 1);
    }
    return groups;
  }

  private getChartData(): { labels: string[]; doanhThu: number[]; soDon: number[] } {
    const groups = this.getChartGroups();
    const doanhThu = groups.map(() => 0);
    const soDon = groups.map(() => 0);
    for (const don of this.donHang) {
      const ngayTao = new Date(don.ngayTao);
      if (Number.isNaN(ngayTao.getTime())) continue;
      const index = groups.findIndex(
        group => ngayTao >= group.batDau && ngayTao <= group.ketThuc
      );
      if (index < 0) continue;
      soDon[index]++;
      if (don.trangThai === 'Đã thanh toán') {
        doanhThu[index] += Number(don.tongTien) || 0;
      }
    }
    return { labels: groups.map(group => group.nhan), doanhThu, soDon };
  }

  get tongDoanhThuBieuDo(): number {
    return this.getChartData().doanhThu.reduce((sum, value) => sum + value, 0);
  }

  get tongDonBieuDo(): number {
    return this.getChartData().soDon.reduce((sum, value) => sum + value, 0);
  }

  doiBoLocBieuDo(): void {
    this.veBieuDo();
  }

  private veBieuDo(): void {
    if (!this.chartCanvas) return;
    const data = this.getChartData();
    const datasets: any[] = [];
    if (this.loaiBieuDo !== 'orders') {
      datasets.push({
        type: 'bar',
        label: 'Doanh thu (VND)',
        data: data.doanhThu,
        backgroundColor: '#fa7b27',
        borderRadius: 3,
        yAxisID: 'y'
      });
    }
    if (this.loaiBieuDo !== 'revenue') {
      datasets.push({
        type: 'line',
        label: 'Số đơn hàng',
        data: data.soDon,
        borderColor: '#1769aa',
        backgroundColor: '#1769aa',
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.35,
        yAxisID: 'y1'
      });
    }

    this.chart?.destroy();
    this.chart = new Chart(this.chartCanvas.nativeElement, {
      data: { labels: data.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { usePointStyle: true, boxWidth: 8, color: '#30354a' }
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (ctx: TooltipItem<'bar' | 'line'>) => {
                if (ctx.dataset.yAxisID === 'y') {
                  return `${ctx.dataset.label}: ${new Intl.NumberFormat('vi-VN').format(Number(ctx.raw) || 0)} VND`;
                }
                return `${ctx.dataset.label}: ${ctx.raw} đơn`;
              }
            }
          }
        },
        scales: {
          y: {
            display: this.loaiBieuDo !== 'orders',
            beginAtZero: true,
            ticks: {
              callback: (value: string | number) => this.rutGonTien(Number(value))
            }
          },
          y1: {
            display: this.loaiBieuDo !== 'revenue',
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { precision: 0 }
          },
          x: { grid: { display: false } }
        }
      } as any
    });
  }

  // Helpers
  dinhDangTien(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + ' VND';
  }

  dinhDangNgay(value: string): string {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private rutGonTien(value: number): string {
    if (value >= 1000000) return `${Math.round(value / 100000) / 10}M`;
    if (value >= 1000) return `${Math.round(value / 1000)}K`;
    return String(value);
  }

  private dauNgay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private cuoiNgay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private truThang(date: Date, soThang: number): Date {
    const result = new Date(date);
    const ngayGoc = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() - soThang);
    const ngayCuoiThang = new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();
    result.setDate(Math.min(ngayGoc, ngayCuoiThang));
    return result;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private toInputDate(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }

  private maNgay(date: Date): string {
    return this.toInputDate(date);
  }
}