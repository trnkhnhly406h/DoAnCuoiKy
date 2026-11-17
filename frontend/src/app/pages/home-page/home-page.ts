import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Game, Genre } from '../../models/game.model';
import { CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService } from '../../services/game-catalog';

interface PromoBanner {
  image: string;
  alt: string;
  route: string;
}

/** Slide game nổi bật (dữ liệu cố định: anhBia, video trailer khi rê chuột, 2 ảnh mô tả). */
interface HeroSlide {
  code: string;
  title: string;
  cover: string;
  shots: string[];
  video: string;
  releaseDate: string;
  description: string;
  originalPrice: number;
  discountPercent: number;
  finalPrice: number;
  isFree: boolean;
}

const CLOUD = 'https://res.cloudinary.com/elcegnjl';
const img = (v: string, file: string) => `${CLOUD}/image/upload/${v}/${file}`;
const vid = (v: string, file: string) => `${CLOUD}/video/upload/${v}/${file}`;

const HERO_SLIDES: HeroSlide[] = [
  { code: 'OPW03', title: 'Palworld', cover: img('v1791474231', 'OPW03.jpg'), shots: [img('v1791505546', 'MTOPW03.jpg'), img('v1791506872', 'OPW03MT.jpg')], video: vid('v1791534031', 'VDOPW03.mp4'),
    releaseDate: '2026-01-05', description: 'Hiện tượng game sinh tồn thế giới mở thu phục linh thú Pal trang bị vũ khí chiến đấu.', originalPrice: 0, discountPercent: 0, finalPrice: 0, isFree: true },
  { code: 'OPW04', title: 'Aniimo', cover: img('v1791474217', 'OPW04.jpg'), shots: [img('v1791505544', 'MTOPW04.jpg'), img('v1791506873', 'OPW04MT.jpg')], video: vid('v1791534059', 'VDOPW04.mp4'),
    releaseDate: '2026-10-16', description: 'Hành trình khám phá lục địa Teyvat kỳ diệu cùng sức mạnh phép thuật của 7 nguyên tố.', originalPrice: 200000, discountPercent: 20, finalPrice: 160000, isFree: false },
  { code: 'ACT01', title: 'Black Myth: Wukong', cover: img('v1791470835', 'ACT01.jpg'), shots: [img('v1791505547', 'MTACT01.jpg'), img('v1791506895', 'ACT01MT.jpg')], video: vid('v1792072358', 'VDACT01.mp4'),
    releaseDate: '2026-08-11', description: 'Trò chơi hành động nhập vai lấy cảm hứng từ Tây Du Ký.', originalPrice: 1100000, discountPercent: 20, finalPrice: 880000, isFree: false },
  { code: 'ACT04', title: 'Grand Theft Auto V', cover: img('v1791470836', 'ACT04.jpg'), shots: [img('v1791505541', 'MTACT04.jpg'), img('v1791506851', 'ACT04MT.jpg')], video: vid('v1791512688', 'VDACT04.mp4'),
    releaseDate: '2026-09-19', description: 'Game hành động thế giới mở phiêu lưu tại thành phố Los Santos.', originalPrice: 1200000, discountPercent: 20, finalPrice: 960000, isFree: false },
  { code: 'HOR03', title: 'Phasmophobia', cover: img('v1791474246', 'HOR03.jpg'), shots: [img('v1791505542', 'MTHOR03.jpg'), img('v1791506863', 'HOR03MT.jpg')], video: vid('v1791534442', 'VDHOR03.mp4'),
    releaseDate: '2026-02-14', description: 'Trò chơi săn ma co-op 4 người nghẹt thở, sử dụng các thiết bị tâm linh để phát hiện thực thể ma quái.', originalPrice: 1100000, discountPercent: 25, finalPrice: 825000, isFree: false },
  { code: 'HOR04', title: 'Lethal Company', cover: img('v1791474239', 'HOR04.jpg'), shots: [img('v1791505543', 'MTHOR04.jpg'), img('v1791506864', 'HOR04MT.jpg')], video: vid('v1791512515', 'VDHOR04.mp4'),
    releaseDate: '2026-08-18', description: 'Trò chơi kinh dị sinh tồn co-op thu gom phế liệu trên các hành tinh hoang phế đầy quái vật.', originalPrice: 1400000, discountPercent: 20, finalPrice: 1120000, isFree: false },
  { code: 'STR05', title: 'Stellaris', cover: img('v1791470841', 'STR05.jpg'), shots: [img('v1791505546', 'MTSTR05.jpg'), img('v1791506894', 'STR05MT.jpg')], video: vid('v1791647936', 'VDSTR05.mp4'),
    releaseDate: '2026-01-11', description: 'Game chiến thuật không gian quy mô lớn khám phá thiên hà.', originalPrice: 650000, discountPercent: 25, finalPrice: 487500, isFree: false },
  { code: 'IND01', title: 'Hollow Knight', cover: img('v1791470836', 'IND01.jpg'), shots: [img('v1791505543', 'MTIND01.jpg'), img('v1791506866', 'IND01MT.jpg')], video: vid('v1791648049', 'VDIND01.mp4'),
    releaseDate: '2026-05-02', description: 'Trò chơi hành động phiêu lưu 2D Metroidvania kinh điển.', originalPrice: 950000, discountPercent: 25, finalPrice: 712500, isFree: false }
];

interface HomeTab {
  label: string;
  route: string;
}

const CATEGORY_PAGE_SIZE = 5;
const PROMO_INTERVAL_MS = 5000;
const HERO_INTERVAL_MS = 6000;

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.css'],
  standalone: false
})
export class HomePageComponent implements OnInit, OnDestroy {
  /** 5 banner PNG (Cloudinary), tự động chạy. */
  readonly promoBanners: PromoBanner[] = [
    { image: 'https://res.cloudinary.com/elcegnjl/image/upload/v1793556160/banner1.png', alt: 'Ưu đãi nổi bật', route: '/uu-dai' },
    { image: 'https://res.cloudinary.com/elcegnjl/image/upload/v1793556163/banner2.png', alt: 'Game miễn phí', route: '/mien-phi' },
    { image: 'https://res.cloudinary.com/elcegnjl/image/upload/v1793556160/banner3.png', alt: 'Game bán chạy nhất', route: '/ban-chay-nhat' },
    { image: 'https://res.cloudinary.com/elcegnjl/image/upload/v1793556159/banner4.png', alt: 'Game mới ra mắt', route: '/moi-ra-mat' },
    { image: 'https://res.cloudinary.com/elcegnjl/image/upload/v1793556160/banner5.png', alt: 'Game nổi bật', route: '/game-noi-bat' }
  ];
  currentPromoIndex = 0;

  readonly tabs: HomeTab[] = [
    { label: 'MỚI RA MẮT', route: '/moi-ra-mat' },
    { label: 'BÁN CHẠY NHẤT', route: '/ban-chay-nhat' },
    { label: 'ƯU ĐÃI', route: '/uu-dai' },
    { label: 'MIỄN PHÍ', route: '/mien-phi' }
  ];
  activeTab: HomeTab = this.tabs[0];

  readonly heroSlides: HeroSlide[] = HERO_SLIDES;
  currentHeroIndex = 0;
  /** Đang rê chuột vào ảnh bìa: phát trailer và tạm dừng tự chuyển slide. */
  heroHover = false;

  featuredGames: Game[] = [];
  horrorGames: Game[] = [];
  strategyGames: Game[] = [];
  currentTabGames: Game[] = [];

  categories: Genre[] = [];
  categoryStart = 0;

  private promoTimer: ReturnType<typeof setInterval> | null = null;
  private heroTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    public catalog: GameCatalogService,
    public cartWishlistService: CartWishlistService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.featuredGames = this.catalog.getHomeFeatured();
    this.horrorGames = this.catalog.getByGenre('kinh-di').slice(0, 3);
    this.strategyGames = this.catalog.getByGenre('chien-thuat').slice(0, 3);
    this.categories = this.catalog.genres;
    this.selectTab(this.tabs[0]);
    this.startPromoTimer();
    this.startHeroTimer();
  }

  ngOnDestroy(): void {
    if (this.promoTimer) clearInterval(this.promoTimer);
    if (this.heroTimer) clearInterval(this.heroTimer);
  }

  private startPromoTimer(): void {
    if (this.promoTimer) clearInterval(this.promoTimer);
    this.promoTimer = setInterval(() => {
      this.nextPromo();
      this.cdr.markForCheck();
    }, PROMO_INTERVAL_MS);
  }

  private startHeroTimer(): void {
    if (this.heroTimer) clearInterval(this.heroTimer);
    this.heroTimer = setInterval(() => {
      if (this.heroHover) return;
      this.nextHero();
      this.cdr.markForCheck();
    }, HERO_INTERVAL_MS);
  }

  nextPromo(): void {
    this.currentPromoIndex = (this.currentPromoIndex + 1) % this.promoBanners.length;
  }

  selectPromo(index: number): void {
    this.currentPromoIndex = index;
    this.startPromoTimer();
  }

  get currentHero(): HeroSlide | null {
    return this.heroSlides[this.currentHeroIndex] ?? null;
  }

  nextHero(): void {
    this.currentHeroIndex = (this.currentHeroIndex + 1) % this.heroSlides.length;
  }

  prevHero(): void {
    this.currentHeroIndex = (this.currentHeroIndex - 1 + this.heroSlides.length) % this.heroSlides.length;
  }

  /** Bấm mũi tên: chuyển slide rồi tính lại thời gian tự chuyển. */
  stepHero(direction: 1 | -1): void {
    if (direction === 1) this.nextHero();
    else this.prevHero();
    this.startHeroTimer();
  }

  setHeroHover(value: boolean): void {
    this.heroHover = value;
  }

  /** Mở trang chi tiết nếu game có trong cửa hàng, nếu chưa có thì chuyển sang trang tìm kiếm theo tên. */
  openHero(slide: HeroSlide): void {
    const slug = slide.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const game = this.catalog.resolve(slug);
    if (game) this.router.navigate(['/game', game.id]);
    else this.router.navigate(['/tim-kiem'], { queryParams: { q: slide.title } });
  }

  selectTab(tab: HomeTab): void {
    this.activeTab = tab;
    switch (tab.label) {
      case 'BÁN CHẠY NHẤT':
        this.currentTabGames = this.catalog.getBestSellers().slice(0, 6);
        break;
      case 'ƯU ĐÃI':
        this.currentTabGames = this.catalog.getOnSale(6);
        break;
      case 'MIỄN PHÍ':
        this.currentTabGames = this.catalog.getFree(6);
        break;
      default:
        this.currentTabGames = this.catalog.getNewReleases(6);
    }
  }

  get visibleCategories(): Genre[] {
    const total = this.categories.length;
    return Array.from({ length: Math.min(CATEGORY_PAGE_SIZE, total) }, (_, i) => this.categories[(this.categoryStart + i) % total]);
  }

  nextCategories(): void {
    if (this.categories.length > 0) {
      this.categoryStart = (this.categoryStart + 1) % this.categories.length;
    }
  }

  prevCategories(): void {
    if (this.categories.length > 0) {
      this.categoryStart = (this.categoryStart - 1 + this.categories.length) % this.categories.length;
    }
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

  goToDetail(gameOrId: Game | string, event?: Event): void {
    if (event) event.stopPropagation();
    const id = typeof gameOrId === 'string' ? gameOrId : gameOrId.id;
    this.router.navigate(['/game', id]);
  }

  trackByGame(_: number, game: Game): string {
    return game.id;
  }
}