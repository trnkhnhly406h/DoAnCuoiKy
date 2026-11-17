
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { CartWishlistService } from '../../services/cart-wishlist';
import { ChatService, DatabaseUser } from '../../services/chat';
import { CheckoutService } from '../../services/checkout';
import { normalizeText } from '../../services/storage';
import { ToastService } from '../../services/toast';
import { UserProfileService } from '../../services/user-profile';

@Component({
  selector: 'app-tang-qua',
  templateUrl: './tang-qua.html',
  styleUrls: ['./tang-qua.css'],
  standalone: false
})
export class TangQuaComponent implements OnInit {
  couponInput = '';
  couponError = '';
  showFriendModal = false;
  friendKeyword = '';

  constructor(
    public cart: CartWishlistService,
    public checkout: CheckoutService,
    public profile: UserProfileService,
    private chat: ChatService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.couponInput = this.checkout.draft.couponCode;

    this.checkout.update({
      senderName: this.checkout.draft.senderName || this.profile.displayName
    });
  }

  get selectedFriendLabel(): string {
    return this.checkout.draft.giftRecipient?.label ?? '';
  }

  /** Danh sách bạn bè thật của tài khoản, có lọc theo từ khóa. */
  get friends(): DatabaseUser[] {
    const q = normalizeText(this.friendKeyword);

    return this.chat.friendsList.filter(
      f => !q || normalizeText(f.username).includes(q)
    );
  }

  get totalGifts(): number {
    return this.cart.giftItems.length;
  }

  formatMoney(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }

  /* ---------- Mã giảm giá ---------- */

  async applyCoupon(): Promise<void> {
  const couponCode = this.couponInput.trim();

  if (!couponCode) {
    this.couponError = 'Vui lòng nhập mã khuyến mãi.';
    return;
  }

  const result = await this.cart.checkCoupon(couponCode);

  this.couponError = result.ok ? '' : result.message;

  if (result.ok) {
    this.toast.success(`Đã áp dụng mã ${couponCode.toUpperCase()}`);
  }
}

  /* ---------- Chọn người nhận ---------- */

  openFriendModal(): void {
    this.friendKeyword = '';
    this.showFriendModal = true;
  }

  closeFriendModal(): void {
    this.showFriendModal = false;
  }

  pickFriend(friend: DatabaseUser): void {
    this.checkout.update({
      giftRecipient: { label: friend.username }
    });

    this.closeFriendModal();
  }

  /** Bấm "Nhập tên": bỏ người nhận đã chọn và sang trang nhập tên / email. */
  goTypeName(): void {
    this.checkout.update({ giftRecipient: null });
    this.router.navigate(['/tang-qua-nhap-ten']);
  }

  /* ---------- Điều hướng ---------- */

  backToCart(): void {
    this.router.navigate(['/gio-hang']);
  }

  continueShopping(): void {
    this.router.navigate(['/']);
  }

  next(): void {
    if (!this.auth.isLoggedIn) return;

    if (!this.checkout.draft.giftRecipient) {
      this.toast.warning(
        'Vui lòng chọn người nhận quà hoặc chọn "Nhập tên" trước khi tiếp tục!'
      );
      return;
    }

    this.router.navigate(['/tang-qua-nhap-ten']);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
