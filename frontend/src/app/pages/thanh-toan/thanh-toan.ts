import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartWishlistService } from '../../services/cart-wishlist';
import { CheckoutService } from '../../services/checkout';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-thanh-toan',
  templateUrl: './thanh-toan.html',
  styleUrls: ['./thanh-toan.css'],
  standalone: false
})
export class ThanhToanComponent implements OnInit {
  couponInput = '';
  couponError = '';

  constructor(
    public cart: CartWishlistService,
    public checkout: CheckoutService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const redirect = this.checkout.guard('payment');
    if (redirect) {
      this.router.navigate([redirect]);
      return;
    }
    this.couponInput = this.checkout.draft.couponCode;
  }

  get giftRecipient(): string {
    return this.checkout.draft.giftRecipient?.label ?? '';
  }

  formatMoney(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }

  async applyCoupon(): Promise<void> {
    this.couponError = '';

    const result = await this.checkout.applyCoupon(this.couponInput);

    this.couponError = result.ok ? '' : result.message;

    if (result.ok) {
      this.toast.success(`Đã áp dụng mã ${this.checkout.draft.couponCode}!`);
    }
  }

  backToCart(): void {
    this.router.navigate([this.cart.hasGiftItems ? '/tang-qua-nhap-ten' : '/gio-hang']);
  }

  editCart(): void {
    this.router.navigate(['/gio-hang']);
  }

  continueShopping(): void {
    this.router.navigate(['/']);
  }

  next(): void {
    const redirect = this.checkout.guard('payment');
    if (redirect) {
      this.router.navigate([redirect]);
      return;
    }
    this.router.navigate(['/phuong-thuc-thanh-toan']);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}