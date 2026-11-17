import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Game } from '../../models/game.model';
import { CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService } from '../../services/game-catalog';

type StoreListType = 'featured' | 'best-seller' | 'new' | 'sale' | 'free';

interface SidebarLink {
  label: string;
  route: string;
}

@Component({
  selector: 'app-store-list',
  templateUrl: './store-list.html',
  styleUrls: ['./store-list.css'],
  standalone: false
})
export class StoreListComponent implements OnInit, OnDestroy {
  readonly sidebarLinks: SidebarLink[] = [
    { label: 'Game nổi bật', route: '/game-noi-bat' },
    { label: 'Game bán chạy', route: '/ban-chay-nhat' },
    { label: 'Game mới ra mắt', route: '/moi-ra-mat' },
    { label: 'Ưu đãi', route: '/uu-dai' },
    { label: 'Miễn phí', route: '/mien-phi' }
  ];

  type: StoreListType = 'featured';
  title = '';
  description = '';
  showRank = false;
  emptyMessage = 'Hiện chưa có game phù hợp.';

  private loadedGames: Game[] = [];
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    public catalog: GameCatalogService,
    public cartWishlistService: CartWishlistService
  ) {}

  ngOnInit(): void {
    this.sub = this.route.data.subscribe(data => this.load((data['type'] as StoreListType) ?? 'featured'));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get games(): Game[] {
    return this.loadedGames;
  }

  private load(type: StoreListType): void {
    this.type = type;
    this.showRank = type === 'featured' || type === 'best-seller';
    this.emptyMessage = 'Hiện chưa có game phù hợp.';

    switch (type) {
      case 'featured':
        this.setPage('GAME NỔI BẬT', 'Top 10 trò chơi nổi bật được nhiều người chơi nhất lúc này', this.catalog.getFeatured());
        break;
      case 'best-seller':
        this.setPage('GAME BÁN CHẠY NHẤT', 'Top 10 trò chơi bán chạy nhất trên STEAL Store', this.catalog.getBestSellers());
        break;
      case 'new':
        this.setPage('GAME MỚI RA MẮT', 'Các trò chơi vừa ra mắt gần đây nhất, sắp xếp theo ngày phát hành', this.catalog.getNewReleases());
        break;
      case 'sale':
        this.setPage('ƯU ĐÃI', 'Các trò chơi đang giảm giá, sắp xếp theo mức giảm cao nhất', this.catalog.getOnSale());
        break;
      case 'free':
        this.setPage('GAME MIỄN PHÍ', 'Các trò chơi bạn có thể chơi hoàn toàn miễn phí', this.catalog.getFree());
        break;
    }
  }

  private setPage(title: string, description: string, games: Game[]): void {
    this.title = title;
    this.description = description;
    this.loadedGames = games;
  }

  onAddWishlist(event: Event, game: Game): void {
    event.stopPropagation();
    if (this.cartWishlistService.isInWishlist(game.id)) this.cartWishlistService.removeFromWishlist(game.id);
    else this.cartWishlistService.addToWishlist(game);
  }

  onAddCart(event: Event, game: Game): void {
    event.stopPropagation();
    this.cartWishlistService.addToCart(game);
  }

  goToDetail(game: Game, event?: Event): void {
    if (event) event.stopPropagation();
    this.router.navigate(['/game', game.id]);
  }

  trackByGame(_: number, game: Game): string {
    return game.id;
  }
}