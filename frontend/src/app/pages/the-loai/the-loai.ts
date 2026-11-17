import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService, GameView } from '../../services/game-catalog';
import { normalizeText } from '../../services/storage';
import { ToastService } from '../../services/toast';
import { bannerArt } from '../../shared/cover-art';
import { emptyStorage, MAX_PRICE_FILTER, matchesFilters, SidebarFilters, STORAGE_OPTIONS } from '../../shared/game-filters';

const GENRE_DESCRIPTIONS: Record<string, string> = {
  'mo-phong': 'Xây dựng, quản lý và sống trong những thế giới mô phỏng sống động: từ lái xe tải xuyên châu Âu đến điều hành cả một thành phố.',
  'phieu-luu': 'Những hành trình khám phá, giải đố và kể chuyện, nơi mỗi bước chân đều mở ra một bí ẩn mới.',
  'the-thao': 'Từ sân cỏ đến đường đua, thể thao điện tử mang tới cảm giác thi đấu kịch tính ngay tại nhà.',
  'kinh-di': 'Bóng tối, tiếng động lạ và những cú giật mình. Dành cho những ai thích cảm giác tim đập nhanh.',
  'the-gioi-mo': 'Tự do khám phá những vùng đất rộng lớn không giới hạn, tự quyết định hành trình của riêng bạn.',
  'hanh-dong': 'Nhịp độ nhanh, chiến đấu mãn nhãn và phản xạ tức thì trong những cuộc đối đầu nghẹt thở.',
  'nhap-vai': 'Hóa thân thành nhân vật, đưa ra lựa chọn và viết nên câu chuyện của chính mình.',
  'esports': 'Đối kháng đỉnh cao với đồng đội và đối thủ trên khắp thế giới, nơi kỹ năng và chiến thuật lên tiếng.',
  'chien-thuat': 'Tính toán từng nước đi, xây dựng đế chế và vượt mặt đối thủ bằng trí tuệ.',
  'indie': 'Những tác phẩm độc lập đầy sáng tạo từ các nhà phát triển nhỏ với ý tưởng lớn.'
};

const FEATURED_PAGE_SIZE = 5;
const LIST_PAGE_SIZE = 6;

interface GameGroup {
  name: string;
  slug: string;
}

@Component({
  selector: 'app-the-loai',
  templateUrl: './the-loai.html',
  styleUrls: ['./the-loai.css'],
  standalone: false
})
export class TheLoaiComponent implements OnInit, OnDestroy {
  readonly listGenres: { name: string; slug: string }[];
  readonly listGameGroups: GameGroup[] = [
    { name: 'TẤT CẢ', slug: 'tat_ca' },
    { name: 'NỔI BẬT', slug: 'game_noi_bat' },
    { name: 'BÁN CHẠY NHẤT', slug: 'ban_chay_nhat' },
    { name: 'MỚI RA MẮT', slug: 'moi_ra_mat' },
    { name: 'ƯU ĐÃI', slug: 'uu_dai' },
    { name: 'MIỄN PHÍ', slug: 'mien_phi' }
  ];
  readonly danhSachDungLuong = STORAGE_OPTIONS;
  readonly maxPrice = MAX_PRICE_FILTER;

  genreSlug = '';
  genreName = '';
  genreDesc = '';
  bannerImageUrl = '';

  // Bộ lọc thanh bên
  mucGiaChon = MAX_PRICE_FILTER;
  locDangGiamGia = false;
  locAnMienPhi = false;
  dungLuongChon: Record<string, boolean> = emptyStorage();
  private selectedGenres: string[] = [];

  // Bộ lọc phía trên danh sách lớn
  activeSubFilter = 'tat_ca';
  searchQuery = '';

  featuredCollapsed = false;
  private featuredLimit = FEATURED_PAGE_SIZE;
  private listLimit = LIST_PAGE_SIZE;

  filteredGenreGames: GameView[] = [];
  filteredGames: GameView[] = [];

  private all: { view: GameView; groups: string[] }[] = [];
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private catalog: GameCatalogService,
    private cart: CartWishlistService,
    private toast: ToastService
  ) {
    this.listGenres = catalog.genres.map(g => ({ name: g.label, slug: g.slug }));
  }

  ngOnInit(): void {
    this.all = this.catalog.getAllGames().map(g => ({ view: this.catalog.toView(g), groups: this.catalog.groupsOf(g) }));
    this.sub = this.route.paramMap.subscribe(params => this.loadGenre(params.get('slug') ?? ''));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private loadGenre(slug: string): void {
    const genre = this.catalog.getGenre(slug);
    if (!genre) {
      this.toast.warning('Thể loại này không tồn tại. Hãy chọn thể loại khác.');
      this.router.navigate(['/the-loai', this.listGenres[0].slug], { replaceUrl: true });
      return;
    }
    this.genreSlug = genre.slug;
    this.genreName = genre.label.toUpperCase();
    this.genreDesc = GENRE_DESCRIPTIONS[genre.slug] ?? '';
    this.bannerImageUrl = bannerArt(genre.label.toUpperCase());
    this.selectedGenres = [genre.slug];
    
    this.resetFilters();
    this.randomBanner();
  }

randomBanner(): void {
  // Chỉ lấy ảnh game thuộc thể loại đang chọn
  const images = [
    ...new Set(
      this.filteredGenreGames
        .map(game => game.imageUrl)
        .filter((url): url is string => !!url)
    )
  ];

  if (images.length === 0) {
    this.bannerImageUrl = bannerArt(this.genreName);
    return;
  }

  // Hạn chế lặp lại ảnh vừa hiển thị
  const candidates = images.length > 1
    ? images.filter(url => url !== this.bannerImageUrl)
    : images;

  const randomIndex = Math.floor(
    Math.random() * candidates.length
  );

  this.bannerImageUrl = candidates[randomIndex];
}


  /* ---------- Thể loại ---------- */

  isGenreHighlighted(slug: string): boolean {
    return slug === this.genreSlug;
  }

  isGenreSelected(slug: string): boolean {
    return this.selectedGenres.includes(slug);
  }

  onGenreCheckboxChange(slug: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedGenres = checked ? [...new Set([...this.selectedGenres, slug])] : this.selectedGenres.filter(s => s !== slug);
    this.onSidebarFilterChange();
  }

  /* ---------- Lọc ---------- */

  private get sidebarFilters(): SidebarFilters {
    return {
      maxPrice: this.mucGiaChon, onlyDiscounted: this.locDangGiamGia, hideFree: this.locAnMienPhi,
      storage: this.dungLuongChon, genres: this.selectedGenres
    };
  }

  onSidebarFilterChange(): void {
    this.featuredLimit = FEATURED_PAGE_SIZE;
    this.listLimit = LIST_PAGE_SIZE;
    this.recompute();
  }

  onSearchChange(): void {
    this.listLimit = LIST_PAGE_SIZE;
    this.recompute();
  }

  setSubFilter(slug: string): void {
    this.activeSubFilter = slug;
    this.listLimit = LIST_PAGE_SIZE;
    this.recompute();
  }

  resetSidebarFilters(): void {
    this.mucGiaChon = MAX_PRICE_FILTER;
    this.locDangGiamGia = false;
    this.locAnMienPhi = false;
    this.dungLuongChon = emptyStorage();
    this.selectedGenres = this.genreSlug ? [this.genreSlug] : [];
    this.onSidebarFilterChange();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.activeSubFilter = 'tat_ca';
    this.resetSidebarFilters();
  }

  private recompute(): void {
    const filters = this.sidebarFilters;
    const base = this.all.filter(x => matchesFilters(x.view, filters));
    this.filteredGenreGames = base.map(x => x.view);

    const q = normalizeText(this.searchQuery);
    this.filteredGames = base
      .filter(x => this.activeSubFilter === 'tat_ca' || x.groups.includes(this.activeSubFilter))
      .filter(x => !q || normalizeText(x.view.name).includes(q) || x.view.tags.some(t => normalizeText(t.label).includes(q)))
      .map(x => x.view);
  }

  /* ---------- Phân trang ---------- */

  toggleFeaturedGames(): void {
    this.featuredCollapsed = !this.featuredCollapsed;
  }

  get displayedFeaturedGames(): GameView[] {
    return this.filteredGenreGames.slice(0, this.featuredLimit);
  }

  get hasMoreFeaturedGames(): boolean {
    return this.filteredGenreGames.length > this.featuredLimit;
  }

  loadMoreFeaturedGames(): void {
    this.featuredLimit += FEATURED_PAGE_SIZE;
  }

  get displayedFilterGames(): GameView[] {
    return this.filteredGames.slice(0, this.listLimit);
  }

  get hasMoreGames(): boolean {
    return this.filteredGames.length > this.listLimit;
  }

  loadMoreGames(): void {
    this.listLimit += LIST_PAGE_SIZE;
  }

  /* ---------- Giỏ hàng / danh sách ước ---------- */

  addToCart(view: GameView, event: Event): void {
    event.stopPropagation();
    const game = this.catalog.getById(view.id);
    if (game) this.cart.addToCart(game);
  }

  isInWishlist(view: GameView): boolean {
    return this.cart.isInWishlist(view.id);
  }

  toggleWishlist(view: GameView, event: Event): void {
    event.stopPropagation();
    const game = this.catalog.getById(view.id);
    if (!game) return;
    if (this.cart.isInWishlist(game.id)) this.cart.removeFromWishlist(game.id);
    else this.cart.addToWishlist(game);
  }

  trackById(_: number, game: GameView): string {
    return game.id;
  }
}
