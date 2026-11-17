
import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { QuanTri } from '../../../../../services/quan-tri';


export interface GameItem {
  id: string;
  mongoId: string;
  tenGame: string;
  theLoai: string[];
  maTheLoai: string[];
  nhaPhatHanh: string;
  hinhAnh: string;
  giaGoc?: number;
  phanTramGiamGia?: number;
  laGiamGiaRieng?: boolean; 
}

export interface NhomSanPham {
  id: string;
  mongoId: string;
  tenTheLoai: string;
  moTa: string;
  danhSachGame: string[];
}

@Component({
  selector: 'app-chi-tiet-danh-muc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chi-tiet-danh-muc-component.html',
  styleUrl: './chi-tiet-danh-muc-component.css'
})
export class ChiTietDanhMucComponent implements OnInit {

  danhSachNhom: NhomSanPham[] = [];
  danhSachGame: GameItem[] = [];

  dangThemMoi = false;
  dangTaiDuLieu = false;
  dangLuu = false;

  maNhom = '';
  tenNhom = '';
  moTa = '';

phanTramGiamGiaNhom: number = 0;
  gameTrongNhom: GameItem[] = [];
  gameBanDau: string[] = [];

  timKiemGame = '';
  sapXepTheo = 'tenGame';
  trangGame = 1;
  soGameMoiTrang = 5;

  showPopupThemGame = false;
  timKiemPopup = '';
  theLoaiPopup = '';
  gameDuocChon = new Set<string>();
trangPopupHienTai = 1;
  soGamePopupMoiTrang = 6;

  showPopupXoa = false;
  gameChoXoa: GameItem | null = null;
  tieuDeXoa = '';
  noiDungXoa = '';

  showPopupThongBao = false;
  thongBao = '';

  showPopupLoi = false;
  loi = '';

  private mongoIdNhom = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private quanTri: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiNhomTheoRoute();
  }

  // =========================
  // TẢI DỮ LIỆU TỪ BACKEND
  // =========================

  async taiNhomTheoRoute(): Promise<void> {
    this.dangTaiDuLieu = true;

    try {
      const [categories, games] = await Promise.all([
        firstValueFrom(this.quanTri.layDanhSachTheLoai()),
        firstValueFrom(this.quanTri.layDanhSachTroChoi())
      ]);

      this.danhSachGame = (games || []).map((game: any) => {
        const discountVal = Number(game.phanTramGiamGia) || 0;
        const phanTram = discountVal > 0 && discountVal <= 1 ? discountVal * 100 : discountVal;
        return {
          mongoId: game._id,
          id: game.maGame,
          tenGame: game.tenTroChoi,
          theLoai: game.tenTheLoai || [],
          maTheLoai: game.maTheLoai || [],
          nhaPhatHanh: game.nhaPhatHanh || '',
          hinhAnh: game.anhBia || game.anhThuNho || '',
          giaGoc: Number(game.giaGoc) || 0,
          phanTramGiamGia: phanTram,
          laGiamGiaRieng: phanTram > 0
        };
        
      });
      

      this.danhSachNhom = (categories || []).map((category: any) => ({
        mongoId: category._id,
        id: category.maTheLoai,
        tenTheLoai: category.tenTheLoai,
        moTa: category.moTa || '',
        danhSachGame: this.danhSachGame
          .filter(game => game.maTheLoai.includes(category.maTheLoai))
          .map(game => game.id)
      }));

      const routeId = this.route.snapshot.paramMap.get('id') || '';

      if (
        routeId === 'new' ||
        routeId === 'them-moi' ||
        routeId === 'tao-moi'
      ) {
        this.dangThemMoi = true;
        this.mongoIdNhom = '';
        this.maNhom = '';
        this.tenNhom = '';
        this.moTa = '';
        this.gameTrongNhom = [];
        this.gameBanDau = [];
      } else {
        this.dangThemMoi = false;

        // 1. Phải khai báo và tìm 'nhom' trước
        const nhom = this.danhSachNhom.find(
          item => item.id === routeId || item.mongoId === routeId
        );

        if (!nhom) {
          this.loi = 'Không tìm thấy danh mục này.';
          this.showPopupLoi = true;
          return;
        }

        // 2. Sau khi đã có 'nhom' thì mới dùng nhom.id
        this.mongoIdNhom = nhom.mongoId;
        this.maNhom = nhom.id;
        this.tenNhom = nhom.tenTheLoai;
        this.moTa = nhom.moTa;

        const savedGroupDiscount = localStorage.getItem(`discount_group_${nhom.id}`);
        this.phanTramGiamGiaNhom = savedGroupDiscount ? Number(savedGroupDiscount) : (Number((nhom as any).phanTramGiamGia) || 0);

        this.gameTrongNhom = this.danhSachGame.filter(
          game => game.maTheLoai.includes(nhom.id)
        );

        this.gameBanDau = this.gameTrongNhom.map(game => game.id);
      }

    } catch (error: any) {
      console.error('Lỗi tải dữ liệu danh mục:', error);
      this.loi = error?.error?.message || 'Không thể tải dữ liệu danh mục.';
      this.showPopupLoi = true;
    } finally {
      this.dangTaiDuLieu = false;
      this.cdr.detectChanges();
    }
  }

  // =========================
  // TẠO MÃ DANH MỤC
  // =========================

  taoMaNhom(ten: string): string {
    return (ten || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private taoMaNhomKhongTrung(ten: string): string {
    const maGoc = this.taoMaNhom(ten);
    let maMoi = maGoc;
    let dem = 1;

    while (
      this.danhSachNhom.some(
        nhom => nhom.id === maMoi && nhom.id !== this.maNhom
      )
      
    ) {
      maMoi = `${maGoc}_${dem}`;
      dem++;
    }

    return maMoi;
    
  }

  maHoaTranhTrung(): boolean {
    const ten = this.normalize(this.tenNhom);

    return this.danhSachNhom.some(nhom =>
      nhom.mongoId !== this.mongoIdNhom &&
      this.normalize(nhom.tenTheLoai) === ten
    );
  }

  normalize(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
      .toLowerCase();
  }

  // =========================
  // DANH SÁCH TRÒ CHƠI
  // =========================

  get gameHienThi(): GameItem[] {
    let result = [...this.gameTrongNhom];

    const keyword = this.normalize(this.timKiemGame);

    if (keyword) {
      result = result.filter(game =>
        this.normalize(game.tenGame).includes(keyword) ||
        this.normalize(game.id).includes(keyword)
      );
    }

    if (this.sapXepTheo === 'tenGame') {
      result.sort((a, b) => a.tenGame.localeCompare(b.tenGame));
    } else if (this.sapXepTheo === 'tenGameGiam') {
      result.sort((a, b) => b.tenGame.localeCompare(a.tenGame));
    }

    return result;
  }

  get tongTrangChinh(): number {
    return Math.max(1, Math.ceil(this.gameHienThi.length / this.soGameMoiTrang));
  }


  get theLoaiCoSan(): string[] {
    return [...new Set(
      this.danhSachGame.flatMap(game => game.theLoai)
    )].filter(Boolean).sort();
  }

  apDungBoLoc(): void {
    this.trangGame = 1;
  }

  // =========================
  // POPUP THÊM TRÒ CHƠI
  // =========================

  get gamePopupHienThi(): GameItem[] {
    let result = this.danhSachGame.filter(
      game => !this.gameTrongNhom.some(item => item.id === game.id)
    );

    const keyword = this.normalize(this.timKiemPopup);

    if (keyword) {
      result = result.filter(game =>
        this.normalize(game.tenGame).includes(keyword) ||
        this.normalize(game.id).includes(keyword)
      );
    }

    if (this.theLoaiPopup) {
      result = result.filter(game =>
        game.theLoai.includes(this.theLoaiPopup)
      );
    }

    return result.sort((a, b) =>
      a.tenGame.localeCompare(b.tenGame)
    );
  }

  get tongTrangPopup(): number {
    return Math.max(
      1,
      Math.ceil(this.gamePopupHienThi.length / this.soGamePopupMoiTrang)
    );
  }

  get gamePopupTrangHienTai(): GameItem[] {
    const start = (this.trangPopupHienTai - 1) * this.soGamePopupMoiTrang;
    return this.gamePopupHienThi.slice(start, start + this.soGamePopupMoiTrang);
  }

  moPopupThemGame(): void {
    this.timKiemPopup = '';
    this.theLoaiPopup = '';
    this.gameDuocChon.clear();
    this.trangPopupHienTai = 1;
    this.showPopupThemGame = true;
  }

  dongPopupThemGame(): void {
    this.showPopupThemGame = false;
    this.gameDuocChon.clear();
  }

  doiChonGame(gameId: string, checked: boolean): void {
  if (checked) {
    this.gameDuocChon.add(gameId);
  } else {
    this.gameDuocChon.delete(gameId);
  }
}

  chonTatCaTrang(checked: boolean): void {
  if (checked) {
    this.gamePopupTrangHienTai.forEach(game => {
      this.gameDuocChon.add(game.id);
    });
  } else {
    this.gamePopupTrangHienTai.forEach(game => {
      this.gameDuocChon.delete(game.id);
    });
  }
}

  get tatCaGameTrangDaChon(): boolean {
    return this.gamePopupTrangHienTai.length > 0 &&
      this.gamePopupTrangHienTai.every(game =>
        this.gameDuocChon.has(game.id)
      );
  }

  trangPopupTruoc(): void {
    if (this.trangPopupHienTai > 1) {
      this.trangPopupHienTai--;
    }
  }

  trangPopupSau(): void {
    if (this.trangPopupHienTai < this.tongTrangPopup) {
      this.trangPopupHienTai++;
    }
  }

  themGameDaChon(): void {
    const gamesMoi = this.danhSachGame.filter(game =>
      this.gameDuocChon.has(game.id) &&
      !this.gameTrongNhom.some(item => item.id === game.id)
    );

    this.gameTrongNhom = [...this.gameTrongNhom, ...gamesMoi];

    this.dongPopupThemGame();
    this.trangGame = 1;
  }

  // =========================
  // XÓA TRÒ CHƠI KHỎI NHÓM
  // =========================

  yeuCauXoaGame(game: GameItem): void {
    this.gameChoXoa = game;
    this.tieuDeXoa = 'Xóa trò chơi khỏi danh mục?';
    this.noiDungXoa = `Bạn có chắc muốn xóa "${game.tenGame}" khỏi danh mục này không?`;
    this.showPopupXoa = true;
  }

  xacNhanXoaGame(): void {
    if (!this.gameChoXoa) return;

    this.gameTrongNhom = this.gameTrongNhom.filter(
      game => game.id !== this.gameChoXoa?.id
    );

    this.gameChoXoa = null;
    this.showPopupXoa = false;
  }

  dongXoa(): void {
    this.showPopupXoa = false;
    this.gameChoXoa = null;
  }

  // =========================
  // LƯU DANH MỤC VÀ CẬP NHẬT GAME
  // =========================

  async luuNhom(): Promise<void> {
    if (this.dangLuu) return;

    if (!this.tenNhom.trim()) {
      this.loi = 'Vui lòng nhập tên danh mục.';
      this.showPopupLoi = true;
      return;
    }

    if (this.tenNhom.trim().length > 100) {
      this.loi = 'Tên danh mục không được vượt quá 100 ký tự.';
      this.showPopupLoi = true;
      return;
    }

    if (this.maHoaTranhTrung()) {
      this.loi = 'Tên danh mục đã tồn tại. Vui lòng nhập tên khác.';
      this.showPopupLoi = true;
      return;
    }

    if (!this.moTa.trim()) {
      this.loi = 'Vui lòng nhập mô tả danh mục.';
      this.showPopupLoi = true;
      return;
    }

    this.dangLuu = true;

    try {
      let maTheLoai = this.dangThemMoi
        ? this.taoMaNhomKhongTrung(this.tenNhom)
        : this.maNhom;

      // Bước 1: Tạo mới hoặc cập nhật danh mục.
      if (this.dangThemMoi) {
        const ketQua = await firstValueFrom(
          this.quanTri.themNhomTheLoai({
            maTheLoai,
            tenTheLoai: this.tenNhom.trim(),
            moTa: this.moTa.trim()
          })
        );

        if (!ketQua?.success) {
          throw new Error(ketQua?.message || 'Không thể tạo danh mục.');
        }

        this.mongoIdNhom = ketQua.data?._id || '';
      } else {
        const ketQua = await firstValueFrom(
          this.quanTri.capNhatNhomTheLoai(this.mongoIdNhom, {
            tenTheLoai: this.tenNhom.trim(),
            moTa: this.moTa.trim()
          })
        );

        if (!ketQua?.success) {
          throw new Error(ketQua?.message || 'Không thể cập nhật danh mục.');
        }
      }

      // Bước 2: So sánh danh sách game ban đầu và danh sách hiện tại.
      const danhSachGameCanCapNhat = this.danhSachGame.filter(game => {
        const banDau = this.gameBanDau.includes(game.id);
        const hienTai = this.gameTrongNhom.some(item => item.id === game.id);

        return banDau !== hienTai;
      });

      // Bước 3: Cập nhật thể loại của từng game có thay đổi.
      await Promise.all(
        danhSachGameCanCapNhat.map(game => {
          const dangThuocNhom = this.gameTrongNhom.some(
            item => item.id === game.id
          );

          let maTheLoaiMoi = [...game.maTheLoai];
          let tenTheLoaiMoi = [...game.theLoai];

          if (dangThuocNhom) {
            if (!maTheLoaiMoi.includes(maTheLoai)) {
              maTheLoaiMoi.push(maTheLoai);
            }

            if (!tenTheLoaiMoi.includes(this.tenNhom.trim())) {
              tenTheLoaiMoi.push(this.tenNhom.trim());
            }
          } else {
            maTheLoaiMoi = maTheLoaiMoi.filter(
              ma => ma !== maTheLoai
            );

            tenTheLoaiMoi = tenTheLoaiMoi.filter(
              ten => this.normalize(ten) !== this.normalize(
                this.danhSachNhom.find(nhom => nhom.id === maTheLoai)?.tenTheLoai || this.tenNhom
              )
            );
          }

          return firstValueFrom(
            this.quanTri.capNhatTroChoi(game.mongoId, {
              maTheLoai: maTheLoaiMoi,
              tenTheLoai: tenTheLoaiMoi
            })
          );
        })
      );
      // Lưu lại % giảm giá của nhóm vào storage
      localStorage.setItem(`discount_group_${maTheLoai}`, String(this.phanTramGiamGiaNhom || 0));

      // BƯỚC 4: ÁP DỤNG % GIẢM GIÁ CHO CÁC GAME TRONG NHÓM (ƯU TIÊN % RIÊNG CỦA GAME)
      const mucGiamNhom = Math.min(100, Math.max(0, Number(this.phanTramGiamGiaNhom) || 0));

      const danhSachGameTrongNhom = this.danhSachGame.filter(game =>
        this.gameTrongNhom.some(item => item.id === game.id)
      );

      await Promise.all(
        danhSachGameTrongNhom.map(game => {
          const discountRieng = Number(game.phanTramGiamGia) || 0;
          const giaGoc = Number(game.giaGoc) || 0;

          // QUY TẮC ƯU TIÊN: Nếu game đã có % giảm riêng > 0 thì GIỮ NGUYÊN % riêng đó.
          // Nếu game chưa có giảm riêng (0%) thì mới nhận % giảm của nhóm!
          let discountCuoiCung = discountRieng > 0 ? discountRieng : mucGiamNhom;

          const giaSauGiam = Math.round(giaGoc * (1 - discountCuoiCung / 100));

          return firstValueFrom(
            this.quanTri.capNhatTroChoi(game.mongoId, {
              phanTramGiamGia: discountCuoiCung,
              giaHienTai: giaSauGiam,
              laGameUuDai: discountCuoiCung > 0
            })
          );
        })
      );
      this.thongBao = this.dangThemMoi
        ? 'Tạo danh mục mới thành công!'
        : 'Cập nhật danh mục thành công!';

      this.showPopupThongBao = true;

      // Cập nhật mã nhóm sau khi tạo mới.
      this.maNhom = maTheLoai;
      this.dangThemMoi = false;

      await this.taiLaiSauKhiLuu();

    } catch (error: any) {
      console.error('Lỗi lưu danh mục:', error);

      this.loi =
        error?.error?.message ||
        error?.message ||
        'Đã xảy ra lỗi khi lưu danh mục.';

      this.showPopupLoi = true;
    } finally {
      this.dangLuu = false;
      this.cdr.detectChanges();
    }
  }

  private async taiLaiSauKhiLuu(): Promise<void> {
    const [categories, games] = await Promise.all([
      firstValueFrom(this.quanTri.layDanhSachTheLoai()),
      firstValueFrom(this.quanTri.layDanhSachTroChoi())
    ]);

    this.danhSachGame = (games || []).map((game: any) => {
      const discountVal = Number(game.phanTramGiamGia) || 0;
      const phanTram = discountVal > 0 && discountVal <= 1 ? discountVal * 100 : discountVal;
      return {
        mongoId: game._id,
        id: game.maGame,
        tenGame: game.tenTroChoi,
        theLoai: game.tenTheLoai || [],
        maTheLoai: game.maTheLoai || [],
        nhaPhatHanh: game.nhaPhatHanh || '',
        hinhAnh: game.anhBia || game.anhThuNho || '',
        giaGoc: Number(game.giaGoc) || 0,
        phanTramGiamGia: phanTram,
        laGiamGiaRieng: phanTram > 0
      };
    });

    this.danhSachNhom = (categories || []).map((category: any) => ({
      mongoId: category._id,
      id: category.maTheLoai,
      tenTheLoai: category.tenTheLoai,
      moTa: category.moTa || '',
      danhSachGame: this.danhSachGame
        .filter(game => game.maTheLoai.includes(category.maTheLoai))
        .map(game => game.id)
    }));

    const nhom = this.danhSachNhom.find(item => item.id === this.maNhom);

    if (nhom) {
      this.mongoIdNhom = nhom.mongoId;
      this.tenNhom = nhom.tenTheLoai;
      this.moTa = nhom.moTa;

      // Đọc % giảm giá sau khi đã có biến nhom hợp lệ
      const savedGroupDiscount = localStorage.getItem(`discount_group_${nhom.id}`);
      this.phanTramGiamGiaNhom = savedGroupDiscount ? Number(savedGroupDiscount) : (Number((nhom as any).phanTramGiamGia) || 0);

      this.gameTrongNhom = this.danhSachGame.filter(
        game => game.maTheLoai.includes(nhom.id)
      );

      this.gameBanDau = this.gameTrongNhom.map(game => game.id);
    }
    this.cdr.detectChanges();
  }

  // =========================
  // ĐIỀU HƯỚNG VÀ THÔNG BÁO
  // =========================

  quayVe(): void {
    this.router.navigate(['/admin/categories']);
  }

  huy(): void {
    this.quayVe();
  }

  dongThongBao(): void {
    this.showPopupThongBao = false;

    if (!this.dangThemMoi) {
      this.router.navigate(['/admin/categories', this.maNhom]);
    }
  }

  dongLoi(): void {
    this.showPopupLoi = false;
  }
  get gameTrangHienTai(): GameItem[] {
  const start = (this.trangGame - 1) * this.soGameMoiTrang;
  return this.gameHienThi.slice(start, start + this.soGameMoiTrang);
}
}
