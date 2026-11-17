import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '../../models/game.model';
import { CartItem, CartWishlistService } from '../../services/cart-wishlist';
import { CheckoutService } from '../../services/checkout';
import { GameCatalogService } from '../../services/game-catalog';

@Component({
  selector: 'app-gio-hang',
  templateUrl: './gio-hang.html',
  styleUrls: ['./gio-hang.css'],
  standalone: false
})
export class GioHangComponent implements OnInit {
  openMenuId: string | null = null;
  recommended: Game[] = [];

  constructor(
    public cart: CartWishlistService,
    private checkout: CheckoutService,
    private catalog: GameCatalogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshRecommended();
  }

  /** Gợi ý các game đang giảm giá mà bạn chưa có trong giỏ / thư viện. */
  private refreshRecommended(): void {
    this.recommended = this.catalog
      .getOnSale()
      .filter(g => !this.cart.isOwned(g.id) && !this.cart.isInCart(g.id))
      .slice(0, 3);
  }

  formatMoney(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }

  get checkoutLabel(): string {
    return this.cart.hasGiftItems ? 'Tiếp tục tới tuỳ chọn quà tặng' : 'Tiếp tục tới bước thanh toán';
  }

  toggleMenu(item: CartItem, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === item.id ? null : item.id;
  }

  closeMenus(): void {
    this.openMenuId = null;
  }

  chooseType(item: CartItem, forGift: boolean): void {
    this.cart.setCartItemGift(item.id, forGift);
    this.closeMenus();
  }

  remove(id: string): void {
    this.cart.removeFromCart(id);
    this.refreshRecommended();
  }

  addRecommended(game: Game): void {
    if (this.cart.addToCart(game)) this.refreshRecommended();
  }

  continueShopping(): void {
    this.router.navigate(['/']);
  }

  proceed(): void {
    const next = this.checkout.start();
    if (next) this.router.navigate([next]);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
