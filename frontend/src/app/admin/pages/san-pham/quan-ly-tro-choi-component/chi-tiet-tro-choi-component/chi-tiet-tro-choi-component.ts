import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { QuanTri } from '../../../../../services/quan-tri';

interface YeuCauHeThong {
  hangMuc: string;
  toiThieu: string;
  deNghi: string;
}

interface TheLoaiMongo {
  maTheLoai: string;
  tenTheLoai: string;
}

@Component({
  selector: 'app-chi-tiet-tro-choi-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chi-tiet-tro-choi-component.html',
  styleUrl: './chi-tiet-tro-choi-component.css'
})
export class ChiTietTroChoiComponent implements OnInit {

  dangThemMoi = true;

  // _id của MongoDB
  id = '';

  // Mã game hiển thị cho người quản trị
  maGame = '';

  tenGame = '';

  // Đường dẫn thân thiện (Slug / URL)
  duongDanSlug = '';
  choPhepSuaSlug = false; // Mặc định khóa nếu chỉnh sửa game cũ

  theLoai: string[] = [];

  gia: number | null = null;
  phanTramGiamGia: number | null = null;

  doTuoi = '';
  nhaPhatTrien = '';
  nhaPhatHanh = '';
  ngayPhatHanh = '';

  moTaNgan = '';
  moTaChiTiet = '';

  hinhAnh: string[] = [];
  video = '';

  yeuCauHeThong: YeuCauHeThong[] = this.taoYeuCauRong();

  hienDropdownTheLoai = false;
  hienPopupThongBao = false;
  hienPopupThemUrl = false;

  laThanhCong = false;
  thongBao = '';
  loi = '';

  loaiMediaThem: 'image' | 'video' = 'image';
  urlMedia = '';

  dangTaiDuLieu = false;
  dangLuu = false;

  danhSachTheLoai: string[] = [];

  private danhSachTheLoaiMongo: TheLoaiMongo[] = [];

  // Lưu dữ liệu gốc để không làm mất các thuộc tính khác khi cập nhật
  private gameGoc: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private quanTri: QuanTri,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id') ?? '';

    this.dangThemMoi =
      !routeId ||
      ['new', 'them-moi', 'tao-moi'].includes(routeId.toLowerCase());

    if (this.dangThemMoi) {
      this.maGame = this.taoMaGameMoi();
      this.id = '';
      this.resetForm();
    } else {
      this.id = routeId;
    }

    // Lấy danh sách thể loại từ MongoDB trước
    this.taiDanhSachTheLoai();
  }

  // =====================================================
  // 1. TẢI DANH SÁCH THỂ LOẠI
  // =====================================================

  private taiDanhSachTheLoai(): void {
    this.quanTri.layDanhSachTheLoai().subscribe({
      next: (data: any[]) => {
        this.danhSachTheLoaiMongo = data.map(item => ({
          maTheLoai: item.maTheLoai,
          tenTheLoai: item.tenTheLoai
        }));

        this.danhSachTheLoai = this.danhSachTheLoaiMongo.map(
          item => item.tenTheLoai
        );

        // Yêu cầu Angular cập nhật giao diện
        this.cdr.detectChanges();

        if (!this.dangThemMoi) {
          this.taiChiTietTroChoi();
        }
      },

      error: (error) => {
        console.error('Lỗi tải thể loại:', error);

        this.thongBao = 'Không thể tải danh sách thể loại từ hệ thống.';
        this.laThanhCong = false;
        this.hienPopupThongBao = true;

        this.cdr.detectChanges();
      }
    });
  }

  // =====================================================
  // 2. TẢI CHI TIẾT GAME TỪ MONGODB
  // =====================================================

  private taiChiTietTroChoi(): void {
    this.dangTaiDuLieu = true;

    console.log('ID game cần tải:', this.id);

    this.quanTri.layChiTietTroChoi(this.id).subscribe({
      next: (game: any) => {
        console.log('Dữ liệu game nhận được:', game);

        this.gameGoc = game;

        this.id = String(game._id);
        this.maGame = game.maGame || '';

        // Đổ dữ liệu MongoDB vào các biến của form
        this.napDuLieu(game);

        this.dangTaiDuLieu = false;

        // Bắt buộc cập nhật giao diện ngay sau khi tải dữ liệu
        this.cdr.detectChanges();

        console.log('Dữ liệu sau khi đổ vào form:', {
          tenGame: this.tenGame,
          duongDanSlug: this.duongDanSlug,
          theLoai: this.theLoai,
          gia: this.gia,
          nhaPhatTrien: this.nhaPhatTrien,
          nhaPhatHanh: this.nhaPhatHanh,
          hinhAnh: this.hinhAnh
        });
      },

      error: (error) => {
        console.error('Lỗi tải chi tiết game:', error);

        this.dangTaiDuLieu = false;
        this.laThanhCong = false;

        this.thongBao =
          error.error?.message || 'Không thể tải thông tin trò chơi.';

        this.hienPopupThongBao = true;

        this.cdr.detectChanges();
      }
    });
  }

  // =====================================================
  // 3. TIÊU ĐỀ VÀ GIÁ
  // =====================================================

  get tenTieuDe(): string {
    return this.dangThemMoi
      ? 'Tạo sản phẩm mới'
      : (this.tenGame || this.maGame || this.id);
  }

  get giaDaGiam(): number {
    const giaGoc = Math.max(0, Math.round(Number(this.gia) || 0));
    const giamGia = Math.min(
      100,
      Math.max(0, Math.round(Number(this.phanTramGiamGia) || 0))
    );

    // Nếu giảm giá = 0% thì trả về đúng bằng giá gốc, tránh sai số số thực
    if (giamGia === 0) {
      return giaGoc;
    }

    return Math.round((giaGoc * (100 - giamGia)) / 100);
  }

  get videoEmbedUrl(): SafeResourceUrl | null {
    if (!this.video) return null;

    const url = this.chuanHoaVideoUrl(this.video);

    return url
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
      : null;
  }

  // =====================================================
  // 4. XỬ LÝ VIDEO
  // =====================================================

  private chuanHoaVideoUrl(url: string): string {
    const value = url.trim();

    if (value.includes('youtube.com/embed/')) return value;

    const youtubeMatch = value.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/
    );

    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    if (value.includes('player.vimeo.com/video/')) return value;

    const vimeoMatch = value.match(/vimeo\.com\/(\d+)/);

    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return '';
  }

  // =====================================================
  // 5. XỬ LÝ THỂ LOẠI & SLUG
  // =====================================================

  onTenGameChange(): void {
    if (this.dangThemMoi) {
      this.duongDanSlug = this.taoSlug(this.tenGame);
    }
  }

  batTatSuaSlug(): void {
    this.choPhepSuaSlug = !this.choPhepSuaSlug;
  }

  chuyenTheLoai(value: string): void {
    this.theLoai = this.theLoai.includes(value)
      ? this.theLoai.filter(x => x !== value)
      : [...this.theLoai, value];
  }

  coTheLoai(value: string): boolean {
    return this.theLoai.includes(value);
  }

  dongDropdown(): void {
    this.hienDropdownTheLoai = false;
  }

  private chuanHoa(value: string): string {
    return String(value || '')
      .toLocaleLowerCase('vi')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
  }

  // Chuyển tên thể loại thành mã thể loại trong MongoDB
  private layMaTheLoai(): string[] {
    return this.theLoai.map(ten => {
      const category = this.danhSachTheLoaiMongo.find(
        item => this.chuanHoa(item.tenTheLoai) === this.chuanHoa(ten)
      );

      return category?.maTheLoai || '';
    });
  }

  // =====================================================
  // 6. XỬ LÝ ẢNH
  // =====================================================

  themAnhTuMay(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    for (const file of files) {
      if (this.hinhAnh.length >= 3) break;

      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();

      reader.onload = () => {
        if (
          typeof reader.result === 'string' &&
          this.hinhAnh.length < 3
        ) {
          this.hinhAnh = [...this.hinhAnh, reader.result];
        }
      };

      reader.readAsDataURL(file);
    }

    input.value = '';
  }

  moThemUrl(): void {
    this.loaiMediaThem = 'image';
    this.urlMedia = '';
    this.loi = '';
    this.hienPopupThemUrl = true;
  }

  moThemVideo(): void {
    this.loaiMediaThem = 'video';
    this.urlMedia = this.video;
    this.loi = '';
    this.hienPopupThemUrl = true;
  }

  xacNhanThemUrl(): void {
    const url = this.urlMedia.trim();

    if (!url) {
      this.loi = 'Vui lòng nhập URL.';
      return;
    }

    if (this.loaiMediaThem === 'image') {
      if (this.hinhAnh.length >= 3) {
        this.loi = 'Chỉ được thêm tối đa 3 ảnh.';
        return;
      }

      this.hinhAnh = [...this.hinhAnh, url];
    } else {
      this.video = url;
    }

    this.hienPopupThemUrl = false;
  }

  doiViTriAnh(index: number, direction: -1 | 1): void {
    const nextIndex = index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= this.hinhAnh.length
    ) {
      return;
    }

    const copy = [...this.hinhAnh];

    [copy[index], copy[nextIndex]] = [
      copy[nextIndex],
      copy[index]
    ];

    this.hinhAnh = copy;
  }

  xoaAnh(index: number): void {
    this.hinhAnh = this.hinhAnh.filter((_, i) => i !== index);
  }

  // =====================================================
  // 7. CẤU HÌNH HỆ THỐNG
  // =====================================================

  capNhatYeuCau(
    index: number,
    field: 'toiThieu' | 'deNghi',
    value: string
  ): void {
    this.yeuCauHeThong[index][field] = value;
  }

  // =====================================================
  // 8. ĐIỀU HƯỚNG
  // =====================================================

  quayVe(): void {
    window.history.back();
  }

  huy(): void {
    this.quayVe();
  }

  // =====================================================
  // 9. LƯU GAME VÀO MONGODB
  // =====================================================

  luuSanPham(): void {
    if (this.dangLuu) return;

    // Kiểm tra giảm giá (Cho phép từ 0% đến 100%)
    let discountVal = 0;

    if (
      this.phanTramGiamGia !== null &&
      this.phanTramGiamGia !== undefined &&
      (this.phanTramGiamGia as any) !== ''
    ) {
      discountVal = Number(this.phanTramGiamGia);

      if (
        !Number.isFinite(discountVal) ||
        discountVal < 0 ||
        discountVal > 100
      ) {
        this.hienLoi(
          'Mức giảm giá phải có giá trị từ 0% đến 100%.'
        );
        return;
      }
    }

    // Kiểm tra các ô cấu hình
    const coOHeThongTrong = this.yeuCauHeThong.some(
      item => !item.toiThieu.trim() || !item.deNghi.trim()
    );

    // Kiểm tra trường bắt buộc
    if (
      !this.tenGame.trim() ||
      this.theLoai.length === 0 ||
      this.gia === null ||
      this.gia === undefined ||
      !Number.isFinite(Number(this.gia)) ||
      Number(this.gia) < 0 ||
      !this.doTuoi.trim() ||
      !this.nhaPhatTrien.trim() ||
      !this.nhaPhatHanh.trim() ||
      !this.ngayPhatHanh ||
      !this.moTaNgan.trim() ||
      !this.moTaChiTiet.trim() ||
      this.hinhAnh.length < 1 ||
      coOHeThongTrong
    ) {
      this.hienLoi(
        'Vui lòng điền đầy đủ thông tin bắt buộc, thêm ít nhất 1 hình ảnh và nhập đầy đủ cấu hình hệ thống.'
      );
      return;
    }

    // Chuyển tên thể loại thành mã thể loại
    const maTheLoai = this.layMaTheLoai();

    if (maTheLoai.some(ma => !ma)) {
      this.hienLoi(
        'Có thể loại chưa tồn tại trong cơ sở dữ liệu. Vui lòng kiểm tra danh sách thể loại.'
      );
      return;
    }

    // Lấy các thể loại đặc biệt đã có từ dữ liệu gốc
    const maTheLoaiCu: string[] = this.gameGoc?.maTheLoai || [];
    const tenTheLoaiCu: string[] = this.gameGoc?.tenTheLoai || [];

    const categoryIds = new Set(
      this.danhSachTheLoaiMongo.map(item => item.maTheLoai)
    );

    const theLoaiDacBiet: { ma: string; ten: string }[] = [];

    maTheLoaiCu.forEach((ma, index) => {
      if (!categoryIds.has(ma)) {
        theLoaiDacBiet.push({
          ma,
          ten: tenTheLoaiCu[index] || ma
        });
      }
    });

    const danhSachMaTheLoai = [
      ...maTheLoai,
      ...theLoaiDacBiet.map(item => item.ma)
    ];

    const danhSachTenTheLoai = [
      ...this.theLoai,
      ...theLoaiDacBiet.map(item => item.ten)
    ];

    // Lấy giá gốc và mức giảm giá
    const giaGoc = Math.max(0, Math.round(Number(this.gia) || 0));
    discountVal = Math.min(100, Math.max(0, Math.round(Number(this.phanTramGiamGia) || 0)));

    const finalPrice = discountVal > 0
      ? Math.round((giaGoc * (100 - discountVal)) / 100)
      : giaGoc;

    const gameData: any = {
      tenTroChoi: this.tenGame.trim(),

      giaGoc,
      phanTramGiamGia: discountVal,
      giaHienTai: finalPrice,

      anhBia: this.hinhAnh[0],
      anhThuNho: this.hinhAnh[0],
      danhSachAnh: [...this.hinhAnh],
      videoTrailer: this.video.trim(),

      maTheLoai: danhSachMaTheLoai,
      tenTheLoai: danhSachTenTheLoai,

      doTuoi: Number(this.doTuoi),

      nhaPhatTrien: this.nhaPhatTrien.trim(),
      nhaPhatHanh: this.nhaPhatHanh.trim(),
      ngayPhatHanh: this.ngayPhatHanh,

      moTaNgan: this.moTaNgan.trim(),
      moTaChiTiet: this.moTaChiTiet.trim(),

      laGameNoiBat: Boolean(this.gameGoc?.laGameNoiBat),
      laGameMoi: Boolean(this.gameGoc?.laGameMoi),
      laGameMienPhi: giaGoc === 0,
      laGameBanChay: Boolean(this.gameGoc?.laGameBanChay),
      laGameUuDai: discountVal > 0,

      // Cấu hình tối thiểu
      osToiThieu: this.yeuCauHeThong[0].toiThieu,
      cpuToiThieu: this.yeuCauHeThong[1].toiThieu,
      ramToiThieu: this.yeuCauHeThong[2].toiThieu,
      gpuToiThieu: this.yeuCauHeThong[3].toiThieu,
      diskToiThieu: this.yeuCauHeThong[4].toiThieu,

      // Cấu hình đề nghị
      osDeNghi: this.yeuCauHeThong[0].deNghi,
      cpuDeNghi: this.yeuCauHeThong[1].deNghi,
      ramDeNghi: this.yeuCauHeThong[2].deNghi,
      gpuDeNghi: this.yeuCauHeThong[3].deNghi,
      diskDeNghi: this.yeuCauHeThong[4].deNghi
    };

    if (this.dangThemMoi) {
      const suffix = Date.now();

      gameData.maGame = this.maGame || `GAME${suffix}`;
      const slugInput = this.taoSlug(this.duongDanSlug || this.tenGame);
      gameData.duongDanSlug = slugInput ? `${slugInput}-${suffix}` : `game-${suffix}`;
    } else {
      // Khi cập nhật game: nếu admin mở khóa và sửa slug
      if (this.duongDanSlug && this.duongDanSlug.trim()) {
        gameData.duongDanSlug = this.taoSlug(this.duongDanSlug);
      }
    }

    this.dangLuu = true;

    const request = this.dangThemMoi
      ? this.quanTri.themTroChoi(gameData)
      : this.quanTri.capNhatTroChoi(this.id, gameData);

    request.subscribe({
      next: (response: any) => {
        this.dangLuu = false;

        if (response && response.success === false) {
          this.hienLoi(
            response.message || 'Không thể lưu thông tin trò chơi.'
          );
          return;
        }

        if (response?.data?._id) {
          this.id = String(response.data._id);
        }

        if (response?.data?.maGame) {
          this.maGame = response.data.maGame;
        }

        this.laThanhCong = true;
        this.thongBao = this.dangThemMoi
          ? 'Thêm trò chơi mới thành công!'
          : 'Cập nhật thông tin trò chơi thành công!';

        this.hienPopupThongBao = true;
      },

      error: (error) => {
        console.error('Lỗi lưu trò chơi:', error);

        this.dangLuu = false;

        this.hienLoi(
          error.error?.message ||
          error.message ||
          'Không thể lưu trò chơi. Vui lòng thử lại.'
        );
      }
    });
  }

  private taoSlug(value: string): string {
    return this.chuanHoa(value)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private hienLoi(message: string): void {
    this.laThanhCong = false;
    this.thongBao = message;
    this.hienPopupThongBao = true;
  }

  dongPopupThongBao(): void {
    this.hienPopupThongBao = false;

    if (this.laThanhCong) {
      this.quayVe();
    }
  }

  formatGia(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
  }

  // =====================================================
  // 10. ĐỔ DỮ LIỆU MONGODB LÊN FORM
  // =====================================================

  private napDuLieu(game: any): void {
    this.id = String(game._id);
    this.maGame = game.maGame || '';

    this.tenGame = game.tenTroChoi || '';
    this.duongDanSlug = game.duongDanSlug || '';
    this.choPhepSuaSlug = false;

    // Loại bỏ các nhãn đặc biệt khỏi danh sách thể loại thông thường
    const tenTheLoai = game.tenTheLoai || [];

    const theLoaiDacBiet = [
      'Game nổi bật',
      'Game mới',
      'Game mới ra mắt',
      'Miễn phí',
      'Bán chạy nhất',
      'Ưu đãi'
    ];

    this.theLoai = tenTheLoai.filter(
      (ten: string) =>
        !theLoaiDacBiet.some(
          dacBiet => this.chuanHoa(dacBiet) === this.chuanHoa(ten)
        )
    );

    // Nếu dữ liệu cũ chỉ có mã thể loại
    if (this.theLoai.length === 0 && game.maTheLoai?.length) {
      this.theLoai = game.maTheLoai
        .map((ma: string) => {
          const category = this.danhSachTheLoaiMongo.find(
            item => item.maTheLoai === ma
          );

          return category?.tenTheLoai || '';
        })
        .filter(Boolean);
    }

    this.gia = Number(game.giaGoc) || 0;
    const phanTramGiamGia = Number(game.phanTramGiamGia) || 0;

    // Nếu dữ liệu cũ lưu 0.1 thì chuyển thành 10 (%)
    this.phanTramGiamGia =
      phanTramGiamGia > 0 && phanTramGiamGia <= 1
        ? phanTramGiamGia * 100
        : phanTramGiamGia;

    this.doTuoi = game.doTuoi != null
      ? String(game.doTuoi)
      : '';

    this.nhaPhatTrien = game.nhaPhatTrien || '';
    this.nhaPhatHanh = game.nhaPhatHanh || '';

    this.ngayPhatHanh = game.ngayPhatHanh
      ? new Date(game.ngayPhatHanh).toISOString().slice(0, 10)
      : '';

    this.moTaNgan = game.moTaNgan || '';
    this.moTaChiTiet = game.moTaChiTiet || '';

    this.hinhAnh = [
      ...(game.danhSachAnh?.length
        ? game.danhSachAnh
        : game.anhBia
          ? [game.anhBia]
          : [])
    ].slice(0, 3);

    this.video = game.videoTrailer || '';

    this.yeuCauHeThong = [
      {
        hangMuc: 'Hệ điều hành',
        toiThieu: game.osToiThieu || '',
        deNghi: game.osDeNghi || ''
      },
      {
        hangMuc: 'CPU',
        toiThieu: game.cpuToiThieu || '',
        deNghi: game.cpuDeNghi || ''
      },
      {
        hangMuc: 'RAM',
        toiThieu: game.ramToiThieu || '',
        deNghi: game.ramDeNghi || ''
      },
      {
        hangMuc: 'GPU',
        toiThieu: game.gpuToiThieu || '',
        deNghi: game.gpuDeNghi || ''
      },
      {
        hangMuc: 'Disk',
        toiThieu: game.diskToiThieu || '',
        deNghi: game.diskDeNghi || ''
      }
    ];
  }

  // =====================================================
  // 11. RESET FORM
  // =====================================================

  private resetForm(): void {
    this.tenGame = '';
    this.duongDanSlug = '';
    this.choPhepSuaSlug = false;
    this.theLoai = [];

    this.gia = null;
    this.phanTramGiamGia = null;

    this.doTuoi = '';
    this.nhaPhatTrien = '';
    this.nhaPhatHanh = '';
    this.ngayPhatHanh = '';

    this.moTaNgan = '';
    this.moTaChiTiet = '';

    this.hinhAnh = [];
    this.video = '';

    this.yeuCauHeThong = this.taoYeuCauRong();
  }

  private taoYeuCauRong(): YeuCauHeThong[] {
    return [
      { hangMuc: 'Hệ điều hành', toiThieu: '', deNghi: '' },
      { hangMuc: 'CPU', toiThieu: '', deNghi: '' },
      { hangMuc: 'RAM', toiThieu: '', deNghi: '' },
      { hangMuc: 'GPU', toiThieu: '', deNghi: '' },
      { hangMuc: 'Disk', toiThieu: '', deNghi: '' }
    ];
  }

  private taoMaGameMoi(): string {
    return 'GAME' + Date.now();
  }
}