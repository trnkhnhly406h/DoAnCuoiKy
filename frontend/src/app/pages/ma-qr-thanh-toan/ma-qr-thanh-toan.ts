import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CartItem, CartWishlistService } from '../../services/cart-wishlist';
import { CheckoutService } from '../../services/checkout';
import { ChatService } from '../../services/chat';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-ma-qr-thanh-toan',
  templateUrl: './ma-qr-thanh-toan.html',
  styleUrls: ['./ma-qr-thanh-toan.css'],
  standalone: false
})
export class MaQrThanhToanComponent implements OnInit {
  method = 'Momo';
  maDonHang = '';
  qrImageUrl = '';
  qrError = false;
  games: CartItem[] = [];
  total = 0;
  processing = false;

  constructor(
    private cart: CartWishlistService,
    private checkout: CheckoutService,
    private chat: ChatService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const redirect = this.checkout.guard('qr');

    if (redirect) {
      this.router.navigate([redirect]);
      return;
    }

    this.method = this.checkout.draft.method;
    this.maDonHang = this.checkout.ensureOrderCode();
    this.games = this.cart.cartItems;
    this.total = this.checkout.summary.total;

    // Mã QR demo thanh toán đơn hàng
    const payload = encodeURIComponent(
      `STEAL|${this.maDonHang}|${this.method}|${this.total}`
    );

    this.qrImageUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${payload}`;
  }

  onQrError(): void {
    this.qrError = true;
  }

  /** Xác nhận thanh toán: Chốt đơn, xóa giỏ hàng và trừ game ước trong hồ sơ bạn bè */
  async xacNhan(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    try {
      const order = await this.checkout.placeOrder();

      if (!order) {
        this.processing = false;
        this.toast.warning(
          'Không thể hoàn tất đơn hàng. Vui lòng kiểm tra lại giỏ hàng!'
        );
        this.router.navigate(['/gio-hang']);
        return;
      }

      // 1. XÓA SẠCH GIỎ HÀNG NGAY KHI THANH TOÁN THÀNH CÔNG
      this.cart.clearCart();

      // 2. XÓA GAME VỪA TẶNG KHỎI DANH SÁCH ƯỚC CỦA BẠN BÈ VÀ CHUYỂN VÀO THƯ VIỆN CỦA BẠN ĐÓ
      if (order.giftRecipient) {
        for (const item of order.items) {
          if (item.forGift) {
            this.chat.removeFriendWishlistGame(order.giftRecipient, item.gameId);
          }
        }
      }

      const gifts = order.items.filter(i => i.forGift).length;

      this.toast.success(
        `Thanh toán thành công đơn #${order.id}!${
          gifts
            ? ` ${gifts} món quà đã được gửi tới ${order.giftRecipient}.`
            : ''
        }`
      );

      // Chuyển hướng sang Thư viện
      this.router.navigate(['/thu-vien']);

    } catch (error) {
      console.error('Lỗi xác nhận thanh toán:', error);
      this.processing = false;
      this.toast.warning('Không thể hoàn tất thanh toán. Vui lòng thử lại!');
    }
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}