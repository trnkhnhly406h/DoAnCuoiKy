import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { OTHER_COUNTRY, POPULAR_COUNTRIES, UserProfile, UserProfileService } from '../../services/user-profile';

const OUTPUT_SIZE = 300;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const URL_REGEX = /^[a-zA-Z0-9_-]{3,32}$/;

@Component({
  selector: 'app-sua-ho-so',
  templateUrl: './sua-ho-so.html',
  styleUrls: ['./sua-ho-so.css'],
  standalone: false
})
export class SuaHoSoComponent implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  /** Canvas chỉ tồn tại khi người dùng đã chọn ảnh mới (*ngIf), nên dùng setter để vẽ ngay khi nó xuất hiện. */
  @ViewChild('cropCanvas') set canvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.canvas = ref?.nativeElement ?? null;
    if (this.canvas) this.draw();
  }

  readonly otherCountry = OTHER_COUNTRY;
  readonly countries = POPULAR_COUNTRIES;
  readonly bioMaxLength = 300;

  formData!: UserProfile;
  customCountry = '';

  touched = { username: false, searchUrl: false, country: false };
  submitted = false;

  hasNewImage = false;
  zoomScale = 1;
  isDragging = false;

  private canvas: HTMLCanvasElement | null = null;
  private image: HTMLImageElement | null = null;
  private panX = 0;
  private panY = 0;
  private lastX = 0;
  private lastY = 0;

  constructor(
    public profileService: UserProfileService,
    public authService: AuthService,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // Bản sao để chỉnh sửa, chỉ ghi vào profile khi bấm Lưu.
    this.formData = { ...this.profileService.profile };
    if (!this.countries.includes(this.formData.country)) {
      this.customCountry = this.formData.country;
      this.formData.country = this.otherCountry;
    }
  }

  /* ---------- Kiểm tra dữ liệu ---------- */

  get usernameError(): string | null {
    const name = this.formData.username.trim();
    if (!name) return 'Tên hiển thị không được để trống!';
    if (name.length < 2) return 'Tên hiển thị cần ít nhất 2 ký tự.';
    if (name.length > 32) return 'Tên hiển thị tối đa 32 ký tự.';
    return null;
  }

  get urlError(): string | null {
    const url = this.formData.searchUrl.trim();
    if (!url) return 'URL tìm kiếm không được để trống!';
    if (!URL_REGEX.test(url)) return 'URL gồm 3-32 ký tự: chữ cái không dấu, số, "_" hoặc "-" (không có khoảng trắng).';
    return null;
  }

  get countryError(): string | null {
    if (this.formData.country === this.otherCountry && this.customCountry.trim().length < 2) {
      return 'Vui lòng nhập tên quốc gia của bạn.';
    }
    return null;
  }

  show(field: 'username' | 'searchUrl' | 'country'): boolean {
    return this.submitted || this.touched[field];
  }

  get hasErrors(): boolean {
    return !!(this.usernameError || this.urlError || this.countryError);
  }

  /* ---------- Ảnh đại diện ---------- */

  triggerFileInput(): void {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // cho phép chọn lại cùng một file
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.warning('Vui lòng chọn một tệp hình ảnh (PNG, JPG, WEBP...).');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.warning('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => this.toast.warning('Không đọc được tệp ảnh. Vui lòng thử lại.');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => this.toast.warning('Tệp ảnh bị lỗi hoặc không được hỗ trợ.');
      img.onload = () => {
        this.image = img;
        this.zoomScale = 1;
        this.panX = 0;
        this.panY = 0;
        this.hasNewImage = true;
        this.draw(); // trường hợp canvas đã tồn tại từ lần chọn trước
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onZoom(event: Event): void {
    this.zoomScale = (event.target as HTMLInputElement).valueAsNumber;
    this.clampPan();
    this.draw();
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.image) return;
    this.isDragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || !this.image || !this.canvas) return;
    const displayWidth = this.canvas.getBoundingClientRect().width || 200;
    const scale = this.cropSize() / displayWidth;
    this.panX += (event.clientX - this.lastX) * scale;
    this.panY += (event.clientY - this.lastY) * scale;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.clampPan();
    this.draw();
  }

  onPointerUp(): void {
    this.isDragging = false;
  }

  onCanvasKey(event: KeyboardEvent): void {
    const step = this.cropSize() * 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]
    };
    const move = moves[event.key];
    if (!move || !this.image) return;
    event.preventDefault();
    this.panX += move[0];
    this.panY += move[1];
    this.clampPan();
    this.draw();
  }

  private cropSize(): number {
    if (!this.image) return OUTPUT_SIZE;
    return Math.min(this.image.width, this.image.height) / this.zoomScale;
  }

  /** Giữ khung cắt luôn nằm trong ảnh gốc (lưu luôn giá trị đã giới hạn, tránh bị "kẹt" khi kéo ngược). */
  private clampPan(): void {
    if (!this.image) return;
    const size = this.cropSize();
    const maxX = (this.image.width - size) / 2;
    const maxY = (this.image.height - size) / 2;
    this.panX = Math.max(-maxX, Math.min(maxX, this.panX));
    this.panY = Math.max(-maxY, Math.min(maxY, this.panY));
  }

  private draw(): void {
    if (!this.image || !this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.canvas.width = OUTPUT_SIZE;
    this.canvas.height = OUTPUT_SIZE;
    const size = this.cropSize();
    const sx = (this.image.width - size) / 2 - this.panX;
    const sy = (this.image.height - size) / 2 - this.panY;
    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(this.image, sx, sy, size, size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  /* ---------- Lưu / hủy ---------- */

 /* ---------- Lưu / hủy ---------- */

  async onSave(): Promise<void> {
    this.submitted = true;
    if (this.hasErrors) {
      this.toast.warning('Vui lòng kiểm tra lại các trường báo lỗi.');
      return;
    }

    let avatarUrl = this.formData.avatarUrl;
    if (this.hasNewImage && this.canvas) {
      this.draw();
      avatarUrl = this.canvas.toDataURL('image/png');
    }

    await this.profileService.updateProfile({
      username: this.formData.username.trim(),
      realName: this.formData.realName.trim(),
      country: this.formData.country === this.otherCountry ? this.customCountry.trim() : this.formData.country,
      bio: this.formData.bio.trim(),
      searchUrl: this.formData.searchUrl.trim(),
      avatarUrl,
      showGames: this.formData.showGames,
      showWishlist: this.formData.showWishlist,
      showFriends: this.formData.showFriends
    });

    this.toast.success('Đã lưu hồ sơ thành công vào hệ thống!');
    this.router.navigate(['/ho-so']);
  }

  // BỔ SUNG HÀM HỦY BỎ ĐỂ GIẢI QUYẾT LỖI TS2339
  onCancel(): void {
    this.router.navigate(['/ho-so']);
  }
}
