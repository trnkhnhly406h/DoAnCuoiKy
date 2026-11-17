
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { QuanTri } from '../../../../services/quan-tri';

interface NhomTheLoai {
  id: string;
  mongoId: string;
  tenTheLoai: string;
  moTa: string;
  danhSachGame: string[];
}

@Component({
  selector: 'app-quan-ly-danh-muc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quan-ly-danh-muc-component.html',
  styleUrl: './quan-ly-danh-muc-component.css'
})
export class QuanLyDanhMucComponent implements OnInit {

  danhSachNhom: NhomTheLoai[] = [];

  dangTaiDuLieu = false;
  tuKhoa = '';

  soLuongDangChon = 'tat_ca';
  sapXepDangChon = 'ten_tang';

  danhSachMucSoLuong = [
    { label: 'Tất cả số lượng', value: 'tat_ca' },
    { label: 'Dưới 10 trò chơi', value: 'duoi_10' },
    { label: 'Từ 10 trò chơi trở lên', value: 'tren_10' }
  ];

  danhSachKieuSapXep = [
    { label: 'Tên A - Z', value: 'ten_tang' },
    { label: 'Tên Z - A', value: 'ten_giam' },
    { label: 'Nhiều trò chơi nhất', value: 'game_giam' },
    { label: 'Ít trò chơi nhất', value: 'game_tang' }
  ];

  hienDropdownSoLuong = false;
  hienDropdownSapXep = false;

  cacIdDaChon = new Set<string>();

  hienModalXoa = false;
  idsChoXoa: string[] = [];
  tenTheLoaiDangXoa = '';

  thongBao = '';

  trangHienTai = 1;
  soNhomMoiTrang = 8;

  constructor(
    private quanTri: QuanTri,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiDanhSach();
    this.cdr.detectChanges();
  }

  // =========================
  // TẢI DỮ LIỆU
  // =========================

  async taiDanhSach(): Promise<void> {
    this.dangTaiDuLieu = true;

    try {
      const [categories, games] = await Promise.all([
        firstValueFrom(this.quanTri.layDanhSachTheLoai()),
        firstValueFrom(this.quanTri.layDanhSachTroChoi())
      ]);

      this.danhSachNhom = (categories || []).map((category: any) => {
        const danhSachGame = (games || [])
          .filter((game: any) =>
            (game.maTheLoai || []).includes(category.maTheLoai)
          )
          .map((game: any) => game.maGame);

        return {
          mongoId: category._id,
          id: category.maTheLoai,
          tenTheLoai: category.tenTheLoai,
          moTa: category.moTa || '',
          danhSachGame
        };
      });

      // Loại bỏ các lựa chọn không còn tồn tại.
      const cacMaConTonTai = new Set(
        this.danhSachNhom.map(nhom => nhom.id)
      );

      this.cacIdDaChon = new Set(
        [...this.cacIdDaChon].filter(id => cacMaConTonTai.has(id))
      );

    } catch (error: any) {
      console.error('Lỗi tải danh sách danh mục:', error);
      this.thongBao =
        error?.error?.message || 'Không thể tải danh sách danh mục.';
    } finally {
      this.dangTaiDuLieu = false;
      this.cdr.detectChanges();
    }
  }

  // =========================
  // TÌM KIẾM VÀ LỌC
  // =========================

  get danhSachHienThi(): NhomTheLoai[] {
    let result = [...this.danhSachNhom];

    const keyword = this.chuanHoa(this.tuKhoa);

    if (keyword) {
      result = result.filter(nhom =>
        this.chuanHoa(nhom.tenTheLoai).includes(keyword) ||
        this.chuanHoa(nhom.id).includes(keyword) ||
        this.chuanHoa(nhom.moTa).includes(keyword)
      );
    }

    if (this.soLuongDangChon === 'duoi_10') {
      result = result.filter(nhom => nhom.danhSachGame.length < 10);
    } else if (this.soLuongDangChon === 'tren_10') {
      result = result.filter(nhom => nhom.danhSachGame.length >= 10);
    }

    switch (this.sapXepDangChon) {
      case 'ten_tang':
        result.sort((a, b) =>
          a.tenTheLoai.localeCompare(b.tenTheLoai, 'vi')
        );
        break;

      case 'ten_giam':
        result.sort((a, b) =>
          b.tenTheLoai.localeCompare(a.tenTheLoai, 'vi')
        );
        break;

      case 'game_giam':
        result.sort((a, b) =>
          b.danhSachGame.length - a.danhSachGame.length
        );
        break;

      case 'game_tang':
        result.sort((a, b) =>
          a.danhSachGame.length - b.danhSachGame.length
        );
        break;
    }

    return result;
  }

  get tongTheLoai(): number {
    return this.danhSachHienThi.length;
  }

  apDungBoLoc(): void {
    this.trangHienTai = 1;
  }

  datLaiBoLoc(): void {
    this.tuKhoa = '';
    this.soLuongDangChon = 'tat_ca';
    this.sapXepDangChon = 'ten_tang';
    this.trangHienTai = 1;
    this.cacIdDaChon.clear();
  }

  chuanHoa(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }

  // =========================
  // DROPDOWN LỌC VÀ SẮP XẾP
  // =========================

moDropdownSoLuong(): void {
  this.hienDropdownSoLuong = !this.hienDropdownSoLuong;
  this.hienDropdownSapXep = false;
}

chonSoLuong(value: string): void {
  this.soLuongDangChon = value;
  this.hienDropdownSoLuong = false;
  this.trangHienTai = 1;
}

moDropdownSapXep(): void {
  this.hienDropdownSapXep = !this.hienDropdownSapXep;
  this.hienDropdownSoLuong = false;
}

chonSapXep(value: string): void {
  this.sapXepDangChon = value;
  this.hienDropdownSapXep = false;
  this.trangHienTai = 1;
}

  // =========================
  // CHỌN DANH MỤC
  // =========================

  get soLuongDaChon(): number {
    return this.cacIdDaChon.size;
  }

  get danhSachTrangHienTai(): NhomTheLoai[] {
    const start = (this.trangHienTai - 1) * this.soNhomMoiTrang;

    return this.danhSachHienThi.slice(
      start,
      start + this.soNhomMoiTrang
    );
  }

  get tatCaTrangDangChon(): boolean {
    return this.danhSachTrangHienTai.length > 0 &&
      this.danhSachTrangHienTai.every(nhom =>
        this.cacIdDaChon.has(nhom.id)
      );
  }

  get motPhanTrangDangChon(): boolean {
    return this.danhSachTrangHienTai.some(nhom =>
      this.cacIdDaChon.has(nhom.id)
    ) && !this.tatCaTrangDangChon;
  }

  chonTatCaTrang(checked: boolean): void {
  if (checked) {
    this.danhSachTrangHienTai.forEach(nhom => {
      this.cacIdDaChon.add(nhom.id);
    });
  } else {
    this.danhSachTrangHienTai.forEach(nhom => {
      this.cacIdDaChon.delete(nhom.id);
    });
  }
}

  doiChon(id: string, checked: boolean): void {
  if (checked) {
    this.cacIdDaChon.add(id);
  } else {
    this.cacIdDaChon.delete(id);
  }
}

  // =========================
  // XÓA DANH MỤC
  // =========================

  xoaTheLoai(nhom: NhomTheLoai, event?: MouseEvent): void {
  event?.stopPropagation();

  this.idsChoXoa = [nhom.id];
  this.tenTheLoaiDangXoa = nhom.tenTheLoai;
  this.hienModalXoa = true;
}

  moXacNhanXoaDaChon(): void {
    if (this.cacIdDaChon.size === 0) {
      this.thongBao = 'Vui lòng chọn ít nhất một danh mục.';
      return;
    }

    this.idsChoXoa = [...this.cacIdDaChon];
    this.tenTheLoaiDangXoa = `${this.idsChoXoa.length} danh mục đã chọn`;
    this.hienModalXoa = true;
  }

  huyXoa(): void {
    this.hienModalXoa = false;
    this.idsChoXoa = [];
    this.tenTheLoaiDangXoa = '';
  }

  async xacNhanXoa(): Promise<void> {
    if (this.idsChoXoa.length === 0) return;

    try {
      const cacNhomCanXoa = this.danhSachNhom.filter(
        nhom => this.idsChoXoa.includes(nhom.id)
      );

      if (cacNhomCanXoa.length !== this.idsChoXoa.length) {
        throw new Error('Một số danh mục không còn tồn tại. Vui lòng tải lại trang.');
      }

      await Promise.all(
        cacNhomCanXoa.map(nhom =>
          firstValueFrom(
            this.quanTri.xoaNhomTheLoai(nhom.mongoId)
          )
        )
      );

      const soLuongXoa = cacNhomCanXoa.length;

      this.hienModalXoa = false;
      this.idsChoXoa = [];
      this.tenTheLoaiDangXoa = '';
      this.cacIdDaChon.clear();

      await this.taiDanhSach();

      this.thongBao = `Đã xóa thành công ${soLuongXoa} danh mục.`;

      if (this.trangHienTai > this.tongTrang) {
        this.trangHienTai = this.tongTrang;
      }

    } catch (error: any) {
      console.error('Lỗi xóa danh mục:', error);

      this.thongBao =
        error?.error?.message ||
        error?.message ||
        'Không thể xóa danh mục. Vui lòng thử lại.';

      this.hienModalXoa = false;
    }
  }

  // =========================
  // PHÂN TRANG
  // =========================

  get tongTrang(): number {
    return Math.max(
      1,
      Math.ceil(this.danhSachHienThi.length / this.soNhomMoiTrang)
    );
  }

  get danhSachTrang(): number[] {
    return Array.from(
      { length: this.tongTrang },
      (_, index) => index + 1
    );
  }

  doiTrang(trang: number): void {
    if (trang < 1 || trang > this.tongTrang) return;

    this.trangHienTai = trang;
  }

  // =========================
  // ĐIỀU HƯỚNG
  // =========================

  moChiTiet(nhom: NhomTheLoai): void {
    this.router.navigate(['/admin/categories', nhom.id]);
  }

  taoDanhMucMoi(): void {
    this.router.navigate(['/admin/categories/tao-moi']);
  }

  // =========================
  // XUẤT FILE CSV
  // =========================

  xuatCSV(): void {
    const headers = [
      'Mã danh mục',
      'Tên danh mục',
      'Mô tả',
      'Số lượng trò chơi',
      'Danh sách mã trò chơi'
    ];

    const rows = this.danhSachHienThi.map(nhom => [
      nhom.id,
      nhom.tenTheLoai,
      nhom.moTa,
      nhom.danhSachGame.length,
      nhom.danhSachGame.join(', ')
    ]);

    const escapeCSV = (value: any): string => {
      const text = String(value ?? '').replace(/"/g, '""');
      return `"${text}"`;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\r\n');

    const blob = new Blob(
      ['\uFEFF' + csvContent],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'danh-sach-danh-muc.csv';
    link.click();

    URL.revokeObjectURL(url);
  }
  trackById(index: number, item: NhomTheLoai): string {
  return item.id;
}
get nhanSapXepDangChon(): string {
  return this.danhSachKieuSapXep.find(
    item => item.value === this.sapXepDangChon
  )?.label || 'Mặc định';
}
get nhanSoLuongDangChon(): string {
  return this.danhSachMucSoLuong.find(
    item => item.value === this.soLuongDangChon
  )?.label || 'Tất cả số lượng';
}
}
