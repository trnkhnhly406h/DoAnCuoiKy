import { Injectable } from '@angular/core';
import { skip } from 'rxjs/operators';

import { AuthService } from './auth';
import {
  CartWishlistService,
  GiftTarget,
  OrderRecord
} from './cart-wishlist';
import { CouponCheck, CouponService } from './coupon';
import { ToastService } from './toast';
// Cho phép nhận linh hoạt các phương thức thanh toán do Admin cấu hình thêm
export type PaymentMethod = string;

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Momo',
  'VNPay',
  'PayPal'
];
  

export interface GiftRecipient {
  /** Tên hiển thị người nhận. */
  label: string;

  /** Scope tài khoản STEAL nhận quà. */
  accountScope?: string;
}

export interface CustomerInfo {
  ho: string;
  ten: string;
  soDienThoai: string;
}

export interface CheckoutDraft {
  couponCode: string;
  giftRecipient: GiftRecipient | null;
  giftMessage: string;
  senderName: string;
  method: PaymentMethod;
  customer: CustomerInfo | null;

  /** Mã đơn hàng hiển thị ở bước QR. */
  orderCode: string;
}

export interface CheckoutSummary {
  subtotal: number;
  discount: number;
  total: number;
  couponMessage: string;
  couponOk: boolean;
}

const SESSION_KEY = 'steal_checkout_draft';

function emptyDraft(): CheckoutDraft {
  return {
    couponCode: '',
    giftRecipient: null,
    giftMessage: '',
    senderName: '',
    method: 'Momo',
    customer: null,
    orderCode: ''
  };
}

/**
 * Quy trình thanh toán:
 *
 * Giỏ hàng
 * → Quà tặng nếu có
 * → Thanh toán
 * → Phương thức
 * → QR
 * → Chốt đơn
 */
@Injectable({ providedIn: 'root' })
export class CheckoutService {

  draft: CheckoutDraft = this.load();
  /** Kết quả kiểm tra mã khuyến mãi gần nhất. */
  private checkedCoupon: CouponCheck | null = null;

  /** Mã đã được backend xác nhận. */
  private checkedCouponCode = '';

  /** Danh sách game tại thời điểm kiểm tra mã. */
  private checkedCartSignature = '';
  constructor(
    private cart: CartWishlistService,
    private auth: AuthService,
    private coupons: CouponService,
    private toast: ToastService
  ) {

    /**
     * Đổi tài khoản / đăng xuất
     * → hủy quy trình checkout đang dở.
     */
    auth.scope$
      .pipe(skip(1))
      .subscribe(() => this.reset());
  }

  save(): void {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify(this.draft)
      );
    } catch {
      /* bỏ qua */
    }
  }

  update(
    changes: Partial<CheckoutDraft>
  ): void {

    this.draft = {
      ...this.draft,
      ...changes
    };

    this.save();
  }

  reset(): void {
  this.draft = emptyDraft();

  this.checkedCoupon = null;
  this.checkedCouponCode = '';
  this.checkedCartSignature = '';

  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* bỏ qua */
  }
}


/**
 * Chữ ký giỏ hàng tại thời điểm kiểm tra mã.
 * Nếu giỏ hàng thay đổi thì kết quả kiểm tra cũ không còn hiệu lực.
 */
private getCurrentCartSignature(): string {
  return JSON.stringify(
    this.cart.getCouponItems()
  );
}

/** Tổng tiền và số tiền giảm hiển thị trên giao diện. */
get summary(): CheckoutSummary {
  const subtotal = this.cart.cartTotalPrice;

  const signature = this.getCurrentCartSignature();

  const couponStillValid =
    !!this.draft.couponCode &&
    !!this.checkedCoupon &&
    this.checkedCoupon.ok &&
    this.checkedCouponCode === this.draft.couponCode &&
    this.checkedCartSignature === signature;

  if (!couponStillValid) {
    return {
      subtotal,
      discount: 0,
      total: subtotal,
      couponMessage: this.draft.couponCode
        ? 'Vui lòng kiểm tra lại mã giảm giá.'
        : '',
      couponOk: false
    };
  }

  const discount = Math.min(
    this.checkedCoupon!.discount,
    subtotal
  );

  return {
    subtotal,
    discount,
    total: Math.max(subtotal - discount, 0),
    couponMessage: this.checkedCoupon!.message,
    couponOk: true
  };
}

/** Kiểm tra mã bằng API backend. */
async checkCoupon(code: string): Promise<CouponCheck> {
  return this.coupons.check(
    code,
    this.cart.getCouponItems()
  );
}

/** Áp dụng mã giảm giá sau khi backend xác nhận. */
async applyCoupon(code: string): Promise<CouponCheck> {
  const normalizedCode = code.trim().toUpperCase();

  if (!normalizedCode) {
    this.checkedCoupon = null;
    this.checkedCouponCode = '';
    this.checkedCartSignature = '';

    this.update({
      couponCode: ''
    });

    return {
      ok: false,
      message: 'Vui lòng nhập mã giảm giá!',
      discount: 0
    };
  }

  const cartSignature = this.getCurrentCartSignature();

  const result = await this.checkCoupon(normalizedCode);

  if (!result.ok) {
    this.checkedCoupon = null;
    this.checkedCouponCode = '';
    this.checkedCartSignature = '';

    this.update({
      couponCode: ''
    });

    return result;
  }

  // Không áp dụng nếu giỏ hàng thay đổi trong lúc đang gọi API.
  if (cartSignature !== this.getCurrentCartSignature()) {
    this.checkedCoupon = null;
    this.checkedCouponCode = '';
    this.checkedCartSignature = '';

    this.update({
      couponCode: ''
    });

    return {
      ok: false,
      message: 'Giỏ hàng đã thay đổi. Vui lòng áp dụng lại mã giảm giá.',
      discount: 0
    };
  }

  this.checkedCoupon = result;
  this.checkedCouponCode = normalizedCode;
  this.checkedCartSignature = cartSignature;

  this.update({
    couponCode: normalizedCode
  });

  return result;
}


  /** Điều kiện vào checkout. */
  canCheckout(): {
    ok: boolean;
    message: string;
  } {

    if (!this.auth.isLoggedIn) {

      return {
        ok: false,
        message:
          'Vui lòng đăng nhập để tiến hành thanh toán!'
      };
    }

    if (
      this.cart.cartItems.length === 0
    ) {

      return {
        ok: false,
        message:
          'Giỏ hàng của bạn đang trống!'
      };
    }

    return {
      ok: true,
      message: ''
    };
  }

  /**
   * Kiểm tra quyền truy cập từng bước checkout.
   */
  guard(
    step:
      | 'gift'
      | 'payment'
      | 'method'
      | 'qr'
  ): string | null {

    const check =
      this.canCheckout();

    if (!check.ok) {

      this.toast.warning(
        check.message
      );

      if (!this.auth.isLoggedIn) {
        this.auth.requestLogin();
      }

      return '/gio-hang';
    }

    if (
      step !== 'gift' &&
      this.cart.hasGiftItems &&
      !this.draft.giftRecipient
    ) {

      this.toast.warning(
        'Vui lòng chọn người nhận quà trước khi thanh toán!'
      );

      return '/tang-qua';
    }

    if (
      step === 'qr' &&
      !this.draft.customer
    ) {

      this.toast.warning(
        'Vui lòng điền thông tin thanh toán trước!'
      );

      return '/phuong-thuc-thanh-toan';
    }

    return null;
  }

  /** Tạo mã đơn hàng hiển thị ở checkout. */
  ensureOrderCode(): string {

    if (!this.draft.orderCode) {

      this.update({
        orderCode:
          `STEAL-${Date.now().toString(36).toUpperCase()}`
      });
    }

    return this.draft.orderCode;
  }

  /**
   * Bắt đầu checkout từ giỏ hàng.
   */
  start(): string | null {

    const check =
      this.canCheckout();

    if (!check.ok) {

      this.toast.warning(
        check.message
      );

      if (!this.auth.isLoggedIn) {
        this.auth.requestLogin();
      }

      return null;
    }

    return this.cart.hasGiftItems
      ? '/tang-qua'
      : '/thanh-toan';
  }

  get hasGift(): boolean {
    return this.cart.hasGiftItems;
  }

  /**
   * Thanh toán thành công.
   *
   * Quan trọng:
   * completeOrder() bây giờ là async vì phải chờ
   * backend xử lý POST /orders/purchase.
   */
  async placeOrder(): Promise<OrderRecord | null> {

    const gift:
      GiftTarget | null =
      this.cart.hasGiftItems &&
      this.draft.giftRecipient
        ? {
            label:
              this.draft.giftRecipient.label,

            accountScope:
              this.draft.giftRecipient.accountScope,

            message:
              this.draft.giftMessage,

            senderName:
              this.draft.senderName ||
              this.auth.currentUser?.username ||
              'Một người bạn'
          }
        : null;

    /**
     * Gọi CartWishlistService.
     *
     * Service này sẽ:
     *
     * 1. Gọi backend purchase cho từng game.
     * 2. Backend tạo Order trong MongoDB.
     * 3. Backend thêm game vào Library.
     * 4. Frontend reload Library từ backend.
     * 5. Xóa giỏ hàng.
     */
    const summary = this.summary;

const order = await this.cart.completeOrder({
  method: this.draft.method,

  couponCode: summary.couponOk
    ? this.draft.couponCode
    : '',

  discount: summary.discount,

  gift,

  orderId: this.draft.orderCode || undefined
});

    /**
     * Chỉ reset checkout nếu mua thành công.
     */
    if (order) {
      this.reset();
    }

    return order;
  }

  private load(): CheckoutDraft {

    try {

      const raw =
        sessionStorage.getItem(
          SESSION_KEY
        );

      return raw
        ? {
            ...emptyDraft(),
            ...(JSON.parse(raw) as Partial<CheckoutDraft>)
          }
        : emptyDraft();

    } catch {

      return emptyDraft();
    }
  }
}