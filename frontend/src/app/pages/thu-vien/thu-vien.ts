import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Game } from '../../models/game.model';
import { AuthService } from '../../services/auth';
import { CartWishlistService, REFUND_MAX_HOURS, RefundCheck } from '../../services/cart-wishlist';
import { ChatService, DatabaseUser } from '../../services/chat';
import { GameCatalogService } from '../../services/game-catalog';
import { DEMO_PLAY_SPEED, LibraryStatsService } from '../../services/library-stats';
import { NotificationService } from '../../services/notification';
import { normalizeText } from '../../services/storage';
import { ToastService } from '../../services/toast';
import { UserProfileService } from '../../services/user-profile';

import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';

export type SortOption = 'name-asc' | 'name-desc' | 'recent';

interface ActivityFeed {
  user: string;
  avatar: string;
  action: string;
  time: string;
}

interface GameNews {
  title: string;
  date: string;
  summary: string;
}

@Component({
  selector: 'app-thu-vien',
  templateUrl: './thu-vien.html',
  styleUrls: ['./thu-vien.css'],
  standalone: false
})
export class ThuVienComponent implements OnInit, OnDestroy {
  selectedGame: Game | null = null;
  searchQuery = '';
  sortBy: SortOption = 'name-asc';

  isLaunching = false;
  isPlaying = false;
  launchProgress = 0;
  showGameWindow = false;
  playSeconds = 0;

  // ================= MODAL CHỌN LÝ DO HOÀN TIỀN =================
  showRefundModal = false;
  isSubmittingRefund = false;
  selectedRefundReason = '1';
  customRefundReason = '';
  readonly presetRefundReasons: string[] = [
    'Trò chơi bị lỗi / văng game liên tục không chơi được',
    'Máy tính không đủ cấu hình đáp ứng trò chơi',
    'Game không hay hoặc không đúng như mô tả/quảng cáo',
    'Tôi đã mua nhầm sản phẩm này',
    'Bạn bè của tôi không còn chơi trò này nữa'
  ];

  // ================= POPUP THÔNG BÁO HOÀN TIỀN CSS ĐẸP =================
  showRefundResultModal = false;
  refundResultTitle = '';
  refundResultMessage = '';
  refundResultType: 'warning' | 'success' | 'error' = 'warning';

  recommendedGames: Game[] = [];
  private launchTimer: ReturnType<typeof setInterval> | null = null;
  private playTimer: ReturnType<typeof setInterval> | null = null;

  readonly playSpeed = DEMO_PLAY_SPEED;
  private routeSub?: Subscription;

private authSub?: Subscription;


  constructor(
    public cartWishlistService: CartWishlistService,
    public catalogService: GameCatalogService,
    public authService: AuthService,
    public stats: LibraryStatsService,
    public chat: ChatService,
    private notifications: NotificationService,
    private profile: UserProfileService,
    private toast: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refreshRecommendations();

    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (!id) {
        this.selectedGame = null;
        return;
      }
      const game = this.cartWishlistService.libraryGames.find(g => g.id === id) ?? null;
      if (!game && this.authService.isLoggedIn) {
        this.toast.warning('Bạn chưa sở hữu game này trong thư viện.');
        this.router.navigate(['/thu-vien']);
        return;
      }
      this.selectedGame = game;
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.saveSession();
    this.clearLaunchTimer();
    this.clearPlayTimer();
  }

  private saveSession(): void {
    if (this.isPlaying && this.selectedGame && this.playSeconds > 0) {
      this.stats.addSession(this.selectedGame.id, this.playSeconds);
    }
    this.playSeconds = 0;
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  get libraryGames(): Game[] {
    return this.cartWishlistService.libraryGames;
  }

  get filteredSortedGames(): Game[] {
    let list = [...this.libraryGames];
    const q = normalizeText(this.searchQuery);
    if (q) {
      list = list.filter(g =>
        normalizeText(g.title).includes(q) ||
        g.genres.some(s => normalizeText(this.catalogService.genreLabel(s)).includes(q))
      );
    }
    if (this.sortBy === 'name-asc') {
      list.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    } else if (this.sortBy === 'name-desc') {
      list.sort((a, b) => b.title.localeCompare(a.title, 'vi'));
    } else if (this.sortBy === 'recent') {
      const last = (g: Game) => this.stats.get(g.id).lastPlayedAt ?? this.cartWishlistService.getLibraryEntry(g.id)?.purchasedAt ?? 0;
      list.sort((a, b) => last(b) - last(a));
    }
    return list;
  }

  selectGame(game: Game | null): void {
    if (this.isPlaying || this.isLaunching) {
      if (this.selectedGame?.id !== game?.id) {
        this.toast.warning('Vui lòng dừng trò chơi đang chạy trước khi chuyển game!');
        return;
      }
    }
    this.selectedGame = game;
    this.playSeconds = 0;
    this.router.navigate(game ? ['/thu-vien', game.id] : ['/thu-vien'], { replaceUrl: true });
  }

  get currentPlayedHours(): number {
    if (!this.selectedGame) return 0;
    const live = this.isPlaying ? (this.playSeconds * DEMO_PLAY_SPEED) / 3600 : 0;
    return +(this.stats.hoursPlayed(this.selectedGame.id) + live).toFixed(2);
  }

  get refundCheck(): RefundCheck {
    return this.selectedGame ? this.cartWishlistService.refundCheck(this.selectedGame.id) : { ok: false, reason: '' };
  }

  get isEligibleForRefund(): boolean {
    return this.refundCheck.ok && this.currentPlayedHours <= REFUND_MAX_HOURS;
  }

  get refundBlockedReason(): string {
    return this.refundCheck.ok ? `Đã chơi ${this.currentPlayedHours}h > ${REFUND_MAX_HOURS}.0h` : this.refundCheck.reason;
  }

  get lastPlayedLabel(): string {
    return this.selectedGame ? this.stats.lastPlayedLabel(this.selectedGame.id) : '';
  }

  get purchaseInfo(): { date: number; paid: string } | null {
    const entry = this.selectedGame ? this.cartWishlistService.getLibraryEntry(this.selectedGame.id) : undefined;
    if (!entry) return null;
    const paid = entry.giftFrom ? `Quà từ ${entry.giftFrom}` : entry.paidPrice > 0 ? `${entry.paidPrice.toLocaleString('vi-VN')}đ` : 'Miễn phí';
    return { date: entry.purchasedAt, paid };
  }

  get activities(): { user: string; avatar: string; action: string; time: string }[] {
    const game = this.selectedGame;
    const entry = game ? this.cartWishlistService.getLibraryEntry(game.id) : undefined;
    if (!game || !entry) return [];
    const user = this.profile.displayName;
    const avatar = this.profile.avatar;
    const fmt = (ts: number) => new Date(ts).toLocaleDateString('vi-VN');
    const list = [{
      user, avatar,
      action: entry.giftFrom ? `Đã nhận game này từ ${entry.giftFrom} 🎁` : entry.paidPrice > 0 ? 'Đã mua game này' : 'Đã thêm game này vào thư viện',
      time: fmt(entry.purchasedAt)
    }];
    const played = this.stats.get(game.id);
    if (played.lastPlayedAt) {
      list.unshift({ user, avatar, action: `Đã chơi tổng cộng ${this.stats.hoursPlayed(game.id).toFixed(1)} giờ`, time: this.stats.lastPlayedLabel(game.id) });
    }
    return list;
  }

  get news(): { title: string; date: string; summary: string }[] {
    return this.notifications.items
      .filter(n => n.category === 'gameUpdate' || n.category === 'news')
      .slice(0, 3)
      .map(n => ({ title: n.title, date: new Date(n.createdAt).toLocaleDateString('vi-VN'), summary: n.desc }));
  }

  get onlineFriends(): DatabaseUser[] {
    return this.chat.friendsList.filter(f => f.isOnline);
  }

  openRefundModal(): void {
    if (this.isPlaying || this.isLaunching) {
      this.toast.warning('Hãy dừng trò chơi trước khi yêu cầu hoàn tiền!');
      return;
    }

    if (!this.isEligibleForRefund) {
      this.refundResultType = 'warning';
      this.refundResultTitle = 'KHÔNG THỂ HOÀN TIỀN';
      this.refundResultMessage = this.refundBlockedReason;
      this.showRefundResultModal = true;
      return;
    }

    this.selectedRefundReason = '1';
    this.customRefundReason = '';
    this.showRefundModal = true;
  }

  closeRefundModal(): void {
    this.showRefundModal = false;
  }

  closeRefundResultModal(): void {
    this.showRefundResultModal = false;
  }

  /**
   * Gửi yêu cầu hoàn tiền lên Backend.
   * Tự động đóng popup chọn lý do và bật popup thông báo CSS tùy chỉnh đẹp mắt.
   */
  async submitRefund(): Promise<void> {
    if (!this.selectedGame) return;
    if (this.isSubmittingRefund) return;

    const gameId = this.selectedGame.id;

    let finalReason = '';
    if (this.selectedRefundReason === 'custom') {
      if (!this.customRefundReason.trim()) {
        this.toast.warning('Vui lòng nhập lý do cụ thể bạn muốn hoàn tiền!');
        return;
      }
      finalReason = this.customRefundReason.trim();
    } else {
      const idx = parseInt(this.selectedRefundReason, 10) - 1;
      finalReason = this.presetRefundReasons[idx] || 'Hoàn tiền theo yêu cầu';
    }

    this.isSubmittingRefund = true;

    try {
      const result = await this.cartWishlistService.requestRefund(
        gameId,
        finalReason
      );

      // Tự động đóng popup chọn lý do
      this.showRefundModal = false;

      // NẾU DATABASE BÁO LỖI (VÍ DỤ: QUÁ 14 NGÀY KỂ TỪ NGÀY MUA)
      if (!result.ok) {
        this.refundResultType = 'warning';
        this.refundResultTitle = 'KHÔNG THỂ HOÀN TIỀN';
        this.refundResultMessage = result.message;
        this.showRefundResultModal = true;
        this.toast.warning(result.message);
        return;
      }

      // THÀNH CÔNG: HIỂN THỊ POPUP CHÚC MỪNG
      this.refundResultType = 'success';
      this.refundResultTitle = 'GỬI YÊU CẦU THÀNH CÔNG';
      this.refundResultMessage = `Yêu cầu hoàn tiền cho tựa game "${this.selectedGame.title}" đã được ghi nhận. Vui lòng chờ Ban Quản Trị STEAL phê duyệt.`;
      this.showRefundResultModal = true;
      this.toast.success('Đã gửi yêu cầu hoàn tiền thành công!');

    } catch (error: any) {
      this.showRefundModal = false;
      const errorMsg =
        error?.error?.message ||
        error?.message ||
        'Không thể kết nối máy chủ để hoàn tiền. Vui lòng thử lại.';

      this.refundResultType = 'error';
      this.refundResultTitle = 'LỖI HỆ THỐNG';
      this.refundResultMessage = errorMsg;
      this.showRefundResultModal = true;
      this.toast.warning(errorMsg);

    } finally {
      this.isSubmittingRefund = false;
      this.customRefundReason = '';
    }
  }

  refreshRecommendations(): void {
    this.recommendedGames = this.catalogService
      .getRecommended(30)
      .filter(g => !this.cartWishlistService.isOwned(g.id))
      .slice(0, 10);
  }

  isGameOwned(gameId: string): boolean {
    return this.cartWishlistService.isOwned(gameId);
  }

  goToGameDetail(game: Game): void {
    this.router.navigate(['/game', game.id]);
  }

  launchGame(): void {
    if (!this.selectedGame) return;
    this.isLaunching = true;
    this.launchProgress = 0;
    const durationMs = 3000;
    const stepMs = 50;
    const increment = 100 / (durationMs / stepMs);

    this.launchTimer = setInterval(() => {
      this.launchProgress += increment;
      if (this.launchProgress >= 100) {
        this.launchProgress = 100;
        this.clearLaunchTimer();
        this.isLaunching = false;
        this.isPlaying = true;
        this.showGameWindow = true;
        this.startPlayTimer();
        this.toast.success(`🚀 ${this.selectedGame?.title} đã sẵn sàng!`);
      }
    }, stepMs);
  }

  stopGame(): void {
    this.saveSession();
    this.clearLaunchTimer();
    this.clearPlayTimer();
    this.isLaunching = false;
    this.isPlaying = false;
    this.showGameWindow = false;
    this.toast.warning(`Đã dừng ${this.selectedGame?.title || 'trò chơi'}.`);
  }

  closeGameWindow(): void {
    this.showGameWindow = false;
  }

  private startPlayTimer(): void {
    this.playSeconds = 0;
    this.playTimer = setInterval(() => {
      this.playSeconds++;
    }, 1000);
  }

  private clearLaunchTimer(): void {
    if (this.launchTimer) {
      clearInterval(this.launchTimer);
      this.launchTimer = null;
    }
  }

  private clearPlayTimer(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  get formattedPlayTime(): string {
    const mins = Math.floor(this.playSeconds / 60);
    const secs = this.playSeconds % 60;
    return `${mins > 0 ? mins + ' phút ' : ''}${secs} giây`;
  }
}