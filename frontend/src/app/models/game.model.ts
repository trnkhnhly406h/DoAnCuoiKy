/** Nhãn nội dung nhạy cảm, dùng cho bộ lọc "Tùy chỉnh cửa hàng". */
export type ContentFlag = 'mature' | 'violence' | 'nuditySome';

export interface Genre {
  slug: string;
  label: string;
}

/** Cấu hình máy (tối thiểu / đề nghị). */
export interface SystemSpec {
  os: string;
  cpu: string;
  ram: string;
  gpu: string;
  disk: string;
}

export interface Game {
  /**
   * ID MongoDB của game.
   *
   * Dùng khi giao tiếp với backend, ví dụ:
   * - Review
   * - Các API cần ObjectId
   *
   * KHÔNG dùng field này cho URL frontend.
   */
  mongoId?: string;

  /**
   * Mã định danh duy nhất phía frontend,
   * cũng là slug trên URL (/game/:slug).
   *
   * Ví dụ:
   * hollow-knight
   */
  id: string;

  /**
   * Mã game trong cơ sở dữ liệu.
   *
   * Ví dụ:
   * IND02
   */
  code: string;

  title: string;

  /** Ảnh bìa (anhBia). */
  coverImage: string;

  /** Hai ảnh mô tả (anhMota1, anhMota2). */
  screenshots: string[];

  /** Video giới thiệu; null nếu game chưa có trailer. */
  video: string | null;

  /** Danh sách slug thể loại (xem GameCatalogService.genres). */
  genres: string[];

  /** Định dạng ISO yyyy-MM-dd, hiển thị bằng date pipe. */
  releaseDate: string;

  reviewsSummary: string;

  description: string;

  longDescription: string;

  developer: string;

  publisher: string;

  ageRating: number;

  /** Giá gốc (VNĐ). 0 nếu game miễn phí. */
  originalPrice: number;

  /** Phần trăm giảm giá 0-100. */
  discountPercent: number;

  /** Giá cuối cùng khách phải trả (đã trừ giảm giá). */
  finalPrice: number;

  isFree: boolean;

  contentFlags: ContentFlag[];

  diskGB: number;

  minSpec: SystemSpec;

  recSpec: SystemSpec;
}