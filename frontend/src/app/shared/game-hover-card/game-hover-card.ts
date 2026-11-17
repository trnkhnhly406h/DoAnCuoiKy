import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Game } from '../../models/game.model';
import { CartWishlistService } from '../../services/cart-wishlist';
import { GameCatalogService } from '../../services/game-catalog';
import { CheckoutService } from '../../services/checkout';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-game-hover-card',
  templateUrl: './game-hover-card.html',
  styleUrls: ['./game-hover-card.css'],
  standalone: false
})
export class GameHoverCardComponent {
  @Input({ required: true }) game!: Game;
  @Input() position: 'left' | 'right' = 'right';
  @Input() isFriendWishlist: boolean = false;
  @Input() friendRecipient: string = '';

  constructor(
    public cartWishlistService: CartWishlistService,
    public catalog: GameCatalogService,
    private checkout: CheckoutService,
    private toast: ToastService,
    private router: Router
  ) {}

  onAddWishlist(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.cartWishlistService.addToWishlist(this.game);
  }

  onAddCart(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.cartWishlistService.addToCart(this.game);
  }

  // MUA TẶNG BẠN BÈ TỪ DANH SÁCH ƯỚC CỦA BẠN (DÙ BẢN THÂN ĐÃ SỞ HỮU)
  onAddGiftToFriend(event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    const success = this.cartWishlistService.addToCart(this.game, true);
    if (success && this.friendRecipient) {
      this.checkout.update({
        giftRecipient: { label: this.friendRecipient }
      });
      this.toast.success(
        `Đã thêm "${this.game.title}" vào giỏ hàng để tặng cho ${this.friendRecipient}!`
      );
    }
  }

  goToDetail(event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/game', this.game.id]);
  }
}