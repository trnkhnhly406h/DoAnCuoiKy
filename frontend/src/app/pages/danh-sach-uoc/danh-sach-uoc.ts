import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '../../models/game.model';
import { AuthService } from '../../services/auth';
import { CartItem, CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService } from '../../services/game-catalog';
import { normalizeText } from '../../services/storage';
import { ToastService } from '../../services/toast';
import { UserProfileService } from '../../services/user-profile';

export interface WishlistRow {
  item: CartItem;
  game: Game;
  tags: string[];
}

type SortKey = 'Thứ hạng' | 'Tên' | 'Mức giá' | 'Ngày thêm vào' | 'Ngày phát hành' | 'Bán chạy nhất' | 'Đánh giá';
type DiscountFilter = 'TAT_CA' | 'CHI_GIAM_GIA' | 'GIAM_50' | 'GIAM_75';

const SORT_KEYS: SortKey[] = ['Thứ hạng', 'Tên', 'Mức giá', 'Ngày thêm vào', 'Ngày phát hành', 'Bán chạy nhất', 'Đánh giá'];
const MAX_PRICE_SLIDER = 1000000;

@Component({
  selector: 'app-danh-sach-uoc',
  templateUrl: './danh-sach-uoc.html',
  styleUrls: ['./danh-sach-uoc.css'],
  standalone: false
})
export class DanhSachUocComponent implements OnInit, OnDestroy {
  readonly sortKeys = SORT_KEYS;
  readonly maxPrice = MAX_PRICE_SLIDER;

  showSortMenu = false;
  showOptionsMenu = false;
  showShareModal = false;
  shareUrl = '';
  copied = false;

  sortKey: SortKey = 'Thứ hạng';
  viewMode: 'Thu gọn' | 'Mở rộng' = 'Thu gọn';
  discountFilter: DiscountFilter = 'TAT_CA';
  maxPriceFilter = MAX_PRICE_SLIDER;
  keyword = '';

  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    public cart: CartWishlistService,
    public auth: AuthService,
    private catalog: GameCatalogService,
    private toast: ToastService,
    private router: Router,
    private profile: UserProfileService
  ) {}

  ngOnInit(): void {
    this.shareUrl = '';
  }

  ngOnDestroy(): void {
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  }

  get profileAvatar(): string {
    return this.profile.avatar;
  }

  get accountName(): string {
    return this.auth.currentUser?.username ?? 'KHÁCH';
  }

  /** Danh sách đã lọc + sắp xếp (tính lại mỗi lần để luôn khớp với danh sách ước hiện tại). */
  get rows(): WishlistRow[] {
    const q = normalizeText(this.keyword);
    const rows: WishlistRow[] = this.cart.wishlistItems
      .map(item => ({ item, game: this.catalog.getById(item.id) }))
      .filter((x): x is { item: CartItem; game: Game } => !!x.game)
      .map(x => ({ ...x, tags: this.catalog.displayTags(x.game) }));

    const filtered = rows.filter(({ item, game, tags }) => {
      if (q && !normalizeText(game.title).includes(q) && !tags.some(t => normalizeText(t).includes(q))) return false;
      if (this.discountFilter === 'CHI_GIAM_GIA' && item.discountPercent <= 0) return false;
      if (this.discountFilter === 'GIAM_50' && item.discountPercent < 50) return false;
      if (this.discountFilter === 'GIAM_75' && item.discountPercent < 75) return false;
      if (this.maxPriceFilter < MAX_PRICE_SLIDER && item.price > this.maxPriceFilter) return false;
      return true;
    });

    const sorters: Record<SortKey, (a: WishlistRow, b: WishlistRow) => number> = {
      'Thứ hạng': () => 0, // giữ thứ tự thêm vào
      'Tên': (a, b) => a.game.title.localeCompare(b.game.title, 'vi'),
      'Mức giá': (a, b) => a.item.price - b.item.price,
      'Ngày thêm vào': (a, b) => (b.item.addedAt ?? 0) - (a.item.addedAt ?? 0),
      'Ngày phát hành': (a, b) => b.game.releaseDate.localeCompare(a.game.releaseDate),
      'Bán chạy nhất': (a, b) => this.catalog.salesRank(a.game.id) - this.catalog.salesRank(b.game.id),
      'Đánh giá': (a, b) => this.catalog.reviewScore(b.game) - this.catalog.reviewScore(a.game)
    };
    return [...filtered].sort(sorters[this.sortKey]);
  }

  get priceFilterLabel(): string {
    return this.maxPriceFilter >= MAX_PRICE_SLIDER ? 'Bất kỳ mức giá nào' : `Dưới ${this.formatMoney(this.maxPriceFilter)}đ`;
  }

  /* ---------- Menu ---------- */

  toggleSortMenu(event: Event): void {
    event.stopPropagation();
    this.showSortMenu = !this.showSortMenu;
    this.showOptionsMenu = false;
  }

  toggleOptionsMenu(event: Event): void {
    event.stopPropagation();
    this.showOptionsMenu = !this.showOptionsMenu;
    this.showSortMenu = false;
  }

  closeMenus(): void {
    this.showSortMenu = false;
    this.showOptionsMenu = false;
  }

  chooseSort(key: SortKey): void {
    this.sortKey = key;
    this.showSortMenu = false;
  }

  setPriceFilter(event: Event): void {
    this.maxPriceFilter = (event.target as HTMLInputElement).valueAsNumber;
  }

  openNotificationSettings(): void {
    this.router.navigate(['/cai-dat-tai-khoan']);
  }

  /* ---------- Hành động ---------- */

  remove(id: string, event: Event): void {
    event.stopPropagation();
    this.cart.removeFromWishlist(id);
    this.toast.success('Đã xoá game khỏi danh sách ước.');
  }

  addToCart(row: WishlistRow, event: Event): void {
    event.stopPropagation();
    if (this.cart.addToCart(row.game)) this.cart.removeFromWishlist(row.game.id);
  }

  /* ---------- Chia sẻ (demo: chưa có máy chủ nên liên kết chỉ mang tính minh họa) ---------- */

  openShare(event: Event): void {
    event.stopPropagation();
    this.closeMenus();
    if (!this.shareUrl) {
      const token = Math.random().toString(36).slice(2, 10);
      this.shareUrl = `${location.origin}/danh-sach-uoc?chia-se=${token}`;
    }
    this.showShareModal = true;
  }

  closeShare(): void {
    this.showShareModal = false;
    this.copied = false;
  }

  revokeLinks(): void {
    this.shareUrl = '';
    this.toast.warning('Đã thu hồi tất cả liên kết chia sẻ.');
  }

  async copyLink(): Promise<void> {
    if (!this.shareUrl) {
      this.toast.warning('Liên kết đã bị thu hồi. Hãy mở lại hộp chia sẻ để tạo liên kết mới.');
      return;
    }
    try {
      await navigator.clipboard.writeText(this.shareUrl);
      this.copied = true;
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => (this.copied = false), 2000);
    } catch {
      this.toast.warning('Trình duyệt không cho phép sao chép tự động. Hãy chọn liên kết và nhấn Ctrl+C.');
    }
  }

  formatMoney(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }

  trackById(_: number, row: WishlistRow): string {
    return row.item.id;
  }
}
