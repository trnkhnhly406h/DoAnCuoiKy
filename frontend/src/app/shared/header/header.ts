import { ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { coverArt } from '../cover-art';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService } from '../../services/game-catalog';
import { NotificationItem, NotificationService } from '../../services/notification';
import { ToastService } from '../../services/toast';
import { UserProfileService } from '../../services/user-profile';

type PopupName = 'category' | 'policy' | 'notification' | 'wishlist' | 'cart' | 'user';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.css'],
  standalone: false
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authSub?: Subscription;
  activePopup: PopupName | null = null;
  searchQuery = '';
  showLogoutConfirm = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly policiesList: { label: string; route: string }[] = [
    { label: 'Hoàn tiền', route: '/chinh-sach-hoan-tien' },
    { label: 'Thỏa thuận đăng ký', route: '/thoa-thuan-dang-ky' },
    { label: 'Quyền riêng tư', route: '/quyen-rieng-tu' },
    { label: 'Cookie', route: '/cookie' }
  ];

  /** 5 thể loại nổi bật hiển thị thành thẻ lớn trong menu Danh mục. */
  readonly topCategories: { slug: string; label: string; bg: string }[];
  readonly languagesList: string[] = ['Tiếng Anh', 'Tiếng Nhật', 'Tiếng Hàn', 'Tiếng Trung', 'Tiếng Thái', 'Tiếng Việt'];

  constructor(
    public cartWishlistService: CartWishlistService,
    public authService: AuthService,
    public notificationService: NotificationService,
    public catalog: GameCatalogService,
    private profileService: UserProfileService,
    private toast: ToastService,
    private router: Router,
    private host: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    this.topCategories = ['the-gioi-mo', 'nhap-vai', 'kinh-di', 'chien-thuat', 'the-thao'].map(slug => ({
      slug,
      label: this.catalog.genreLabel(slug),
      bg: `url("${coverArt(slug, { width: 360, height: 220, variant: 2, noText: true })}")`
    }));
  }

  ngOnInit(): void {
    // Lắng nghe thay đổi trạng thái đăng nhập để cập nhật Header ngay lập tức
    this.authSub = this.authService.currentUser$.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  get currentUser(): { name: string; avatar: string } {
    return { name: this.profileService.displayName, avatar: this.profileService.avatar };
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  get isProfileSectionActive(): boolean {
    return ['/ho-so', '/sua-ho-so', '/cai-dat-tai-khoan', '/thu-vien'].some(path => this.router.url.startsWith(path));
  }

  login(): void {
    this.authService.requestLogin();
  }

  register(): void {
    this.authService.openModal('register');
  }

  /** Bước 1: bấm "Đăng xuất" trong menu -> hiện popup hỏi lại. */
  logout(): void {
    this.closePopupImmediately();
    this.showLogoutConfirm = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  /** Bước 2: xác nhận -> đăng xuất thật và về trang chủ. */
  confirmLogout(): void {
    this.showLogoutConfirm = false;
    this.authService.logout();
    this.cdr.detectChanges();
    this.router.navigate(['/']).finally(() => this.toast.success('Bạn đã đăng xuất.'));
  }

  selectLanguage(language: string): void {
    if (language === 'Tiếng Việt') {
      this.toast.success('Bạn đang sử dụng Tiếng Việt.');
    } else {
      this.toast.warning(`${language} sẽ sớm được hỗ trợ. Hiện tại STEAL chỉ có Tiếng Việt.`);
    }
  }

  submitSearch(): void {
    const query = this.searchQuery.trim();
    if (!query) return;
    this.closePopupImmediately();
    this.router.navigate(['/tim-kiem'], { queryParams: { q: query } });
  }

  clearSearch(): void {
    this.searchQuery = '';
  }

  openPopup(name: PopupName): void {
    this.cancelCloseTimer();
    this.activePopup = name;

    // Khi mở popup thông báo, tải dữ liệu mới nhất từ Backend.
    if (name === 'notification' && this.authService.isLoggedIn) {
      void this.notificationService.refreshFromServer();
    }
  }

  togglePopup(name: PopupName): void {
    if (this.activePopup === name) this.closePopupImmediately();
    else this.openPopup(name);
  }

  closePopupImmediately(): void {
    this.cancelCloseTimer();
    this.activePopup = null;
  }

  onMouseLeavePopup(): void {
    this.cancelCloseTimer();
    this.closeTimer = setTimeout(() => (this.activePopup = null), 3000);
  }

  onMouseEnterPopup(): void {
    this.cancelCloseTimer();
  }

  /** Đóng menu sau một khoảng ngắn (cho phép di chuột từ nút sang bảng menu). */
  scheduleClose(ms: number): void {
    this.cancelCloseTimer();
    this.closeTimer = setTimeout(() => (this.activePopup = null), ms);
  }

  private cancelCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.activePopup && !this.host.nativeElement.contains(event.target as Node)) {
      this.closePopupImmediately();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.showLogoutConfirm = false;
    this.closePopupImmediately();
  }

  openNotification(item: NotificationItem): void {
    this.notificationService.markRead(item);
  }

  markSelected(read: boolean): void {
    if (this.notificationService.selectedCount === 0) {
      this.toast.warning('Hãy chọn ít nhất một thông báo.');
      return;
    }
    this.notificationService.setSelectedRead(read);
  }

  deleteSelected(): void {
    if (this.notificationService.selectedCount === 0) {
      this.toast.warning('Hãy chọn ít nhất một thông báo để xóa.');
      return;
    }
    this.notificationService.deleteSelected();
  }

  trackById(_: number, item: { id: number | string }): number | string {
    return item.id;
  }

  /** Mở giỏ hàng để bắt đầu quy trình thanh toán (giỏ hàng → quà tặng → thanh toán). */
  goToCart(): void {
    this.closePopupImmediately();
    this.router.navigate(['/gio-hang']);
  }

  goToWishlist(): void {
    this.closePopupImmediately();
    this.router.navigate(['/danh-sach-uoc']);
  }

  goToGameDetail(id: string): void {
    this.closePopupImmediately();
    this.router.navigate(['/game', id]);
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.cancelCloseTimer();
  }
}