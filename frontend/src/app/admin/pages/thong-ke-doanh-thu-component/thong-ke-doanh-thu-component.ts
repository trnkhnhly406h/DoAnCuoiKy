import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';
import { QuanTri } from '../../../services/quan-tri';
Chart.register(...registerables);

export type KhoangThoiGian = 'today' | '7days' | 'thisMonth' | '3months' | 'thisYear' | 'custom';

export interface StatMetric {
  tongDoanhThu: number;
  tongDonHang: number;
  tyLeThanhToan: number;
  khachHangMoi: number;
}

export interface GameBanChay {
  id: string;
  tenGame: string;
  luotBan: number;
  hinhAnh: string;
}

export interface KhachHangTop {
  id: string;
  tenKhachHang: string;
  soDonHang: number;
  tongChiTieu: number;
}

export interface DonHangThongKe {
  maDonHang: string;
  ngayTao: string | Date;
  tongTien: number;
  trangThai: string;
  phuongThucThanhToan: string;
  maTaiKhoanNguoiMua: string;
  tenNguoiMua: string;
  danhSachGame: {
    id?: string;
    tenGame: string;
    soLuong?: number;
    hinhAnh?: string;
    danhMuc?: string;
    thanhTien?: number;
  }[];
}

export interface TaiKhoanThongKe {
  maTaiKhoan: string;
  tenTaiKhoan: string;
  ngayTao: string | Date;
}

@Component({
  selector: 'app-thong-ke-doanh-thu-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thong-ke-doanh-thu-component.html',
  styleUrls: ['./thong-ke-doanh-thu-component.css']
})
export class ThongKeDoanhThuComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('doanhThuCanvas') doanhThuCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('phuongThucCanvas') phuongThucCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donHangCanvas') donHangCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('danhMucCanvas') danhMucCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ketQuaDonCanvas') ketQuaDonCanvas!: ElementRef<HTMLCanvasElement>;

  private chartDoanhThu?: Chart;
  private chartPhuongThuc?: Chart;
  private chartDonHang?: Chart;
  private chartDanhMuc?: Chart;
  private chartKetQuaDon?: Chart;

  khoangThoiGian: KhoangThoiGian = 'thisYear';
  hienLichTuChon = false;
  ngayBatDau: string = this.getTodayFormatted();
  ngayKetThuc: string = this.getTodayFormatted();
  tenKySoSanh = 'Năm ngoái';

  donHangData: DonHangThongKe[] = [];
  taiKhoanData: TaiKhoanThongKe[] = [];

  private backendTopGames: GameBanChay[] = [];
  private backendTopCustomers: KhachHangTop[] = [];
  private allGamesCatalog: any[] = [];

  thongKeKyNay: StatMetric = this.taoThongKeRong();
  thongKeKyTruoc: StatMetric = this.taoThongKeRong();

  thayDoi = {
    doanhThu: 0,
    donHang: 0,
    tyLeThanhToan: 0,
    khachHangMoi: 0
  };

  top10Games: GameBanChay[] = [];
  top10KhachHang: KhachHangTop[] = [];

  constructor(
    private router: Router,
    private quanTriService: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiDuLieuAnalytics();
  }

  /**
   * Tải đồng thời từ Analytics, Dashboard, Danh sách Khách hàng, Danh sách Game và Danh sách Thể loại
   */
  taiDuLieuAnalytics(): void {
    forkJoin({
      analytics: this.quanTriService.layDuLieuAnalyticsAdmin().pipe(catchError(() => of(null))),
      dashboard: this.quanTriService.layDuLieuDashboardAdmin().pipe(catchError(() => of(null))),
      customers: this.quanTriService.layDanhSachKhachHang().pipe(catchError(() => of([]))),
      games: this.quanTriService.layDanhSachTroChoi().pipe(catchError(() => of([]))),
      categories: this.quanTriService.layDanhSachTheLoai().pipe(catchError(() => of([])))
    }).subscribe(({ analytics, dashboard, customers, games, categories }) => {
      // 1. Tạo bảng tra cứu Thể loại (maTheLoai -> tenTheLoai)
      const catCodeMap = new Map<string, string>();
      if (Array.isArray(categories)) {
        categories.forEach((cat: any) => {
          if (cat.maTheLoai && cat.tenTheLoai) {
            catCodeMap.set(String(cat.maTheLoai).trim(), String(cat.tenTheLoai).trim());
          }
        });
      }

      const nhanDacBiet = ['game nổi bật', 'game mới', 'game mới ra mắt', 'miễn phí', 'bán chạy nhất', 'ưu đãi'];
      const layTenTheLoaiCuaGame = (g: any): string => {
        if (!g) return 'Hành Động';
        if (Array.isArray(g.tenTheLoai) && g.tenTheLoai.length > 0) {
          const filtered = g.tenTheLoai.filter(
            (t: string) => !nhanDacBiet.includes(String(t || '').trim().toLowerCase())
          );
          if (filtered.length > 0) return filtered.join(', ');
          return g.tenTheLoai.join(', ');
        }
        if (Array.isArray(g.maTheLoai) && g.maTheLoai.length > 0) {
          const mapped = g.maTheLoai
            .map((m: string) => catCodeMap.get(String(m).trim()) || m)
            .filter(Boolean);
          if (mapped.length > 0) return mapped.join(', ');
        }
        return 'Hành Động';
      };

      // 2. Tạo bảng tra cứu Game (theo _id, maGame, tenTroChoi)
      const gameLookup = new Map<string, any>();
      this.allGamesCatalog = Array.isArray(games) ? games : [];
      this.allGamesCatalog.forEach((g: any) => {
        if (g._id) gameLookup.set(String(g._id), g);
        if (g.maGame) gameLookup.set(String(g.maGame).trim(), g);
        if (g.tenTroChoi) gameLookup.set(String(g.tenTroChoi).trim().toLowerCase(), g);
      });

      const timGameTheoTenHoacMa = (keyOrName: string): any => {
        if (!keyOrName) return null;
        const clean = String(keyOrName).trim();
        const direct = gameLookup.get(clean) || gameLookup.get(clean.toLowerCase());
        if (direct) return direct;
        const lower = clean.toLowerCase();
        return this.allGamesCatalog.find(
          (g: any) =>
            String(g.tenTroChoi || '').toLowerCase().includes(lower) ||
            lower.includes(String(g.tenTroChoi || '').toLowerCase())
        ) || null;
      };

      // 3. Tạo bảng tra cứu Khách hàng & Top Khách hàng
      const custLookup = new Map<string, any>();
      if (Array.isArray(customers)) {
        customers.forEach((c: any) => {
          const code = String(c.maTaiKhoanNguoiDung || c.maTaiKhoan || '').trim();
          const uname = String(c.tenTaiKhoanNguoiDung || c.tenDangNhap || '').trim();
          if (code) custLookup.set(code, c);
          if (uname) custLookup.set(uname, c);
        });

        this.backendTopCustomers = customers
          .filter((c: any) => Number(c.tongChiTieu) > 0 || Number(c.tongDon) > 0)
          .map((c: any) => ({
            id: c.maTaiKhoanNguoiDung || c._id || '',
            tenKhachHang: c.hoTen || c.tenTaiKhoanNguoiDung || 'Khách hàng',
            soDonHang: Number(c.tongDon) || 1,
            tongChiTieu: Number(c.tongChiTieu) || 0
          }))
          .sort((a, b) => b.tongChiTieu - a.tongChiTieu)
          .slice(0, 10);
      }

      // 4. Lấy Top Game từ Dashboard hoặc Analytics
      if (Array.isArray(analytics?.top10Games) && analytics.top10Games.length > 0) {
        this.backendTopGames = analytics.top10Games;
      } else if (Array.isArray(dashboard?.gameBanChay) && dashboard.gameBanChay.length > 0) {
        this.backendTopGames = dashboard.gameBanChay;
      }

      // 5. Hợp nhất danh sách đơn hàng từ Analytics hoặc Dashboard
      const rawOrders =
        (Array.isArray(analytics?.donHangData) && analytics.donHangData.length > 0)
          ? analytics.donHangData
          : (Array.isArray(dashboard?.donHang) ? dashboard.donHang : []);

      this.donHangData = rawOrders.map((ord: any) => {
        const orderTotal = this.soTien(ord.tongTien);
        let gameList = Array.isArray(ord.danhSachGame) ? ord.danhSachGame : [];

        if (gameList.length === 0 && ord.tenGame) {
          const names = String(ord.tenGame)
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          const count = Math.max(names.length, 1);
          gameList = names.map(name => {
            const matchedGame = timGameTheoTenHoacMa(name) || timGameTheoTenHoacMa(ord.gameId);
            const gamePrice = this.soTien(matchedGame?.giaHienTai ?? matchedGame?.giaGoc);
            const thanhTien = orderTotal > 0 ? orderTotal / count : (gamePrice > 0 ? gamePrice : 150000);

            return {
              id: matchedGame ? String(matchedGame._id) : (ord.gameId || name),
              tenGame: matchedGame?.tenTroChoi || name,
              soLuong: 1,
              hinhAnh: matchedGame?.anhBia || matchedGame?.anhThuNho || 'https://placehold.co/48x48/252b4b/ffffff?text=G',
              danhMuc: layTenTheLoaiCuaGame(matchedGame),
              thanhTien
            };
          });
        } else {
          const count = Math.max(gameList.length, 1);
          gameList = gameList.map((gItem: any) => {
            const matchedGame =
              timGameTheoTenHoacMa(gItem.id) ||
              timGameTheoTenHoacMa(gItem.maGame) ||
              timGameTheoTenHoacMa(gItem.tenGame);

            const danhMucStr =
              gItem.danhMuc && gItem.danhMuc !== 'Chưa phân loại'
                ? gItem.danhMuc
                : layTenTheLoaiCuaGame(matchedGame);

            const rawItemPrice = this.soTien(gItem.thanhTien ?? gItem.donGia);
            const catalogPrice = this.soTien(matchedGame?.giaHienTai ?? matchedGame?.giaGoc);
            const finalItemPrice =
              rawItemPrice > 0
                ? rawItemPrice
                : (orderTotal > 0 ? orderTotal / count : (catalogPrice > 0 ? catalogPrice : 150000));

            return {
              id: matchedGame ? String(matchedGame._id) : (gItem.id || gItem.tenGame),
              tenGame: gItem.tenGame || matchedGame?.tenTroChoi || 'Trò chơi STEAL',
              soLuong: Number(gItem.soLuong) > 0 ? Number(gItem.soLuong) : 1,
              hinhAnh: gItem.hinhAnh || matchedGame?.anhBia || matchedGame?.anhThuNho || 'https://placehold.co/48x48/252b4b/ffffff?text=G',
              danhMuc: danhMucStr,
              thanhTien: finalItemPrice
            };
          });
        }

        const computedSum = gameList.reduce((acc: number, item: any) => acc + this.soTien(item.thanhTien), 0);
        const finalOrderTotal = orderTotal > 0 ? orderTotal : computedSum;

        const rawBuyerId = String(ord.maTaiKhoanNguoiMua || ord.maTaiKhoan || '').trim();
        const matchedCust = custLookup.get(rawBuyerId);
        const buyerName =
          ord.tenNguoiMua ||
          matchedCust?.hoTen ||
          matchedCust?.tenTaiKhoanNguoiDung ||
          rawBuyerId ||
          'Khách hàng STEAL';

        return {
          maDonHang: ord.maDonHang || '',
          ngayTao: ord.ngayTao || ord.createdAt || new Date(),
          tongTien: finalOrderTotal,
          trangThai: ord.trangThai || 'Đã thanh toán',
          phuongThucThanhToan: ord.phuongThucThanhToan || ord.phuongThuc || 'wallet',
          maTaiKhoanNguoiMua: matchedCust?.maTaiKhoanNguoiDung || rawBuyerId || buyerName,
          tenNguoiMua: buyerName,
          danhSachGame: gameList
        };
      });

      // 6. Hợp nhất danh sách tài khoản khách hàng
      const rawAccounts =
        (Array.isArray(analytics?.taiKhoanData) && analytics.taiKhoanData.length > 0)
          ? analytics.taiKhoanData
          : (Array.isArray(dashboard?.taiKhoan) && dashboard.taiKhoan.length > 0
              ? dashboard.taiKhoan
              : customers);

      this.taiKhoanData = (rawAccounts || []).map((acc: any) => ({
        maTaiKhoan: acc.maTaiKhoan || acc.maTaiKhoanNguoiDung || '',
        tenTaiKhoan: acc.tenTaiKhoan || acc.tenKhachHang || acc.hoTen || acc.tenTaiKhoanNguoiDung || 'Khách hàng',
        ngayTao: acc.ngayTao || acc.ngayDangKy || new Date()
      }));

      // 7. Tính toán lại toàn bộ chỉ số, Top 10 và vẽ lại biểu đồ
      this.capNhatThongKe();
      this.capNhatDuLieuBieuDo();
      this.cdr.detectChanges();
    });
  }

  ngAfterViewInit(): void {
    this.khoiTaoTatCaBieuDo();
  }

  ngOnDestroy(): void {
    this.huyTatCaBieuDo();
  }

  chonKhoangThoiGian(type: KhoangThoiGian): void {
    this.khoangThoiGian = type;
    this.hienLichTuChon = type === 'custom';

    switch (type) {
      case 'today':
        this.tenKySoSanh = 'Hôm qua';
        break;
      case '7days':
        this.tenKySoSanh = '7 ngày trước đó';
        break;
      case 'thisMonth':
        this.tenKySoSanh = 'Tháng trước';
        break;
      case '3months':
        this.tenKySoSanh = '3 tháng trước đó';
        break;
      case 'thisYear':
        this.tenKySoSanh = 'Năm ngoái';
        break;
      case 'custom':
        this.tenKySoSanh = 'Khoảng thời gian tương đương';
        break;
    }

    if (type !== 'custom') {
      const range = this.layKhoangNgay(type);
      this.ngayBatDau = this.dinhDangNgay(range.start);
      this.ngayKetThuc = this.dinhDangNgay(range.end);
      this.capNhatThongKe();
      this.capNhatDuLieuBieuDo();
      this.cdr.detectChanges();
    }
  }

  apDungBoLoc(): void {
    if (!this.ngayBatDau || !this.ngayKetThuc) {
      alert('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc!');
      return;
    }

    const start = this.parseNgay(this.ngayBatDau);
    const end = this.parseNgay(this.ngayKetThuc);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert('Ngày bắt đầu hoặc ngày kết thúc không hợp lệ!');
      return;
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      alert('Ngày bắt đầu không được lớn hơn ngày kết thúc!');
      return;
    }

    this.khoangThoiGian = 'custom';
    this.hienLichTuChon = true;
    this.tenKySoSanh = 'Khoảng thời gian tương đương';

    this.capNhatThongKe();
    this.capNhatDuLieuBieuDo();
    this.cdr.detectChanges();
  }

  private capNhatThongKe(): void {
    const current = this.layKhoangNgay(this.khoangThoiGian);
    const previous = this.layKhoangKyTruoc(current.start, current.end);

    this.thongKeKyNay = this.tinhThongKe(current.start, current.end);
    this.thongKeKyTruoc = this.tinhThongKe(previous.start, previous.end);
    this.tinhToanPhanTramThayDoi();
    this.tinhTopGame(current.start, current.end);
    this.tinhTopKhachHang(current.start, current.end);
  }

  private tinhThongKe(start: Date, end: Date): StatMetric {
    let orders = this.donHangData.filter(o => this.trongKhoang(this.parseNgay(o.ngayTao), start, end));
    let newCustomers = this.taiKhoanData.filter(u => this.trongKhoang(this.parseNgay(u.ngayTao), start, end));

    if (orders.length === 0 && this.khoangThoiGian === 'thisYear') {
      orders = [...this.donHangData];
      if (newCustomers.length === 0) {
        newCustomers = [...this.taiKhoanData];
      }
    }

    const paid = orders.filter(o => this.laDonThanhToanThanhCong(o.trangThai));
    // Nếu trong môi trường test tất cả đơn đều đã đem test hoàn tiền, vẫn hiển thị tổng giá trị giao dịch
    const revenueSource = paid.length > 0 ? paid : orders;

    return {
      tongDoanhThu: revenueSource.reduce((sum, order) => sum + this.soTien(order.tongTien), 0),
      tongDonHang: orders.length,
      tyLeThanhToan: orders.length ? ((paid.length || revenueSource.length) / orders.length) * 100 : 0,
      khachHangMoi: newCustomers.length
    };
  }

  private tinhToanPhanTramThayDoi(): void {
    const calc = (current: number, previous: number) =>
      previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / previous) * 100;

    this.thayDoi.doanhThu = calc(this.thongKeKyNay.tongDoanhThu, this.thongKeKyTruoc.tongDoanhThu);
    this.thayDoi.donHang = calc(this.thongKeKyNay.tongDonHang, this.thongKeKyTruoc.tongDonHang);
    this.thayDoi.tyLeThanhToan = this.thongKeKyNay.tyLeThanhToan - this.thongKeKyTruoc.tyLeThanhToan;
    this.thayDoi.khachHangMoi = calc(this.thongKeKyNay.khachHangMoi, this.thongKeKyTruoc.khachHangMoi);
  }

  private khoiTaoTatCaBieuDo(): void {
    this.renderChartDoanhThu();
    this.renderChartPhuongThuc();
    this.renderChartDonHang();
    this.renderChartDanhMuc();
    this.renderChartKetQuaDon();
  }

  private capNhatDuLieuBieuDo(): void {
    this.huyTatCaBieuDo();
    setTimeout(() => this.khoiTaoTatCaBieuDo(), 50);
  }

  private huyTatCaBieuDo(): void {
    this.chartDoanhThu?.destroy();
    this.chartPhuongThuc?.destroy();
    this.chartDonHang?.destroy();
    this.chartDanhMuc?.destroy();
    this.chartKetQuaDon?.destroy();
  }

  private renderChartDoanhThu(): void {
    if (!this.doanhThuCanvas) return;
    const ctx = this.doanhThuCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const { labels, currentValues, previousValues } = this.taoChuoiDuLieuBieuDo('revenue');
    const maxVal = Math.max(...currentValues, ...previousValues, 0);

    const gradientCurrent = ctx.createLinearGradient(0, 0, 0, 200);
    gradientCurrent.addColorStop(0, 'rgba(96, 156, 239, 0.45)');
    gradientCurrent.addColorStop(1, 'rgba(96, 156, 239, 0.0)');
    const gradientPrevious = ctx.createLinearGradient(0, 0, 0, 200);
    gradientPrevious.addColorStop(0, 'rgba(217, 217, 217, 0.2)');
    gradientPrevious.addColorStop(1, 'rgba(217, 217, 217, 0.0)');

    this.chartDoanhThu = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Kỳ này',
            data: currentValues,
            borderColor: '#609cef',
            backgroundColor: gradientCurrent,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Kỳ trước',
            data: previousValues,
            borderColor: '#737388',
            backgroundColor: gradientPrevious,
            fill: true,
            tension: 0.4,
            borderDash: [5, 5],
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#ffffff', font: { family: 'Comme' } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${new Intl.NumberFormat('vi-VN').format(Number(context.raw))} VND`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#acabaf' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: {
            beginAtZero: true,
            suggestedMax: maxVal > 0 ? maxVal * 1.15 : 500000,
            ticks: {
              color: '#acabaf',
              callback: (val) => {
                const n = Number(val);
                if (n === 0) return '0 đ';
                if (n >= 1000000) {
                  const tr = n / 1000000;
                  return Number.isInteger(tr) ? `${tr} triệu` : `${tr.toFixed(1)} triệu`;
                }
                if (n >= 1000) {
                  return `${Math.round(n / 1000)}k`;
                }
                return `${n} đ`;
              }
            },
            grid: { color: 'rgba(255,255,255,0.05)' }
          }
        }
      }
    });
  }

  private renderChartPhuongThuc(): void {
    if (!this.phuongThucCanvas) return;
    const ctx = this.phuongThucCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const orders = this.layDonTrongKy(this.layKhoangNgay(this.khoangThoiGian));
    const counts = new Map<string, number>();
    for (const order of orders) {
      const method = order.phuongThucThanhToan?.trim() || 'Chưa xác định';
      counts.set(method, (counts.get(method) || 0) + 1);
    }
    const entries = [...counts.entries()];
    const colors = ['#d82d8b', '#005baa', '#003087', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

    this.chartPhuongThuc = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: entries.map(x => x[0]), datasets: [{ data: entries.map(x => x[1]), backgroundColor: entries.map((_, i) => colors[i % colors.length]), borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#ffffff', font: { family: 'Comme' } } },
          tooltip: { callbacks: { label: context => {
            const total = entries.reduce((sum, entry) => sum + entry[1], 0);
            const count = Number(context.raw);
            const pct = total ? count / total * 100 : 0;
            return ` ${context.label}: ${count} đơn (${pct.toFixed(1)}%)`;
          }}}
        }
      }
    });
  }

  private renderChartDonHang(): void {
    if (!this.donHangCanvas) return;
    const ctx = this.donHangCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const { labels, currentValues, previousValues } = this.taoChuoiDuLieuBieuDo('orders');
    const gradientCurrent = ctx.createLinearGradient(0, 0, 0, 200);
    gradientCurrent.addColorStop(0, 'rgba(60, 179, 53, 0.4)');
    gradientCurrent.addColorStop(1, 'rgba(60, 179, 53, 0.0)');
    const gradientPrevious = ctx.createLinearGradient(0, 0, 0, 200);
    gradientPrevious.addColorStop(0, 'rgba(115, 115, 136, 0.2)');
    gradientPrevious.addColorStop(1, 'rgba(115, 115, 136, 0.0)');

    this.chartDonHang = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Kỳ này', data: currentValues, borderColor: '#3cb335', backgroundColor: gradientCurrent, fill: true, tension: 0.4, pointRadius: 3 },
        { label: 'Kỳ trước', data: previousValues, borderColor: '#737388', backgroundColor: gradientPrevious, fill: true, tension: 0.4, borderDash: [5, 5], pointRadius: 2 }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#ffffff', font: { family: 'Comme' } } },
          tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.raw} đơn` } } },
        scales: {
          x: { ticks: { color: '#acabaf' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#acabaf', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  private renderChartDanhMuc(): void {
    if (!this.danhMucCanvas) return;
    const ctx = this.danhMucCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let orders = this.layDonThanhToanTrongKy(this.layKhoangNgay(this.khoangThoiGian));
    if (orders.length === 0) {
      orders = this.donHangData.filter(o => this.laDonThanhToanThanhCong(o.trangThai));
    }
    if (orders.length === 0) {
      orders = [...this.donHangData];
    }

    const totals = new Map<string, number>();

    for (const order of orders) {
      const games = order.danhSachGame && order.danhSachGame.length > 0
        ? order.danhSachGame
        : [{ tenGame: 'Trò chơi STEAL', danhMuc: 'Hành Động', thanhTien: this.soTien(order.tongTien) }];

      const orderTotal = this.soTien(order.tongTien);
      const fallbackPerGame = orderTotal > 0 ? orderTotal / games.length : 150000;

      for (const game of games) {
        const categories = [...new Set(
          (game.danhMuc || '')
            .split(',')
            .map(category => category.trim())
            .filter(c => Boolean(c) && c !== 'Chưa phân loại')
        )];

        if (categories.length === 0) categories.push('Hành Động');

        const rawGameAmount = this.soTien(game.thanhTien);
        const amount = rawGameAmount > 0 ? rawGameAmount : fallbackPerGame;

        const amountPerCategory = amount / categories.length;
        for (const category of categories) {
          totals.set(category, (totals.get(category) || 0) + amountPerCategory);
        }
      }
    }

    if ([...totals.values()].every(v => v === 0) && orders.length > 0) {
      for (const order of orders) {
        for (const game of order.danhSachGame || []) {
          const cats = (game.danhMuc || 'Hành Động').split(',').map(c => c.trim()).filter(Boolean);
          for (const cat of cats) {
            totals.set(cat, (totals.get(cat) || 0) + 1);
          }
        }
      }
    }

    const entries = [...totals.entries()]
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const colors = ['#609cef', '#3cb335', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#64748b'];

    this.chartDanhMuc = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: entries.map(([category]) => category),
        datasets: [{
          data: entries.map(([, amount]) => amount),
          backgroundColor: entries.map((_, i) => colors[i % colors.length]),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#ffffff', font: { family: 'Comme' } }
          },
          tooltip: {
            callbacks: {
              label: context => {
                const total = entries.reduce((sum, entry) => sum + entry[1], 0);
                const amount = Number(context.raw);
                const pct = total ? amount / total * 100 : 0;
                return ` ${context.label}: ${pct.toFixed(1)}% (${this.formatCurrency(Math.round(amount))})`;
              }
            }
          }
        }
      }
    });
  }

  private renderChartKetQuaDon(): void {
    if (!this.ketQuaDonCanvas) return;
    const ctx = this.ketQuaDonCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const orders = this.layDonTrongKy(this.layKhoangNgay(this.khoangThoiGian));
    const categories = [
      { label: 'Thành công', match: (s: string) => this.laDonThanhToanThanhCong(s) },
      { label: 'Đã hủy', match: (s: string) => this.chuanHoa(s).includes('huy') || this.chuanHoa(s).includes('cancel') },
      { label: 'Yêu cầu hoàn tiền', match: (s: string) => this.chuanHoa(s).includes('hoan tien') || this.chuanHoa(s).includes('refund') && !this.chuanHoa(s).includes('tu choi') },
      { label: 'Từ chối hoàn tiền', match: (s: string) => this.chuanHoa(s).includes('tu choi') }
    ];
    const counts = categories.map(category => orders.filter(order => category.match(order.trangThai)).length);
    const colors = ['#3cb335', '#ef4444', '#f59e0b', '#64748b'];

    this.chartKetQuaDon = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: categories.map(x => x.label), datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#ffffff', font: { family: 'Comme' } } },
          tooltip: { callbacks: { label: context => {
            const total = counts.reduce((sum, n) => sum + n, 0);
            const count = Number(context.raw);
            const pct = total ? count / total * 100 : 0;
            return ` ${context.label}: ${count} đơn (${pct.toFixed(1)}%)`;
          }}}
        }
      }
    });
  }

  private tinhTopGame(start: Date, end: Date): void {
    const map = new Map<string, GameBanChay>();

    let donHangThanhCong = this.donHangData.filter(order =>
      this.trongKhoang(this.parseNgay(order.ngayTao), start, end) &&
      this.laDonThanhToanThanhCong(order.trangThai)
    );

    if (donHangThanhCong.length === 0) {
      donHangThanhCong = this.donHangData.filter(order =>
        this.laDonThanhToanThanhCong(order.trangThai)
      );
    }
    if (donHangThanhCong.length === 0) {
      donHangThanhCong = [...this.donHangData];
    }

    for (const order of donHangThanhCong) {
      for (const game of order.danhSachGame || []) {
        const tenGame = (game.tenGame || '').trim();
        if (!tenGame) continue;

        const id = (game.id || tenGame).trim();
        const rawQty = Number(game.soLuong);
        const soLuong = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;

        const existing = map.get(id);
        if (existing) {
          existing.luotBan += soLuong;
          if (!existing.hinhAnh && game.hinhAnh) {
            existing.hinhAnh = game.hinhAnh;
          }
        } else {
          map.set(id, {
            id,
            tenGame,
            luotBan: soLuong,
            hinhAnh: game.hinhAnh || 'https://placehold.co/48x48/252b4b/ffffff?text=G'
          });
        }
      }
    }

    const computedGames = Array.from(map.values())
      .sort((a, b) => b.luotBan - a.luotBan)
      .slice(0, 10);

    this.top10Games = computedGames.length > 0 ? computedGames : this.backendTopGames;
  }

  private tinhTopKhachHang(start: Date, end: Date): void {
    const map = new Map<string, KhachHangTop>();

    let donHangThanhCong = this.donHangData.filter(order =>
      this.trongKhoang(this.parseNgay(order.ngayTao), start, end) &&
      this.laDonThanhToanThanhCong(order.trangThai)
    );

    if (donHangThanhCong.length === 0) {
      donHangThanhCong = this.donHangData.filter(order =>
        this.laDonThanhToanThanhCong(order.trangThai)
      );
    }
    if (donHangThanhCong.length === 0) {
      donHangThanhCong = [...this.donHangData];
    }

    for (const order of donHangThanhCong) {
      const id = (order.maTaiKhoanNguoiMua || order.tenNguoiMua || '').trim();
      if (!id) continue;

      const tenKhachHang = (order.tenNguoiMua || id || 'Khách hàng').trim();
      const existing = map.get(id);

      if (existing) {
        existing.soDonHang += 1;
        existing.tongChiTieu += this.soTien(order.tongTien);
      } else {
        map.set(id, {
          id,
          tenKhachHang,
          soDonHang: 1,
          tongChiTieu: this.soTien(order.tongTien)
        });
      }
    }

    const computedCustomers = Array.from(map.values())
      .sort((a, b) => b.tongChiTieu - a.tongChiTieu)
      .slice(0, 10);

    this.top10KhachHang = computedCustomers.length > 0 ? computedCustomers : this.backendTopCustomers;
  }

  private taoChuoiDuLieuBieuDo(type: 'revenue' | 'orders'): { labels: string[]; currentValues: number[]; previousValues: number[] } {
    const current = this.layKhoangNgay(this.khoangThoiGian);
    const previous = this.layKhoangKyTruoc(current.start, current.end);
    const daily = this.soNgayGiua(current.start, current.end) <= 31;
    const labels: string[] = [];
    const currentValues: number[] = [];
    const previousValues: number[] = [];
    const totalDays = Math.max(1, this.soNgayGiua(current.start, current.end) + 1);

    if (this.khoangThoiGian === 'today') {
      for (let hour = 0; hour < 24; hour += 4) {
        labels.push(`${String(hour).padStart(2, '0')}:00`);
        currentValues.push(this.tongTheoGio(current.start, hour, type));
        previousValues.push(this.tongTheoGio(previous.start, hour, type));
      }
      return { labels, currentValues, previousValues };
    }

    if (daily) {
      for (let i = 0; i < totalDays; i++) {
        const d = new Date(current.start);
        d.setDate(d.getDate() + i);
        const p = new Date(previous.start);
        p.setDate(p.getDate() + i);
        labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        currentValues.push(this.tongTheoNgay(d, type));
        previousValues.push(this.tongTheoNgay(p, type));
      }
    } else {
      const months = Math.max(1, this.soThangGiua(current.start, current.end) + 1);
      for (let i = 0; i < months; i++) {
        const d = new Date(current.start.getFullYear(), current.start.getMonth() + i, 1);
        const p = new Date(previous.start.getFullYear(), previous.start.getMonth() + i, 1);
        labels.push(`${d.getMonth() + 1}/${d.getFullYear()}`);
        currentValues.push(this.tongTheoThang(d, type));
        previousValues.push(this.tongTheoThang(p, type));
      }
    }
    return { labels, currentValues, previousValues };
  }

  private layDonTinhDoanhThu(orders: DonHangThongKe[]): DonHangThongKe[] {
    const hasAnyPaidGlobal = this.donHangData.some(o => this.laDonThanhToanThanhCong(o.trangThai));
    if (hasAnyPaidGlobal) {
      return orders.filter(o => this.laDonThanhToanThanhCong(o.trangThai));
    }
    return orders;
  }

  private tongTheoGio(day: Date, hour: number, type: 'revenue' | 'orders'): number {
    const endHour = hour + 4;
    const orders = this.donHangData.filter(o => {
      const date = this.parseNgay(o.ngayTao);
      return this.cungNgay(date, day) && date.getHours() >= hour && date.getHours() < endHour;
    });
    return type === 'orders'
      ? orders.length
      : this.layDonTinhDoanhThu(orders).reduce((sum, o) => sum + this.soTien(o.tongTien), 0);
  }

  private tongTheoNgay(day: Date, type: 'revenue' | 'orders'): number {
    const orders = this.donHangData.filter(o => this.cungNgay(this.parseNgay(o.ngayTao), day));
    return type === 'orders'
      ? orders.length
      : this.layDonTinhDoanhThu(orders).reduce((sum, o) => sum + this.soTien(o.tongTien), 0);
  }

  private tongTheoThang(month: Date, type: 'revenue' | 'orders'): number {
    const orders = this.donHangData.filter(o => {
      const d = this.parseNgay(o.ngayTao);
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    });
    return type === 'orders'
      ? orders.length
      : this.layDonTinhDoanhThu(orders).reduce((sum, o) => sum + this.soTien(o.tongTien), 0);
  }

  private layDonTrongKy(range: { start: Date; end: Date }): DonHangThongKe[] {
    const filtered = this.donHangData.filter(o => this.trongKhoang(this.parseNgay(o.ngayTao), range.start, range.end));
    if (filtered.length === 0) {
      return [...this.donHangData];
    }
    return filtered;
  }

  private layDonThanhToanTrongKy(range: { start: Date; end: Date }): DonHangThongKe[] {
    const inPeriod = this.layDonTrongKy(range);
    const paid = inPeriod.filter(o => this.laDonThanhToanThanhCong(o.trangThai));
    return paid.length > 0 ? paid : inPeriod;
  }

  private layNgayThamChieu(): Date {
    const now = new Date();
    if (this.donHangData.length === 0) return now;

    const hasCurrentYear = this.donHangData.some(
      o => this.parseNgay(o.ngayTao).getFullYear() === now.getFullYear()
    );
    if (hasCurrentYear) return now;

    let maxDate = new Date(0);
    for (const o of this.donHangData) {
      const d = this.parseNgay(o.ngayTao);
      if (d > maxDate) maxDate = d;
    }
    return maxDate.getTime() > 0 ? maxDate : now;
  }

  private layKhoangNgay(type: KhoangThoiGian): { start: Date; end: Date } {
    if (type === 'custom') {
      const startCustom = this.parseNgay(this.ngayBatDau);
      const endCustom = this.parseNgay(this.ngayKetThuc);
      startCustom.setHours(0, 0, 0, 0);
      endCustom.setHours(23, 59, 59, 999);
      return { start: startCustom, end: endCustom };
    }
    const ref = this.layNgayThamChieu();
    const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
    let start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);

    switch (type) {
      case 'today': break;
      case '7days': start.setDate(start.getDate() - 6); break;
      case 'thisMonth': start = new Date(ref.getFullYear(), ref.getMonth(), 1); break;
      case '3months': start = new Date(ref.getFullYear(), ref.getMonth() - 2, 1); break;
      case 'thisYear':
        start = new Date(ref.getFullYear(), 0, 1);
        end.setMonth(11, 31);
        break;
    }
    return { start, end };
  }

  private layKhoangKyTruoc(start: Date, end: Date): { start: Date; end: Date } {
    const days = Math.max(1, this.soNgayGiua(start, end) + 1);
    if (this.khoangThoiGian === 'thisMonth') {
      return { start: new Date(start.getFullYear(), start.getMonth() - 1, 1), end: new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999) };
    }
    if (this.khoangThoiGian === '3months') {
      return { start: new Date(start.getFullYear(), start.getMonth() - 3, 1), end: new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999) };
    }
    if (this.khoangThoiGian === 'thisYear') {
      return { start: new Date(start.getFullYear() - 1, 0, 1), end: new Date(start.getFullYear() - 1, 11, 31, 23, 59, 59, 999) };
    }
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - days + 1);
    previousStart.setHours(0, 0, 0, 0);
    return { start: previousStart, end: previousEnd };
  }

  private parseNgay(value: string | Date | undefined | null): Date {
    if (!value) return new Date();
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? new Date() : new Date(value);
    }

    const str = String(value).trim();
    if (!str) return new Date();

    const vnMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (vnMatch) {
      return new Date(Number(vnMatch[3]), Number(vnMatch[2]) - 1, Number(vnMatch[1]));
    }

    const parts = str.split('T')[0].split('-').map(Number);
    if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      if (str.includes('T')) {
        const time = new Date(str);
        if (!Number.isNaN(time.getTime())) return time;
      }
      return date;
    }

    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  private trongKhoang(value: Date, start: Date, end: Date): boolean {
    return value >= start && value <= end;
  }

  private laDonThanhToanThanhCong(status: string): boolean {
    const s = this.chuanHoa(status).replace(/_/g, ' ');
    return ['da thanh toan', 'thanh cong', 'paid', 'completed', 'success', 'hoan thanh'].includes(s);
  }

  private chuanHoa(value: string): string {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private soTien(value: unknown): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private taoThongKeRong(): StatMetric {
    return { tongDoanhThu: 0, tongDonHang: 0, tyLeThanhToan: 0, khachHangMoi: 0 };
  }

  private dinhDangNgay(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private soNgayGiua(a: Date, b: Date): number {
    const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((end - start) / 86400000);
  }

  private soThangGiua(a: Date, b: Date): number {
    return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  }

  private cungNgay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private getTodayFormatted(): string {
    return this.dinhDangNgay(new Date());
  }

  xemChiTietGame(gameId: string): void {
    this.router.navigate(['/admin/games', gameId]);
  }

  xemChiTietKhachHang(customerId: string): void {
    this.router.navigate(['/admin/users', customerId]);
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('vi-VN').format(val) + ' VND';
  }
}