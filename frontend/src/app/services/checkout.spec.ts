import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth';
import { CartWishlistService } from './cart-wishlist';
import { CheckoutService } from './checkout';
import { CouponService } from './coupon';
import { GameCatalogService } from './game-catalog';

describe('CheckoutService + CouponService', () => {
  let checkout: CheckoutService;
  let cart: CartWishlistService;
  let auth: AuthService;
  let catalog: GameCatalogService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    auth = TestBed.inject(AuthService);
    cart = TestBed.inject(CartWishlistService);
    checkout = TestBed.inject(CheckoutService);
    catalog = TestBed.inject(GameCatalogService);
    auth.login('khach_vip01', 'password123');
    cart.reset();
  });

  it('blocks checkout for guests and for an empty cart', () => {
    expect(checkout.canCheckout().ok).toBeFalse();
    const game = catalog.getById('gta-v');
    if (game) cart.addToCart(game);
    expect(checkout.canCheckout().ok).toBeTrue();
    auth.logout();
    expect(checkout.canCheckout().ok).toBeFalse();
  });

  it('applies a valid coupon and drops invalid ones', () => {
    const game = catalog.getById('gta-v');
    if (game) cart.addToCart(game);
    expect(checkout.applyCoupon('STEAL20').ok).toBeTrue();
    expect(checkout.summary.discount).toBe(45000);
    expect(checkout.summary.total).toBe(180000);
    expect(checkout.applyCoupon('SAIMA').ok).toBeFalse();
    expect(checkout.summary.discount).toBe(0);
  });

  it('rejects expired, not-yet-started and first-purchase-only coupons', () => {
    const coupons = TestBed.inject(CouponService);
    expect(coupons.check('FLASH40', 100000, false).ok).toBeFalse();
    expect(coupons.check('GAME15', 100000, false, new Date('2026-10-29')).message).toContain('chưa có hiệu lực');
    expect(coupons.check('GAME15', 100000, false, new Date('2026-11-05')).ok).toBeTrue();
    expect(coupons.check('GAME15', 100000, true, new Date('2026-11-05')).ok).toBeFalse();
  });

  it('requires a gift recipient before payment when the cart has gifts', () => {
    const game = catalog.getById('gta-v');
    if (game) cart.addToCart(game);
    cart.setCartItemGift('gta-v', true);
    expect(checkout.guard('payment')).toBe('/tang-qua');
    checkout.update({ giftRecipient: { label: 'ban' } });
    expect(checkout.guard('payment')).toBeNull();
    expect(checkout.guard('qr')).toBe('/phuong-thuc-thanh-toan');
  });

  it('places the order with the generated order code and clears the draft', () => {
    const game = catalog.getById('gta-v');
    if (game) cart.addToCart(game);
    const code = checkout.ensureOrderCode();
    const order = checkout.placeOrder();
    expect(order?.id).toBe(code);
    expect(cart.isOwned('gta-v')).toBeTrue();
    expect(checkout.draft.orderCode).toBe('');
  });
});
