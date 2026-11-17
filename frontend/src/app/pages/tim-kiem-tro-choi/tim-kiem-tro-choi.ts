import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService, GameView } from '../../services/game-catalog';
import { normalizeText } from '../../services/storage';
import { emptyStorage, MAX_PRICE_FILTER, matchesFilters, SidebarFilters, STORAGE_OPTIONS } from '../../shared/game-filters';

const PAGE_SIZE = 9;

/** Trang "Tất cả game" + tìm kiếm (thiết kế của Duyên), dùng chung catalog với toàn cửa hàng. */
@Component({
  selector: 'app-tim-kiem-tro-choi',
  templateUrl: './tim-kiem-tro-choi.html',
  styleUrls: ['./tim-kiem-tro-choi.css'],
  standalone: false
})
export class TimKiemTroChoiComponent implements OnInit, OnDestroy {
  readonly giaToiDa = MAX_PRICE_FILTER;
  readonly danhSachDungLuong = STORAGE_OPTIONS;
  readonly danhSachTheLoai: { name: string; slug: string }[];

  tuKhoa = '';
  mucGiaChon = MAX_PRICE_FILTER;
  locDangGiamGia = false;
  locAnMienPhi = false;
  dungLuongChon: Record<string, boolean> = emptyStorage();
  theLoaiChon: Record<string, boolean> = {};

  danhSachGameHienThi: GameView[] = [];
  private limit = PAGE_SIZE;
  private all: GameView[] = [];
  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private catalog: GameCatalogService, public cart: CartWishlistService) {
    this.danhSachTheLoai = catalog.genres.map(g => ({ name: g.label, slug: g.slug }));
    this.danhSachTheLoai.forEach(g => (this.theLoaiChon[g.slug] = false));
  }

  themVaoGio(view: GameView, event: Event): void {
    event.stopPropagation();
    const game = this.catalog.getById(view.id);
    if (game) this.cart.addToCart(game);
  }

  doiDanhSachUoc(view: GameView, event: Event): void {
    event.stopPropagation();
    const game = this.catalog.getById(view.id);
    if (!game) return;
    if (this.cart.isInWishlist(game.id)) this.cart.removeFromWishlist(game.id);
    else this.cart.addToWishlist(game);
  }

  ngOnInit(): void {
    this.all = this.catalog.getAllGames().map(g => this.catalog.toView(g));
    // Từ khóa lấy từ ô tìm kiếm trên header (?q=...)
    this.sub = this.route.queryParamMap.subscribe(params => {
      this.tuKhoa = params.get('q') ?? '';
      this.onFilterChange();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get danhSachGamePhanTrang(): GameView[] {
    return this.danhSachGameHienThi.slice(0, this.limit);
  }

  get conGameDeHienThi(): boolean {
    return this.danhSachGameHienThi.length > this.limit;
  }

  hienThemGame(): void {
    this.limit += PAGE_SIZE;
  }

  onFilterChange(): void {
    this.limit = PAGE_SIZE;
    const q = normalizeText(this.tuKhoa);
    const filters: SidebarFilters = {
      maxPrice: this.mucGiaChon, onlyDiscounted: this.locDangGiamGia, hideFree: this.locAnMienPhi,
      storage: this.dungLuongChon,
      genres: this.danhSachTheLoai.filter(g => this.theLoaiChon[g.slug]).map(g => g.slug)
    };
    this.danhSachGameHienThi = this.all.filter(game =>
      matchesFilters(game, filters) &&
      (!q || normalizeText(game.name).includes(q) || game.tags.some(t => normalizeText(t.label).includes(q)))
    );
  }

  xoaTatCaBoLoc(): void {
    this.tuKhoa = '';
    this.mucGiaChon = MAX_PRICE_FILTER;
    this.locDangGiamGia = false;
    this.locAnMienPhi = false;
    this.dungLuongChon = emptyStorage();
    this.danhSachTheLoai.forEach(g => (this.theLoaiChon[g.slug] = false));
    this.onFilterChange();
  }

  dinhDangGia(value: number): string {
    return `${Math.round(value).toLocaleString('vi-VN')}đ`;
  }

  trackByGame(_: number, game: GameView): string {
    return game.id;
  }
}
