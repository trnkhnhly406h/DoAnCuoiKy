import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { CartWishlistService } from './cart-wishlist';
import { GameCatalogService } from './game-catalog';
import { LibraryStatsService } from './library-stats';

describe('CartWishlistService', () => {
  let cart: CartWishlistService;
  let catalog: GameCatalogService;
  let auth: AuthService;

  const game = (id: string) => {
    const g = catalog.getById(id);
    if (!g) throw new Error('missing ' + id);
    return g;
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    auth = TestBed.inject(AuthService);
    catalog = TestBed.inject(GameCatalogService);
    cart = TestBed.inject(CartWishlistService);
    auth.login('khach_vip01', 'password123');
    cart.reset();
  });

  it('requires login to add to the cart or wishlist', () => {
    auth.logout();
    expect(cart.addToCart(game('elden-ring'))).toBeFalse();
    expect(cart.addToWishlist(game('elden-ring'))).toBeFalse();
    expect(cart.cartItems.length).toBe(0);
  });

  it('does not add the same game twice and computes the total from catalog prices', () => {
    cart.addToCart(game('gta-v'));
    cart.addToCart(game('gta-v'));
    cart.addToCart(game('witcher-3'));
    expect(cart.cartItems.length).toBe(2);
    expect(cart.cartTotalPrice).toBe(225000 + 97500);
  });

  it('adds free games straight into the library', () => {
    cart.addToCart(game('counter-strike-2'));
    expect(cart.isOwned('counter-strike-2')).toBeTrue();
    expect(cart.cartItems.length).toBe(0);
    cart.addToCart(game('counter-strike-2'));
    cart.addToWishlist(game('counter-strike-2'));
    expect(cart.wishlistItems.length).toBe(0);
  });

  it('completeOrder moves own games to the library, gifts are not kept, and discounts are shared', () => {
    cart.addToCart(game('gta-v'));
    cart.addToCart(game('witcher-3'));
    cart.addToWishlist(game('elden-ring'));
    cart.setCartItemGift('witcher-3', true);
    const order = cart.completeOrder({ method: 'Momo', couponCode: 'STEAL20', discount: 64500, gift: { label: 'ban', message: '', senderName: 'x' } });
    expect(order?.total).toBe(322500 - 64500);
    expect(cart.isOwned('gta-v')).toBeTrue();
    expect(cart.isOwned('witcher-3')).toBeFalse();
    expect(cart.cartItems.length).toBe(0);
    expect(cart.orders.length).toBe(1);
    expect(cart.getLibraryEntry('gta-v')?.paidPrice).toBe(Math.round(225000 * (258000 / 322500)));
  });

  it('delivers gifts into the recipient account library', () => {
    auth.logout();
    auth.login('khach_vip02', 'password123');
    cart.reset();
    cart.addToCart(game('god-of-war'));
    cart.setCartItemGift('god-of-war', true);
    const recipient = auth.lookupAccount('khach_vip05');
    cart.completeOrder({ method: 'Momo', couponCode: '', discount: 0, gift: { label: 'khach_vip05', accountScope: recipient?.scope, message: 'Chúc mừng', senderName: 'khach_vip02' } });
    auth.logout();
    auth.login('khach_vip05', 'password123');
    expect(cart.isOwned('god-of-war')).toBeTrue();
    expect(cart.getLibraryEntry('god-of-war')?.giftFrom).toBe('khach_vip02');
  });

  it('checks refund eligibility by play time, age of purchase and price', () => {
    auth.logout();
    auth.login('5 con nhái', 'Steal@123');
    expect(cart.refundCheck('outlast').ok).toBeTrue(); // 0,8 giờ, mua 3 ngày trước
    expect(cart.refundCheck('phasmophobia').ok).toBeFalse(); // 12,5 giờ
    expect(cart.refundCheck('dead-by-daylight').ok).toBeFalse(); // 5,2 giờ
    expect(cart.refund('outlast', 'Không hợp').ok).toBeTrue();
    expect(cart.isOwned('outlast')).toBeFalse();
    expect(TestBed.inject(LibraryStatsService).hoursPlayed('outlast')).toBe(0);
  });
});
