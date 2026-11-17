
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Game } from '../../models/game.model';
import { AuthService } from '../../services/auth';
import { ChatService, PublicProfile, SELF_ID } from '../../services/chat';
import { ConfirmService } from '../../services/confirm';
import { GameCatalogService } from '../../services/game-catalog';
import { ToastService } from '../../services/toast';
import { countryFlag } from '../../services/user-profile';

/** Hồ sơ công khai của người dùng khác: /nguoi-dung/:id (bạn bè xem được game, danh sách ước...). */
@Component({
  selector: 'app-nguoi-dung',
  templateUrl: './nguoi-dung.html',
  styleUrls: ['../ho-so/ho-so.css', './nguoi-dung.css'],
  standalone: false
})
export class NguoiDungComponent implements OnInit, OnDestroy {
  userId = '';
  private sub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    public chat: ChatService,
    private catalog: GameCatalogService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.route.paramMap.subscribe(params => {
      this.userId = params.get('id') ?? '';
      // Xem hồ sơ của chính mình thì chuyển sang trang Hồ sơ.
      if (this.userId === SELF_ID) this.router.navigate(['/ho-so'], { replaceUrl: true });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /** Luôn lấy mới để phản ánh kịp thay đổi quan hệ (kết bạn, hủy kết bạn, chặn...). */
  get profile(): PublicProfile | null {
    return this.userId && this.userId !== SELF_ID ? this.chat.getPublicProfile(this.userId) : null;
  }

  get flag(): string {
    return countryFlag(this.profile?.country ?? '');
  }

  games(ids: string[]): Game[] {
    return ids.map(id => this.catalog.getById(id)).filter((g): g is Game => !!g);
  }

  /* ---------- Hành động theo quan hệ ---------- */

  addFriend(): void {
    const p = this.profile;
    if (!p) return;
    const r = this.chat.sendFriendRequest(p.user);
    this.toast.show(r.message, r.ok ? 'success' : 'warning');
  }

  cancelRequest(): void {
    const p = this.profile;
    if (!p) return;
    this.chat.cancelSentRequest(p.user.id);
    this.toast.warning(`Đã hủy lời mời kết bạn gửi tới ${p.user.username}.`);
  }

  accept(): void {
    const p = this.profile;
    if (!p) return;
    this.chat.acceptFriendRequest(p.user);
    this.toast.success(`Hai bạn và ${p.user.username} đã trở thành bạn bè!`);
  }

  decline(): void {
    const p = this.profile;
    if (!p) return;
    this.chat.declineFriendRequest(p.user.id);
    this.toast.warning(`Đã từ chối lời mời kết bạn từ ${p.user.username}.`);
  }

  message(): void {
    const p = this.profile;
    if (p) this.chat.openDirectChat(p.user);
  }

  

unfriend(): void {
  const p = this.profile;
  if (!p) return;

  if (!window.confirm(
    `Bạn có chắc chắn muốn hủy kết bạn với ${p.user.username}?`
  )) {
    return;
  }

  this.chat.unfriend(p.user.id);

  this.toast.success(
    `Đã hủy kết bạn với ${p.user.username}.`
  );

  this.cdr.detectChanges();
}

block(): void {
  const p = this.profile;
  if (!p) return;

  if (!window.confirm(
    `Bạn có chắc chắn muốn chặn ${p.user.username}?`
  )) {
    return;
  }

  const result = this.chat.blockUser(p.user);

  this.toast.show(
    result.message,
    result.ok ? 'success' : 'warning'
  );

  this.cdr.detectChanges();
}


unblock(): void {
  const p = this.profile;
  if (!p) return;

  const result = this.chat.unblockUser(p.user.id);

  this.cdr.detectChanges();

  this.toast.show(
    result.message,
    result.ok ? 'success' : 'warning'
  );
}


  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
