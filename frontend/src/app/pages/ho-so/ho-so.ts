
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';

import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../services/auth';
import { CartWishlistService } from '../../services/cart-wishlist';
import { ChatService } from '../../services/chat';
import { GameCatalogService } from '../../services/game-catalog';
import {
  UserProfileService,
  countryFlag
} from '../../services/user-profile';

@Component({
  selector: 'app-ho-so',
  templateUrl: './ho-so.html',
  styleUrls: ['./ho-so.css'],
  standalone: false
})
export class HoSoComponent implements OnInit, OnDestroy {

  readonly previewLimit = 6;

  private authSub?: Subscription;

  constructor(
    public profileService: UserProfileService,
    public authService: AuthService,
    public chatService: ChatService,
    public cartWishlistService: CartWishlistService,
    public catalog: GameCatalogService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

    // Tự cập nhật trang ngay khi đăng nhập / đăng xuất
    this.authSub = this.authService.currentUser$
      .subscribe(() => {

        // Yêu cầu Angular cập nhật giao diện
        this.cdr.detectChanges();

      });
  }

  ngOnDestroy(): void {

    // Hủy subscription khi rời trang
    this.authSub?.unsubscribe();

  }

  get flag(): string {
    return countryFlag(
      this.profileService.profile.country
    );
  }

  goToGameDetail(
    gameOrId: { id: string } | string
  ): void {

    const id =
      typeof gameOrId === 'string'
        ? gameOrId
        : gameOrId.id;

    this.router.navigate(['/game', id]);
  }

  goToGameDetailById(id: string): void {
    this.router.navigate(['/game', id]);
  }
}
