import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Review {
  id: string;
  gameId: string;
  user: string;
  avatar: string;
  rating: number;
  text: string;
  at: number;
  seed?: boolean;
}

interface BackendReview {
  _id: string;
  maGame: string;
  maTaiKhoan: string;
  khuyenNghi: boolean;
  rating?: number;
  noiDung: string;
  ngayDanhGia: string;
  an: boolean;
  user?: {
    tenDangNhap?: string;
    hoTen?: string;
    anhDaiDien?: string;
  };
  taiKhoan?: {
    tenDangNhap?: string;
    hoTen?: string;
    anhDaiDien?: string;
  };
}

interface ReviewResponse {
  success: boolean;
  message?: string;
  data?: BackendReview[];
}

interface SingleReviewResponse {
  success: boolean;
  message?: string;
  data?: BackendReview;
}

const API_URL = 'http://localhost:3000/api/store';

const SEED_USERS = [
  'khach_vip01',
  'moba_player',
  'gamer_hcm02',
  'khach_vip03',
  'khach_vip05'
];

const SEED_TEXTS: [number, string][] = [
  [5, 'Chơi cuốn hơn mình nghĩ, đồ họa đẹp và chạy mượt. Rất đáng tiền!'],
  [4, 'Gameplay hay, cốt truyện ổn. Còn vài lỗi nhỏ nhưng không ảnh hưởng nhiều.'],
  [5, 'Cày cả cuối tuần vẫn chưa chán. Rủ bạn bè chơi cùng càng vui.'],
  [3, 'Ý tưởng tốt nhưng nhịp game hơi chậm ở giữa. Hy vọng bản cập nhật sau cải thiện.'],
  [4, 'Âm nhạc và hình ảnh rất có hồn, điều khiển dễ làm quen.']
];

const hash = (s: string): number =>
  [...s].reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) % 100000,
    7
  );

const avatarOf = (u: string): string =>
  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u)}`;

@Injectable({
  providedIn: 'root'
})
export class ReviewService {

  constructor(private http: HttpClient) {}

  /**
   * Lấy token JWT hiện tại.
   */
  private getToken(): string {
    return localStorage.getItem('steal_token') ?? '';
  }

  /**
   * Tạo headers có Authorization Bearer token.
   */
  private authHeaders(): HttpHeaders {
    const token = this.getToken();

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  /**
   * Chuyển review từ backend sang format mà UI hiện tại đang sử dụng.
   */
  private mapBackendReview(review: BackendReview): Review {
  const account: any =
    review.user ??
    review.taiKhoan ??
    {};

  const taiKhoan: any = review.maTaiKhoan;

  const username =
    account.tenDangNhap ||
    account.hoTen ||
    (typeof taiKhoan === 'string' ? taiKhoan : '') ||
    taiKhoan?.tenDangNhap ||
    taiKhoan?.hoTen ||
    'Người chơi';

  const avatar =
    account.anhDaiDien ||
    taiKhoan?.anhDaiDien ||
    avatarOf(username);

  return {
    id: review._id,
    gameId: review.maGame,
    user: username,
    avatar,
    rating: review.rating ?? (review.khuyenNghi ? 5 : 1),
    text: review.noiDung || '',
    at: new Date(review.ngayDanhGia).getTime()
  };
}

  /**
   * Review mẫu dùng để giữ giao diện không bị trống
   * khi game chưa có nhiều review thật.
   */
  private seeds(gameId: string): Review[] {
    const h = hash(gameId);

    return [0, 1, 2].map(i => {
      const [rating, text] =
        SEED_TEXTS[(h + i * 2) % SEED_TEXTS.length];

      const user =
        SEED_USERS[(h + i) % SEED_USERS.length];

      return {
        id: `seed-${gameId}-${i}`,
        gameId,
        user,
        avatar: avatarOf(user),
        rating,
        text,
        at: Date.UTC(
          2026,
          8,
          5 + ((h + i * 7) % 20)
        ),
        seed: true
      };
    });
  }

  /**
   * Lấy review của một game từ backend.
   *
   * gameId ở đây phải là MongoDB _id.
   */
  async list(gameId: string): Promise<Review[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<ReviewResponse>(
          `${API_URL}/reviews/game/${encodeURIComponent(gameId)}`
        )
      );

      const backendReviews =
        response.data ?? [];

      const reviews =
        backendReviews
          .filter(review => !review.an)
          .map(review =>
            this.mapBackendReview(review)
          );

      return reviews.sort((a, b) => b.at - a.at);

    } catch (error) {
      console.error(
        'Lỗi lấy review từ backend:',
        error
      );

      return [];
    }
  }

  /**
   * Lấy review của tài khoản hiện tại cho game.
   *
   * Backend xác định user bằng JWT,
   * frontend không tự truyền username để xác thực.
   */
  async mine(gameId: string): Promise<Review | undefined> {
  try {
    const response = await firstValueFrom(
      this.http.get<SingleReviewResponse>(
        `${API_URL}/reviews/me/${encodeURIComponent(gameId)}`,
        { headers: this.authHeaders() }
      )
    );

    if (!response.success || !response.data) {
      return undefined;
    }

    return this.mapBackendReview(response.data);
  } catch (error) {
    console.error('Lỗi lấy review của tôi:', error);
    return undefined;
  }
}
  /**
   * Tạo hoặc cập nhật review.
   *
   * Backend sẽ tự kiểm tra:
   * - JWT hợp lệ
   * - game tồn tại
   * - user đã mua game
   * - game có trong Library
   *
   * gameId phải là MongoDB _id.
   */
  async save(
    gameId: string,
    rating: number,
    text: string
  ): Promise<Review> {

    const response = await firstValueFrom(
      this.http.post<SingleReviewResponse>(
        `${API_URL}/reviews`,
        {
          maGame: gameId,
          rating,
          khuyenNghi: rating >= 3,
          noiDung: text.trim()
        },
        {
          headers: this.authHeaders()
        }
      )
    );

    if (
      !response.success ||
      !response.data
    ) {
      throw new Error(
        response.message ||
        'Không thể đăng đánh giá.'
      );
    }

    return this.mapBackendReview(
      response.data
    );
  }

  /**
   * Xóa review của tài khoản hiện tại.
   *
   * Backend sẽ tự xác định review thuộc user nào
   * thông qua JWT.
   */
  async remove(reviewId: string): Promise<void> {

    const response = await firstValueFrom(
      this.http.delete<SingleReviewResponse>(
        `${API_URL}/reviews/${encodeURIComponent(reviewId)}`,
        {
          headers: this.authHeaders()
        }
      )
    );

    if (!response.success) {
      throw new Error(
        response.message ||
        'Không thể xóa đánh giá.'
      );
    }
  }
}
