import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { QuanTri } from '../../../../services/quan-tri';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
interface SanPhamGame {
  id: string;       // MongoDB _id
  maGame: string;   // Mã sản phẩm, ví dụ SIM01
  tenGame: string;
  theLoai: string[];
  gia: number;
  phanTramGiamGia: number;
  luotBan: number;
  hinhAnh: string;
}

type MucGiamGia = '' | 'under10' | '10to30' | '30to50' | '50to70' | 'over70';

@Component({
  selector: 'app-quan-ly-tro-choi-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-tro-choi-component.html',
  styleUrl: './quan-ly-tro-choi-component.css'
})
export class QuanLyTroChoiComponent implements OnInit {
  readonly soSanPhamMoiTrang = 20;
  readonly anhMacDinh = 'https://placehold.co/64x64/34395f/ffffff?text=GAME';

  readonly danhSachTheLoai = [
    'Mô phỏng',
    'Phiêu lưu', 
    'Thể thao', 
    'Kinh dị', 
    'Thế giới mở',
    'Hành động', 
    'Nhập vai',
    'Esport/ Đối kháng', 
    'Chiến thuật', 
    'Indie'
  ];

  readonly danhSachMucGiamGia: { value: MucGiamGia; label: string }[] = [
    { value: 'under10', label: 'Dưới 10%' },
    { value: '10to30', label: '10 đến 30%' },
    { value: '30to50', label: '30 đến 50%' },
    { value: '50to70', label: '50 đến 70%' },
    { value: 'over70', label: 'Trên 70%' }
  ];

  // DATA MẪU FRONTEND: sau này thay mảng này bằng dữ liệu nhận từ backend/API.
  // Dữ liệu trò chơi lấy từ MongoDB
danhSachSanPham: SanPhamGame[] = [];

dangTaiDuLieu = false;

  tuKhoa = '';
  theLoaiDangChon: string[] = [];
  mucGiamGiaDangChon: MucGiamGia = '';
  moDropdownTheLoai = false;
  moDropdownGiamGia = false;

  private tuKhoaDaApDung = '';
  private theLoaiDaApDung: string[] = [];
  private mucGiamGiaDaApDung: MucGiamGia = '';

  trangHienTai = 1;
  sanPhamDuocChon = new Set<string>();
  hienXacNhanXoa = false;
  idsChoXoa: string[] = [];
  thongBao = '';
  private timeoutThongBao?: ReturnType<typeof setTimeout>;

  constructor(
  private router: Router,
  private quanTri: QuanTri,
  private cdr: ChangeDetectorRef
) {}

ngOnInit(): void {
  this.taiDanhSachTroChoi();
}

taiDanhSachTroChoi(): void {
  this.dangTaiDuLieu = true;

  this.quanTri.layDanhSachTroChoi().subscribe({
    next: (data: any[]) => {
  console.log('Dữ liệu API trả về:', data);
  console.log('Số lượng game:', data.length);

  this.danhSachSanPham = data.map(game => ({
    id: String(game._id),
    maGame: game.maGame || '',
    tenGame: game.tenTroChoi || '',
    theLoai: game.tenTheLoai || [],
    gia: Number(game.giaGoc) || 0,
phanTramGiamGia: (() => {
  const discount = Number(game.phanTramGiamGia) || 0;
  return discount > 0 && discount <= 1 ? discount * 100 : discount;
})(),
    luotBan: Number(game.luotBan) || 0,
    hinhAnh: game.anhBia || game.anhThuNho || this.anhMacDinh
  }));
console.log('===== KIỂM TRA DỮ LIỆU LỌC =====');

console.log(
  'Danh sách thể loại thực tế:',
  [...new Set(this.danhSachSanPham.flatMap(game => game.theLoai))]
);

console.log(
  'Các mức giảm giá thực tế:',
  [...new Set(this.danhSachSanPham.map(game => game.phanTramGiamGia))]
);

console.log(
  'Game mẫu:',
  this.danhSachSanPham.slice(0, 5)
);

  console.log('Danh sách game sau khi chuyển đổi:', this.danhSachSanPham);
  console.log('Số game sau lọc:', this.sanPhamSauLoc.length);
console.log('Số game trang hiện tại:', this.sanPhamHienThi.length);
console.log('Số trang:', this.tongTrang);
console.log('Số game đang hiển thị:', this.sanPhamHienThi.length);
console.log('Tổng số trang:', this.tongTrang);
console.log('Trang hiện tại:', this.trangHienTai);
  this.sanPhamDuocChon.clear();
  this.trangHienTai = 1;
  this.dangTaiDuLieu = false;
  this.cdr.detectChanges();
},
    error: (error) => {
      console.error('Lỗi tải danh sách trò chơi:', error);
      this.dangTaiDuLieu = false;
      this.hienThongBao(
        error.error?.message || error.message || 'Không thể tải danh sách trò chơi.'
      );
    }
  });
}

  get nhanMucGiamGiaDangChon(): string {
    if (!this.mucGiamGiaDangChon) return 'Mức giảm giá';
    return this.danhSachMucGiamGia.find(x => x.value === this.mucGiamGiaDangChon)?.label ?? 'Mức giảm giá';
  }

get sanPhamSauLoc(): SanPhamGame[] {
  console.log('Từ khóa:', this.tuKhoaDaApDung);
  console.log('Thể loại đang lọc:', this.theLoaiDaApDung);
  console.log('Mức giảm giá:', this.mucGiamGiaDaApDung);

  const keyword = this.chuanHoa(this.tuKhoaDaApDung);

  return this.danhSachSanPham.filter(game => {
    const matchKeyword =
      !keyword ||
      this.chuanHoa(game.tenGame).includes(keyword) ||
      this.chuanHoa(game.maGame).includes(keyword) ||
      this.chuanHoa(game.id).includes(keyword);

    const matchGenre =
  this.theLoaiDaApDung.length === 0 ||
  this.theLoaiDaApDung.some(x =>
    game.theLoai.some(g => this.chuanHoa(g) === this.chuanHoa(x))
  );

    const discount = Number(game.phanTramGiamGia) || 0;

    return (
      matchKeyword &&
      matchGenre &&
      this.kiemTraMucGiamGia(discount, this.mucGiamGiaDaApDung)
    );
  });
}
  get tongSanPhamSauLoc(): number { return this.sanPhamSauLoc.length; }
  get tongTrang(): number { return Math.max(1, Math.ceil(this.tongSanPhamSauLoc / this.soSanPhamMoiTrang)); }
  get sanPhamHienThi(): SanPhamGame[] {
    const start = (this.trangHienTai - 1) * this.soSanPhamMoiTrang;
    return this.sanPhamSauLoc.slice(start, start + this.soSanPhamMoiTrang);
  }
  get danhSachTrang(): number[] {
    const max = 5;
    let start = Math.max(1, this.trangHienTai - 2);
    const end = Math.min(this.tongTrang, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  get trangDaChonHet(): boolean {
    return this.sanPhamHienThi.length > 0 && this.sanPhamHienThi.every(game => this.sanPhamDuocChon.has(game.id));
  }
  get trangChonMotPhan(): boolean {
    return this.sanPhamHienThi.some(game => this.sanPhamDuocChon.has(game.id)) && !this.trangDaChonHet;
  }

  doiTheLoai(theLoai: string): void {
    this.theLoaiDangChon = this.theLoaiDangChon.includes(theLoai)
      ? this.theLoaiDangChon.filter(x => x !== theLoai)
      : [...this.theLoaiDangChon, theLoai];
  }
  xoaTheLoai(): void { this.theLoaiDangChon = []; }
  chonMucGiamGia(value: MucGiamGia): void {
    // Bấm lần nữa vào lựa chọn hiện tại sẽ bỏ lọc giảm giá.
    this.mucGiamGiaDangChon = this.mucGiamGiaDangChon === value ? '' : value;
  }
  apDungBoLoc(): void {
    this.tuKhoaDaApDung = this.tuKhoa.trim();
    this.theLoaiDaApDung = [...this.theLoaiDangChon];
    this.mucGiamGiaDaApDung = this.mucGiamGiaDangChon;
    this.trangHienTai = 1;
    this.moDropdownTheLoai = false;
    this.moDropdownGiamGia = false;
  }
  datLaiBoLoc(): void {
    this.tuKhoa = '';
    this.theLoaiDangChon = [];
    this.mucGiamGiaDangChon = '';
    this.tuKhoaDaApDung = '';
    this.theLoaiDaApDung = [];
    this.mucGiamGiaDaApDung = '';
    this.trangHienTai = 1;
    this.moDropdownTheLoai = false;
    this.moDropdownGiamGia = false;
  }
  doiTrang(trang: number): void {
    if (trang >= 1 && trang <= this.tongTrang) this.trangHienTai = trang;
  }

  doiChonSanPham(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.sanPhamDuocChon);
    checked ? next.add(id) : next.delete(id);
    this.sanPhamDuocChon = next;
  }
  doiChonTatCaTrang(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.sanPhamDuocChon);
    this.sanPhamHienThi.forEach(game => checked ? next.add(game.id) : next.delete(game.id));
    this.sanPhamDuocChon = next;
  }
  xacNhanXoaMotSanPham(game: SanPhamGame): void {
    this.idsChoXoa = [game.id];
    this.hienXacNhanXoa = true;
  }
  xacNhanXoaSanPham(): void {
    if (!this.sanPhamDuocChon.size) return;
    this.idsChoXoa = [...this.sanPhamDuocChon];
    this.hienXacNhanXoa = true;
  }
  huyXoa(): void { this.hienXacNhanXoa = false; this.idsChoXoa = []; }
  xacNhanThucHienXoa(): void {
  if (!this.idsChoXoa.length) return;

  const ids = [...this.idsChoXoa];

  forkJoin(
    ids.map(id => this.quanTri.xoaTroChoi(id))
  ).subscribe({
    next: () => {
      const tapIdDaXoa = new Set(ids);

      this.danhSachSanPham = this.danhSachSanPham.filter(
        game => !tapIdDaXoa.has(game.id)
      );

      this.sanPhamDuocChon = new Set(
        [...this.sanPhamDuocChon].filter(id => !tapIdDaXoa.has(id))
      );

      this.hienXacNhanXoa = false;
      this.idsChoXoa = [];

      this.trangHienTai = Math.min(this.trangHienTai, this.tongTrang);

      this.hienThongBao(`Đã xóa ${ids.length} sản phẩm thành công.`);
    },
    error: (error) => {
      console.error('Lỗi xóa trò chơi:', error);

      this.hienXacNhanXoa = false;
      this.hienThongBao(
        error.error?.message || 'Không thể xóa sản phẩm. Vui lòng thử lại.'
      );
    }
  });
}

  moChiTiet(game: SanPhamGame): void {
    this.router.navigate(['/admin/games', game.id]);
  }
  moTrangTaoSanPham(): void { this.router.navigate(['/admin/games/tao-moi']); }

  giaSauGiam(game: SanPhamGame): number {
    return Math.round(game.gia * (1 - (Number(game.phanTramGiamGia) || 0) / 100));
  }
  dinhDangTien(value: number): string { return new Intl.NumberFormat('vi-VN').format(value); }
  classTheLoai(theLoai: string): string {
    const value = this.chuanHoa(theLoai);

    const mauTheLoai: Record<string, string> = {
      'mo phong': 'genre-simulation',
      'nhap vai': 'genre-rpg',
      'phieu luu': 'genre-adventure',
      'the thao': 'genre-sports',
      'kinh di': 'genre-horror',
      'the gioi mo': 'genre-open-world',
      'hanh dong': 'genre-action',
      'esport/ doi khang': 'genre-esports',
      'chien thuat': 'genre-strategy',
      'indie': 'genre-indie'
    };

    return mauTheLoai[value] ?? 'genre-default';
  }
  dungAnhMacDinh(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src = this.anhMacDinh;
  }
  trackById(_index: number, game: SanPhamGame): string { return game.id; }

  xuatCsv(): void {
const headers = [
  'Mã Game',
  'Tên Game',
  'Thể loại',
  'Giá gốc',
  'Giảm giá (%)',
  'Giá hiện tại',
  'Lượt bán'
];
const rows = this.sanPhamSauLoc.map(game => [
  game.maGame,
  game.tenGame,
  game.theLoai.join(', '),
  game.gia,
  game.phanTramGiamGia,
  this.giaSauGiam(game),
  game.luotBan
]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'danh-sach-san-pham.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  private kiemTraMucGiamGia(discount: number, value: MucGiamGia): boolean {
    switch (value) {
      case 'under10': return discount < 10;
      case '10to30': return discount >= 10 && discount < 30;
      case '30to50': return discount >= 30 && discount < 50;
      case '50to70': return discount >= 50 && discount <= 70;
      case 'over70': return discount > 70;
      default: return true;
    }
  }
  private chuanHoa(value: string): string {
    return value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
  }
  private hienThongBao(message: string): void {
    this.thongBao = message;
    if (this.timeoutThongBao) clearTimeout(this.timeoutThongBao);
    this.timeoutThongBao = setTimeout(() => this.thongBao = '', 3000);
  }
}
