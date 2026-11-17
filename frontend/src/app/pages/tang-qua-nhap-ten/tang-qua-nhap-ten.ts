import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, EMAIL_REGEX } from '../../services/auth';
import { CartWishlistService } from '../../services/cart-wishlist';
import { ChatService } from '../../services/chat';
import { CheckoutService } from '../../services/checkout';
import { ToastService } from '../../services/toast';
import { UserProfileService } from '../../services/user-profile';

const MAX_MESSAGE = 160;

@Component({
  selector: 'app-tang-qua-nhap-ten',
  templateUrl: './tang-qua-nhap-ten.html',
  styleUrls: ['./tang-qua-nhap-ten.css'],
  standalone: false
})
export class TangQuaNhapTenComponent implements OnInit {
  readonly maxMessage = MAX_MESSAGE;
  recipientInput = '';
  message = '';
  signature = '';
  errorText = '';
  /** Người nhận được chọn từ danh sách bạn bè ở bước trước. */
  friendRecipient = '';

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
    const draft = this.checkout.draft;
    const label = draft.giftRecipient?.label ?? '';
    const isFriend = this.chat.friendsList.some(f => f.username === label);
    this.friendRecipient = isFriend ? label : '';
    this.recipientInput = isFriend ? '' : label;
    this.message = draft.giftMessage;
    this.signature = draft.senderName && draft.senderName !== this.profile.displayName ? draft.senderName : '';
  }

  get friendAvatar(): string {
    return this.chat.friendsList.find(f => f.username === this.friendRecipient)?.avatar ?? this.profile.defaultAvatar;
  }

  get charsLeft(): number {
    return MAX_MESSAGE - this.message.length;
  }

  get canProceed(): boolean {
    return !!this.friendRecipient || this.recipientInput.trim().length >= 2;
  }

  formatMoney(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }

  backToCart(): void {
    this.router.navigate(['/gio-hang']);
  }

  backToRecipient(): void {
    this.router.navigate(['/tang-qua']);
  }

  continueShopping(): void {
    this.router.navigate(['/']);
  }

  next(): void {
    this.errorText = '';
    let recipient = this.checkout.draft.giftRecipient;

    if (!this.friendRecipient) {
      const input = this.recipientInput.trim();
      if (input.length < 2) {
        this.errorText = 'Vui lòng nhập tên tài khoản hoặc email người nhận!';
        return;
      }
      if (input.includes('@') && !EMAIL_REGEX.test(input)) {
        this.errorText = 'Email người nhận không đúng định dạng!';
        return;
      }
      const me = this.auth.currentUser;
      if (me && [me.username, me.email].some(v => v.trim().toLowerCase() === input.toLowerCase())) {
        this.errorText = 'Bạn không thể tự tặng quà cho chính mình. Hãy bỏ chọn "Đây là một món quà" trong giỏ hàng.';
        return;
      }
      const account = this.auth.lookupAccount(input);
      recipient = { label: account ? account.username : input, accountScope: account?.scope };
    }
    if (!recipient) {
      this.toast.warning('Chưa chọn người nhận quà!');
      return;
    }
    this.checkout.update({
      giftRecipient: recipient,
      giftMessage: this.message.trim(),
      senderName: this.signature.trim() || this.profile.displayName
    });
    this.router.navigate(['/thanh-toan']);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
