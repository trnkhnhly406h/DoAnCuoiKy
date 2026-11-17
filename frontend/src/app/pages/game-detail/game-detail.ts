import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Game } from '../../models/game.model';
import { CartWishlistService } from '../../services/cart-wishlist';
import { CheckoutService } from '../../services/checkout';
import { GameCatalogService, TagLink } from '../../services/game-catalog';
import { PreferencesService } from '../../services/preferences';

export interface MediaItem {
  id: number;
  type: 'video' | 'image';
  url: string;
  thumbUrl: string;
}

/** Số lần lặp lại cặp ảnh mô tả (anhMota1, anhMota2) trong dải thumbnail. */
const SCREENSHOT_REPEAT = 4;
const RECOMMEND_COUNT = 20;

/**
 * Trang chi tiết game. Dữ liệu lấy từ GameCatalogService (cùng nguồn với giỏ hàng / thư viện),
 * nên mọi game đều có id thống nhất và thêm vào giỏ được.
 */
@Component({
  selector: 'app-game-detail',
  templateUrl: './game-detail.html',
  styleUrls: ['./game-detail.css'],
  standalone: false
})
export class GameDetailComponent implements OnInit, OnDestroy {
  game: Game | null = null;
  tags: TagLink[] = [];
  mediaList: MediaItem[] = [];
  activeMedia: MediaItem | null = null;
  recommendedGames: Game[] = [];
  hiddenByFilter = false;

  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private titleService: Title,
    private checkout: CheckoutService,
    private preferences: PreferencesService,
    public cartWishlistService: CartWishlistService,
    public catalogService: GameCatalogService
  ) {}

  onRecCart(event: Event, game: Game): void {
    event.stopPropagation();
    this.cartWishlistService.addToCart(game);
  }

  onRecWish(event: Event, game: Game): void {
    event.stopPropagation();
    if (this.cartWishlistService.isInWishlist(game.id)) this.cartWishlistService.removeFromWishlist(game.id);
    else this.cartWishlistService.addToWishlist(game);
  }

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(params => this.load(params.get('slug') ?? ''));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private load(slug: string): void {
  this.game = this.catalogService.resolve(slug) ?? null;

  console.log('GAME DETAIL:', this.game);

  if (!this.game) {
    this.titleService.setTitle('Không tìm thấy game - STEAL');
    this.mediaList = [];
    this.activeMedia = null;
    this.recommendedGames = this.catalogService.getRecommended(RECOMMEND_COUNT);
    return;
  }

  console.log('DETAIL GAME TITLE:', this.game.title);
  console.log('DETAIL GAME PRICE:', this.game.finalPrice);
  console.log('DETAIL GAME IMAGE:', this.game.coverImage);
  console.log('DETAIL GAME VIDEO:', this.game.video);

  this.titleService.setTitle(`${this.game.title} - STEAL`);
  this.tags = this.catalogService.tagLinks(this.game);
  this.hiddenByFilter = this.preferences.isHidden(this.game.contentFlags);
  this.initMediaList(this.game);
  this.refreshRecommendations();
}

  /** Dải media: 1 video (nếu có) + các ảnh mô tả lặp lại trong dải thumbnail. */
  private initMediaList(game: Game): void {
    const list: MediaItem[] = [];
    let id = 1;

    // 1. Video trailer ở vị trí đầu tiên
    if (game.video) {
      list.push({
        id: id++,
        type: 'video',
        url: game.video,
        thumbUrl: game.screenshots?.[0] || game.coverImage
      });
    }

    // 2. Các ảnh mô tả (anhMota)
    if (game.screenshots && game.screenshots.length > 0) {
      for (let i = 0; i < SCREENSHOT_REPEAT; i++) {
        game.screenshots.forEach(shot => {
          list.push({ id: id++, type: 'image', url: shot, thumbUrl: shot });
        });
      }
    }

    this.mediaList = list;
    this.activeMedia = list[0] || null;
  }

  selectMedia(item: MediaItem): void {
    this.activeMedia = item;
  }

  refreshRecommendations(): void {
    this.recommendedGames = this.catalogService.getRecommended(RECOMMEND_COUNT, this.game?.id);
  }

  isGameOwned(gameId: string): boolean {
    return this.cartWishlistService.isOwned(gameId);
  }

  goToGameDetail(game: Game): void {
    this.router.navigate(['/game', game.id]);
  }

  onAddToCart(): void {
    if (this.game) this.cartWishlistService.addToCart(this.game);
  }

  /** Bấm lần nữa để bỏ khỏi danh sách ước. */
  onAddToWishlist(): void {
    if (!this.game) return;
    if (this.cartWishlistService.isInWishlist(this.game.id)) this.cartWishlistService.removeFromWishlist(this.game.id);
    else this.cartWishlistService.addToWishlist(this.game);
  }

  /** Mua ngay: đã sở hữu → mở thư viện; miễn phí → nhận về thư viện; trả phí → vào quy trình thanh toán. */
  onBuyNow(): void {
    const game = this.game;
    if (!game) return;
    const cart = this.cartWishlistService;

    if (cart.isOwned(game.id)) {
      this.router.navigate(['/thu-vien', game.id]);
      return;
    }
    if (!cart.isInCart(game.id) && !cart.addToCart(game)) return; // chưa đăng nhập hoặc bị chặn
    if (game.isFree) {
      this.router.navigate(['/thu-vien', game.id]);
      return;
    }
    const next = this.checkout.start();
    if (next) this.router.navigate([next]);
  }
  
}
