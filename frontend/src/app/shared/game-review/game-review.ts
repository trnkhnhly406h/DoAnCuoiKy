import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ChangeDetectorRef
} from '@angular/core';
import { AuthService } from '../../services/auth';
import { CartWishlistService } from '../../services/cart-wishlist';
import { ConfirmService } from '../../services/confirm';
import {
  Review,
  ReviewService
} from '../../services/review';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-game-reviews',
  templateUrl: './game-review.html',
  styleUrls: ['./game-review.css'],
  standalone: false
})
export class GameReviewsComponent
  implements OnInit, OnChanges {

  @Input() gameId = '';

  @Input() mongoGameId = '';

  @Input() canWrite = false;

  reviews: Review[] = [];

  average = 0;

  rating = 0;

  text = '';

  hover = 0;

  readonly stars = [1, 2, 3, 4, 5];

  loading = false;

  submitting = false;

  hasMine = false;

  constructor(
  private store: ReviewService,
  private auth: AuthService,
  private cart: CartWishlistService,
  private toast: ToastService,
  private confirm: ConfirmService,
  private cdr: ChangeDetectorRef
) {}

  get owned(): boolean {
    return this.cart.isOwned(this.gameId);
  }

  get username(): string {
    return this.auth.currentUser?.username ?? '';
  }

  ngOnInit(): void {
    console.log(
      'GAME REVIEWS INIT:',
      {
        gameId: this.gameId,
        mongoGameId: this.mongoGameId,
        canWrite: this.canWrite
      }
    );
  }

  async ngOnChanges(
    changes: SimpleChanges
  ): Promise<void> {

    console.log(
      'GAME REVIEWS CHANGES:',
      {
        gameId: this.gameId,
        mongoGameId: this.mongoGameId,
        canWrite: this.canWrite,
        changes
      }
    );

    await this.reload();
  }

  private async reload(): Promise<void> {

  console.log(
    'GAME REVIEWS RELOAD:',
    {
      gameId: this.gameId,
      mongoGameId: this.mongoGameId
    }
  );

  if (!this.mongoGameId) {

    console.warn(
      'GAME REVIEWS: KHÔNG CÓ mongoGameId'
    );

    this.reviews = [];
    this.average = 0;
    this.hasMine = false;
    this.rating = 0;
    this.text = '';
    this.loading = false;

    this.cdr.detectChanges();
    return;
  }

  this.loading = true;
  this.cdr.detectChanges();

  try {

    console.log(
      'GAME REVIEWS: GỌI API LIST REVIEW',
      this.mongoGameId
    );

    this.reviews = await this.store.list(
      this.mongoGameId
    );

    console.log(
      'GAME REVIEWS: REVIEW RESULT',
      this.reviews
    );

    this.average = this.reviews.length
      ? this.reviews.reduce(
          (sum, review) =>
            sum + review.rating,
          0
        ) / this.reviews.length
      : 0;

    const mine = await this.store.mine(
      this.mongoGameId
    );

    console.log(
      'GAME REVIEWS: MY REVIEW',
      mine
    );

    this.hasMine = !!mine;

    this.rating = mine?.rating ?? 0;
    this.text = mine?.text ?? '';

  } catch (error) {

    console.error(
      'Lỗi tải review của game:',
      error
    );

    this.reviews = [];
    this.average = 0;
    this.hasMine = false;

  } finally {

    this.loading = false;

    // Yêu cầu Angular cập nhật giao diện ngay
    this.cdr.detectChanges();
  }
}

  isMine(review: Review): boolean {
    if (review.seed || !this.username) {
      return false;
    }

    const current = this.username.trim().toLowerCase();

    if (typeof review.user === 'string') {
      return review.user.trim().toLowerCase() === current;
    }

    const user = review.user as any;
    return (user?.tenDangNhap || '').trim().toLowerCase() === current;
  }

  async submit(): Promise<void> {

    if (!this.auth.isLoggedIn) {
      this.auth.requestLogin();
      return;
    }

    if (!this.owned) {
      this.toast.warning(
        'Bạn cần tải game về thư viện trước khi đánh giá.'
      );
      return;
    }

    if (this.rating < 1) {
      this.toast.warning(
        'Hãy chọn số sao đánh giá.'
      );
      return;
    }

    const content = this.text.trim();

    if (content.length < 5) {
      this.toast.warning(
        'Nội dung đánh giá cần ít nhất 5 ký tự.'
      );
      return;
    }

    if (this.submitting) {
      return;
    }

    if (!this.mongoGameId) {
      this.toast.warning(
        'Không xác định được mã game.'
      );

      console.error(
        'GAME REVIEWS SUBMIT: thiếu mongoGameId',
        {
          gameId: this.gameId,
          mongoGameId: this.mongoGameId
        }
      );

      return;
    }

    this.submitting = true;

    try {

      console.log(
        'GAME REVIEWS: GỬI REVIEW',
        {
          mongoGameId: this.mongoGameId,
          rating: this.rating,
          text: content
        }
      );

      await this.store.save(
        this.mongoGameId,
        this.rating,
        content
      );

      await this.reload();

      this.toast.success(
        'Đã đăng đánh giá của bạn!'
      );

    } catch (error: any) {

      console.error(
        'Lỗi đăng review:',
        error
      );

      this.toast.warning(
        error?.error?.message ||
        error?.message ||
        'Không thể đăng đánh giá. Vui lòng thử lại.'
      );

    } finally {

  this.submitting = false;
  this.cdr.detectChanges();
}
  }

  async remove(): Promise<void> {
    if (this.submitting) {
      return;
    }

    if (!this.mongoGameId) {
      this.toast.warning('Không xác định được mã game.');
      return;
    }

    // 1. Tìm đánh giá của tài khoản hiện tại
    let targetId = '';
    try {
      const mine = await this.store.mine(this.mongoGameId);
      targetId = mine?.id || '';
    } catch (e) {
      console.error('Lỗi lấy đánh giá hiện tại:', e);
    }

    // Nếu không lấy được qua API mine, tìm trong danh sách reviews đang hiển thị
    if (!targetId) {
      const own = this.reviews.find(r => this.isMine(r));
      targetId = own?.id || '';
    }

    if (!targetId) {
      this.toast.warning('Không tìm thấy đánh giá của bạn để xóa.');
      return;
    }

    // 2. Dùng window.confirm để chắc chắn hiển thị hộp thoại xác nhận tức thì
    const xacNhan = window.confirm('Bạn có chắc chắn muốn xóa bài đánh giá này?');
    if (!xacNhan) {
      return;
    }

    this.submitting = true;
    this.cdr.detectChanges();

    try {
      console.log('BẮT ĐẦU XÓA ĐÁNH GIÁ CÓ ID:', targetId);
      await this.store.remove(targetId);

      this.rating = 0;
      this.text = '';
      this.hasMine = false;

      await this.reload();

      this.toast.success('Đã xóa đánh giá của bạn thành công!');
    } catch (error: any) {
      console.error('Lỗi xóa review:', error);
      this.toast.warning(
        error?.error?.message ||
        error?.message ||
        'Không thể xóa đánh giá. Vui lòng thử lại.'
      );
    } finally {
      this.submitting = false;
      this.cdr.detectChanges();
    }
  }

}