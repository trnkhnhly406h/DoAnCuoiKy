import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Game } from '../models/game.model';
import { AuthService } from './auth';
import { GameCatalogService } from './game-catalog';
import { LibraryStatsService } from './library-stats';
import { NotificationItem, NotificationService } from './notification';
import { loadJson, loadJsonFor, saveJson, saveJsonFor } from './storage';
import { ToastService } from './toast';

/** API backend */
/** API backend */
const LIBRARY_API_URL = 'http://localhost:3000/api/store/library/me';
const PURCHASE_API_URL = 'http://localhost:3000/api/store/orders/purchase';
const GIFT_API_URL = 'http://localhost:3000/api/store/orders/gift';
const CHECKOUT_API_URL = 'http://localhost:3000/api/store/orders/checkout';
const CHECK_COUPON_API_URL =
  'http://localhost:3000/api/store/orders/check-coupon';
const REFUND_REQUEST_API_URL =
  'http://localhost:3000/api/store/refunds/request';
/** Response của GET /api/store/library/me */
interface BackendLibraryGame {
  _id?: string;

  maGame: string;
  tenTroChoi: string;
  duongDanSlug: string;

  giaGoc: number;
  giaHienTai: number;

  anhBia: string;
  anhThuNho?: string;
  videoTrailer?: string;
}

interface BackendLibraryResponse {
  success: boolean;
  data: BackendLibraryGame[];
  message?: string;
}

/** Response của POST /api/store/orders/purchase */
interface BackendPurchaseResponse {
  success: boolean;
  message?: string;

  data?: {
    maDonHang: string;
    maGame: string;
    tenGame: string;
    tongTien: number;
    phuongThucThanhToan: string;
    trangThai: string;
  };
}
/** Response của POST /api/store/orders/gift */
interface BackendGiftResponse {
  success: boolean;
  message?: string;

  data?: {
    maDonHang: string;
    maGame: string;
    tenGame: string;
    nguoiGui: string;
    nguoiNhan: string;
    emailNguoiNhan?: string;
    loiNhan?: string;
    tongTien: number;
    phuongThucThanhToan: string;
    trangThai: string;
  };
}
/** Response của POST /api/store/orders/checkout */
interface BackendCheckoutResponse {
  success: boolean;
  message?: string;

  data?: {
    maDonHang: string;
    maTaiKhoan: string;

    sanPham: {
      maGame: string;
      tenGame: string;
      donGia: number;
      laQua: boolean;
      nguoiNhan: string;
      loiNhan: string;
    }[];

    tongTienGoc: number;
    maKhuyenMai: string;
    phanTramGiamGia: number;
    soTienGiam: number;
    tongTien: number;

    phuongThucThanhToan: string;
    trangThai: string;
    createdAt: string;
  };
}
/** Response của POST /api/store/refunds/request */
interface BackendRefundResponse {
  success: boolean;
  message?: string;

  data?: {
    maYeuCau: string;
    maGame: string;
    trangThaiHoanTien: string;
    ngayYeuCau: string;
  };
}
/** Phần tử hiển thị trong giỏ hàng / danh sách ước */
export interface CartItem {
  id: string;
  title: string;

  /** Giá phải trả hiện tại. */
  price: number;

  originalPrice: number;
  discountPercent: number;
  thumb: string;

  /** Thời điểm thêm vào danh sách ước. */
  addedAt?: number;

  /** Mua tặng người khác thay vì cho tài khoản của mình. */
  forGift: boolean;
}

export type WishlistItem = CartItem;

interface WishlistEntry {
  id: string;
  addedAt: number;
}

interface CartEntry {
  id: string;
  forGift: boolean;
}

export interface LibraryEntry {
  id: string;
  purchasedAt: number;

  /** Số tiền thực trả. */
  paidPrice: number;

  orderId: string | null;

  giftFrom?: string;
}

export interface OrderItem {
  gameId: string;
  title: string;
  price: number;
  forGift: boolean;
}

export interface OrderRecord {
  id: string;
  createdAt: number;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  method: string;
  couponCode: string;
  giftRecipient: string;
}

export interface GiftTarget {
  label: string;

  /** Scope của tài khoản STEAL nhận quà. */
  accountScope?: string;

  message: string;
  senderName: string;
}

export interface RefundCheck {
  ok: boolean;
  reason: string;
}
export interface CouponCheck {
  ok: boolean;
  message: string;
  phanTramGiamGia?: number;
  soTienGiam?: number;
  tongTienGoc?: number;
  tongTienSauGiam?: number;
}
export const REFUND_MAX_HOURS = 2;
export const REFUND_MAX_DAYS = 14;

const KEY_CART = 'steal_cart';
const KEY_WISHLIST = 'steal_wishlist';
const KEY_LIBRARY = 'steal_library';
const KEY_ORDERS = 'steal_orders';

const DAY = 24 * 60 * 60 * 1000;

const SAMPLE_CART: CartEntry[] = [
  { id: 'gta-v', forGift: false },
  { id: 'witcher-3', forGift: false }
];

const SAMPLE_WISHLIST_IDS = [
  'cyberpunk-2077',
  'black-myth-wukong'
];

const sampleWishlist = (): WishlistEntry[] =>
  SAMPLE_WISHLIST_IDS.map((id, i) => ({
    id,
    addedAt: Date.now() - (i + 1) * DAY
  }));

function sampleLibrary(catalog: GameCatalogService): LibraryEntry[] {
  const now = Date.now();

  const make = (
    id: string,
    daysAgo: number
  ): LibraryEntry => ({
    id,
    purchasedAt: now - daysAgo * DAY,
    paidPrice: catalog.getById(id)?.finalPrice ?? 0,
    orderId: null
  });

  return [
    make('dead-by-daylight', 20),
    make('outlast', 3),
    make('phasmophobia', 40)
  ];
}

/**
 * Giỏ hàng, danh sách ước, thư viện đã sở hữu và lịch sử đơn hàng
 * của tài khoản hiện tại.
 *
 * Cart / Wishlist / Orders vẫn lưu localStorage.
 * Library của tài khoản thật được đồng bộ từ backend MongoDB.
 *
 * Chỉ lưu id; tên/giá/ảnh luôn lấy từ GameCatalogService.
 */
@Injectable({ providedIn: 'root' })
export class CartWishlistService {

  private cartEntries: CartEntry[] = [];
  private wishlistEntries: WishlistEntry[] = [];
  private libraryEntries: LibraryEntry[] = [];

  cartItems: CartItem[] = [];
  wishlistItems: WishlistItem[] = [];
  libraryGames: Game[] = [];
  orders: OrderRecord[] = [];

  /**
   * Đang tải Library từ backend.
   */
  loadingLibrary = false;

  constructor(
    private catalog: GameCatalogService,
    private auth: AuthService,
    private toast: ToastService,
    private notifications: NotificationService,
    private stats: LibraryStatsService,
    private http: HttpClient
  ) {
    console.log('CartWishlistService ĐÃ KHỞI TẠO');

    auth.scope$.subscribe(() => {
      console.log('AUTH SCOPE THAY ĐỔI → RELOAD CART/LIBRARY');
      this.reload();
    });
  }

  /* ===================== Truy vấn ===================== */

  get cartTotalPrice(): number {
    return this.cartItems.reduce(
      (sum, item) => sum + item.price,
      0
    );
  }
  
/**
 * Lấy mã game gửi lên backend để kiểm tra mã khuyến mãi.
 * Bao gồm cả game mua và game tặng.
 */
getCouponItems(): {
  maGame: string;
  laQua: boolean;
}[] {
  return this.cartItems
    .map(item => {
      const game = this.catalog.getById(item.id);

      if (!game) {
        return null;
      }

      return {
        maGame: game.code,
        laQua: item.forGift
      };
    })
    .filter(
      (
        item
      ): item is {
        maGame: string;
        laQua: boolean;
      } => item !== null
    );
}

  get giftItems(): CartItem[] {
    return this.cartItems.filter(i => i.forGift);
  }

  get hasGiftItems(): boolean {
    return this.cartItems.some(i => i.forGift);
  }

  isInCart(id: string): boolean {
    return this.cartEntries.some(e => e.id === id);
  }

  isInWishlist(id: string): boolean {
    return this.wishlistEntries.some(e => e.id === id);
  }

  isOwned(id: string): boolean {
    return this.libraryEntries.some(e => e.id === id);
  }

  getLibraryEntry(id: string): LibraryEntry | undefined {
    return this.libraryEntries.find(e => e.id === id);
  }
/**
 * Kiểm tra mã khuyến mãi bằng Backend.
 * Áp dụng cho toàn bộ game trong giỏ hàng,
 * bao gồm cả game mua và game tặng.
 */
async checkCoupon(maKhuyenMai: string): Promise<CouponCheck> {
  if (!this.auth.isLoggedIn) {
    return {
      ok: false,
      message: 'Vui lòng đăng nhập để sử dụng mã khuyến mãi.'
    };
  }

  if (!maKhuyenMai.trim()) {
    return {
      ok: false,
      message: 'Vui lòng nhập mã khuyến mãi.'
    };
  }

  const items = this.getCouponItems();

  if (items.length === 0) {
    return {
      ok: false,
      message: 'Giỏ hàng chưa có sản phẩm.'
    };
  }

  try {
    const response = await firstValueFrom(
      this.http.post<any>(
        CHECK_COUPON_API_URL,
        {
          maKhuyenMai: maKhuyenMai.trim().toUpperCase(),
          items
        }
      )
    );

    if (!response || !response.success) {
      return {
        ok: false,
        message: response?.message || 'Mã khuyến mãi không hợp lệ.'
      };
    }

    return {
      ok: true,
      message: response.message || 'Áp dụng mã khuyến mãi thành công.',
      phanTramGiamGia: response.data?.phanTramGiamGia,
      soTienGiam: response.data?.soTienGiam,
      tongTienGoc: response.data?.tongTienGoc,
      tongTienSauGiam: response.data?.tongTienSauGiam
    };

  } catch (error: any) {
    console.error('Lỗi kiểm tra mã khuyến mãi:', error);

    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể kết nối Backend để kiểm tra mã khuyến mãi.'
    };
  }
}
  /* ===================== Danh sách ước ===================== */

  addToWishlist(game: Game): boolean {
    if (!this.requireLogin('thêm vào danh sách ước')) {
      return false;
    }

    if (this.isOwned(game.id)) {
      this.toast.warning(
        `Bạn đã sở hữu "${game.title}" trong thư viện.`
      );
      return false;
    }

    if (this.isInWishlist(game.id)) {
      this.toast.warning(
        `"${game.title}" đã có trong danh sách ước của bạn!`
      );
      return false;
    }

    this.wishlistEntries = [
      ...this.wishlistEntries,
      {
        id: game.id,
        addedAt: Date.now()
      }
    ];

    this.commit();

    this.toast.success(
      `Đã thêm "${game.title}" vào danh sách ước!`
    );

    return true;
  }

  removeFromWishlist(id: string): void {
    this.wishlistEntries =
      this.wishlistEntries.filter(e => e.id !== id);

    this.commit();
  }


  /* ===================== Giỏ hàng ===================== */

  addToCart(game: Game, forGift: boolean = false): boolean {
    if (!this.requireLogin('thêm vào giỏ hàng')) {
      return false;
    }

    // NẾU MUA CHO BẢN THÂN: Chặn nếu đã sở hữu
    // NẾU MUA TẶNG BẠN BÈ: Vẫn cho phép mua dù bạn đã sở hữu game này
    if (!forGift && this.isOwned(game.id)) {
      this.toast.warning(
        `Bạn đã sở hữu "${game.title}". Mỗi game chỉ mua tối đa 1 bản cho bản thân.`
      );
      return false;
    }

    if (this.isInCart(game.id)) {
      this.toast.warning(
        `"${game.title}" đã có trong giỏ hàng!`
      );
      return false;
    }

    if (!forGift && game.isFree) {
      this.addToLibrary(game, 0, null);
      this.toast.success(
        `Đã thêm "${game.title}" (miễn phí) vào Thư viện!`
      );
      return true;
    }

    this.cartEntries = [
      ...this.cartEntries,
      {
        id: game.id,
        forGift: forGift
      }
    ];

    this.commit();

    this.toast.success(
      forGift
        ? `Đã thêm "${game.title}" vào giỏ hàng dưới dạng quà tặng!`
        : `Đã thêm "${game.title}" vào giỏ hàng!`
    );

    return true;
  }

  removeFromCart(id: string): void {
    this.cartEntries =
      this.cartEntries.filter(e => e.id !== id);

    this.commit();
  }

  setCartItemGift(
    id: string,
    forGift: boolean
  ): void {
    this.cartEntries = this.cartEntries.map(e =>
      e.id === id
        ? { ...e, forGift }
        : e
    );

    this.commit();
  }

  /* ===================== Thanh toán ===================== */

  /**
   * Hoàn tất đơn hàng SAU KHI thanh toán thành công.
   *
   * Với game mua cho chính tài khoản:
   * - Gọi POST /api/store/orders/purchase
   * - Backend tạo Order
   * - Backend thêm game vào User.danhSachGameDaMua
   * - Sau đó reload Library từ MongoDB
   *
   * Game tặng chưa được gửi qua backend ở phiên bản này.
   */

async completeOrder(
  info: {
    method: string;
    couponCode: string;
    discount: number;
    gift: GiftTarget | null;
    orderId?: string;
  }
): Promise<OrderRecord | null> {

  if (
    !this.auth.isLoggedIn ||
    this.cartItems.length === 0
  ) {
    return null;
  }

  // Chụp danh sách game trước khi xử lý.
  const items = [...this.cartItems];

  // Kiểm tra có game tặng hay không.
  const hasGift = items.some(item => item.forGift);

  if (hasGift) {
    if (!info.gift || !info.gift.label.trim()) {
      this.toast.warning(
        'Vui lòng nhập tài khoản hoặc email người nhận quà.'
      );

      return null;
    }
  }

  // Chuẩn bị dữ liệu gửi backend.
  const backendItems = [];

  for (const item of items) {
    const game = this.catalog.getById(item.id);

    if (!game) {
      this.toast.warning(
        `Không tìm thấy dữ liệu game "${item.title}".`
      );

      return null;
    }

    backendItems.push({
      maGame: game.code,
      laQua: item.forGift,

      nguoiNhan: item.forGift
        ? info.gift?.label.trim() || ''
        : '',

      loiNhan: item.forGift
        ? info.gift?.message || ''
        : ''
    });
  }

  try {
    console.log('===== BẮT ĐẦU THANH TOÁN GIỎ HÀNG =====');

    console.log('Danh sách game:', backendItems);

    console.log('Mã khuyến mãi:', info.couponCode);

    // Gọi DUY NHẤT một API thanh toán.
    const response = await firstValueFrom(
      this.http.post<BackendCheckoutResponse>(
        CHECKOUT_API_URL,
        {
          items: backendItems,
          phuongThucThanhToan: info.method,
          maKhuyenMai: info.couponCode.trim().toUpperCase()
        }
      )
    );

    console.log('CHECKOUT API RESULT:', response);

    if (
      !response ||
      !response.success ||
      !response.data
    ) {
      this.toast.warning(
        response?.message || 'Không thể thanh toán giỏ hàng.'
      );

      return null;
    }

    const backendOrder = response.data;

    // Chỉ sử dụng số tiền do backend trả về.
    const subtotal = Number(backendOrder.tongTienGoc);
    const discount = Number(backendOrder.soTienGiam);
    const total = Number(backendOrder.tongTien);

    // Tạo lịch sử đơn hàng phía frontend.
    const completedItems: OrderItem[] = items.map(item => ({
      gameId: item.id,
      title: item.title,
      price: item.price,
      forGift: item.forGift
    }));

    const order: OrderRecord = {
      id: backendOrder.maDonHang,
      createdAt: backendOrder.createdAt
        ? new Date(backendOrder.createdAt).getTime()
        : Date.now(),

      items: completedItems,

      subtotal,
      discount,
      total,

      method: backendOrder.phuongThucThanhToan,

      couponCode: backendOrder.maKhuyenMai || '',

      giftRecipient: info.gift?.label || ''
    };

    // Thêm các game mua cho bản thân vào Library local.
    for (const item of completedItems) {
      if (item.forGift) {
        continue;
      }

      const existed = this.libraryEntries.some(
        entry => entry.id === item.gameId
      );

      if (!existed) {
        this.libraryEntries.push({
          id: item.gameId,
          purchasedAt: Date.now(),
          paidPrice: item.price,
          orderId: backendOrder.maDonHang
        });
      }
    }

    // Xóa các game đã mua khỏi Wishlist.
    const completedIds = completedItems.map(
      item => item.gameId
    );

    this.wishlistEntries = this.wishlistEntries.filter(
      entry => !completedIds.includes(entry.id)
    );

    // Xóa toàn bộ giỏ hàng sau khi backend xác nhận thành công.
    this.cartEntries = [];
    this.cartItems = [];

    saveJson(KEY_CART, []);

    // Cập nhật lịch sử đơn hàng.
    this.orders = [
      order,
      ...this.orders
    ];

    // Lưu dữ liệu local.
    saveJson(KEY_LIBRARY, this.libraryEntries);
    saveJson(KEY_WISHLIST, this.wishlistEntries);
    saveJson(KEY_ORDERS, this.orders);

    this.refresh();

    // Đồng bộ Library với MongoDB.
    await this.loadLibraryFromBackend();

    // Phân loại số game mua và game tặng.
    const giftCount = completedItems.filter(
      item => item.forGift
    ).length;

    const purchaseCount = completedItems.length - giftCount;

    // Thông báo kết quả.
    if (giftCount > 0 && purchaseCount === 0) {
      this.notifications.push(
        'purchase',
        'TẶNG QUÀ THÀNH CÔNG 🎁',
        `Đã tặng ${giftCount} game cho ${info.gift?.label || 'người nhận'}.`,
        '🎁'
      );

      this.toast.success('Tặng quà thành công! 🎁');

    } else if (giftCount > 0) {
      this.notifications.push(
        'purchase',
        'ĐƠN HÀNG HOÀN TẤT',
        `Đơn hàng #${order.id}: ${purchaseCount} game mua và ${giftCount} game tặng.`,
        '🧾'
      );

      this.toast.success(
        'Thanh toán thành công! Game mua và game tặng đã được xử lý.'
      );

    } else {
      this.notifications.push(
        'purchase',
        'ĐƠN HÀNG HOÀN TẤT',
        `Đơn hàng #${order.id}: ${completedItems.length} game (${total.toLocaleString('vi-VN')}đ).`,
        '🧾'
      );

      this.toast.success(
        'Thanh toán thành công! Game đã được thêm vào Thư viện.'
      );
    }

    console.log('===== THANH TOÁN THÀNH CÔNG =====');
    console.log('Mã đơn:', order.id);
    console.log('Tiền gốc:', subtotal);
    console.log('Tiền giảm:', discount);
    console.log('Thành tiền:', total);

    return order;

  } catch (error: any) {
    console.error('Lỗi thanh toán giỏ hàng:', error);

    const message =
      error?.error?.message ||
      error?.message ||
      'Không thể kết nối Backend để thanh toán.';

    this.toast.warning(message);

    return null;
  }
}


  /* ===================== Thư viện & hoàn tiền ===================== */

  /**
   * Đồng bộ Library của tài khoản hiện tại từ backend.
   *
   * Backend:
   * GET /api/store/library/me
   *
   * Auth interceptor sẽ tự thêm:
   * Authorization: Bearer <token>
   */
  private async loadLibraryFromBackend(): Promise<void> {

    if (!this.auth.isLoggedIn) {
      return;
    }

    this.loadingLibrary = true;

    try {

      console.log(
        'Đang tải Library từ backend...'
      );

      const response =
        await firstValueFrom(
          this.http.get<BackendLibraryResponse>(
            LIBRARY_API_URL
          )
        );

      if (
        !response ||
        !response.success ||
        !Array.isArray(response.data)
      ) {
        console.warn(
          'Library API không trả dữ liệu hợp lệ.'
        );

        return;
      }

      /**
       * Giữ lại thông tin cũ nếu localStorage
       * đã từng có entry của game đó.
       */
      const oldEntries =
        new Map(
          this.libraryEntries.map(
            entry => [entry.id, entry]
          )
        );

      const backendEntries: LibraryEntry[] =
        response.data
          .map(rawGame => {

            const id =
              rawGame.duongDanSlug;

            const oldEntry =
              oldEntries.get(id);

            const catalogGame =
              this.catalog.getById(id);

            return {
              id,

              purchasedAt:
                oldEntry?.purchasedAt ??
                Date.now(),

              paidPrice:
                oldEntry?.paidPrice ??
                catalogGame?.finalPrice ??
                rawGame.giaHienTai ??
                0,

              orderId:
                oldEntry?.orderId ??
                null,

              giftFrom:
                oldEntry?.giftFrom
            };
          })
          .filter(
            entry =>
              !!entry.id &&
              !!this.catalog.getById(entry.id)
          );

      this.libraryEntries =
        this.removeDuplicateLibraryEntries(
          backendEntries
        );

      saveJson(
        KEY_LIBRARY,
        this.libraryEntries
      );

      this.sanitize();

      this.refresh();

      this.sanitize();

      this.refresh();

      console.log(
        `Library: đã tải ${this.libraryEntries.length} game từ backend.`
      );

      console.log(
        'LIBRARY BACKEND:',
        response.data
      );

      console.log(
        'LIBRARY FRONTEND:',
        this.libraryEntries
      );

    } catch (error: any) {

      console.error(
        'Không thể tải Library từ backend.',
        error
      );

      this.sanitize();
      this.refresh();

    } finally {

      this.loadingLibrary = false;
    }
  }

  /**
   * Xóa game Library bị trùng.
   */
  private removeDuplicateLibraryEntries(
    entries: LibraryEntry[]
  ): LibraryEntry[] {

    const seen = new Set<string>();

    return entries.filter(entry => {

      if (seen.has(entry.id)) {
        return false;
      }

      seen.add(entry.id);

      return true;
    });
  }

  /** Điều kiện hoàn tiền. */
  refundCheck(gameId: string): RefundCheck {

    const entry =
      this.getLibraryEntry(gameId);

    if (!entry) {
      return {
        ok: false,
        reason: 'Bạn không sở hữu trò chơi này.'
      };
    }

    if (entry.giftFrom) {
      return {
        ok: false,
        reason: 'Game được tặng không thể hoàn tiền.'
      };
    }

    if (entry.paidPrice <= 0) {
      return {
        ok: false,
        reason:
          'Game miễn phí không có khoản thanh toán để hoàn.'
      };
    }

    if (
      Date.now() - entry.purchasedAt >
      REFUND_MAX_DAYS * DAY
    ) {
      return {
        ok: false,
        reason:
          `Đã quá ${REFUND_MAX_DAYS} ngày kể từ ngày mua.`
      };
    }

    if (
      this.stats.hoursPlayed(gameId) >
      REFUND_MAX_HOURS
    ) {
      return {
        ok: false,
        reason:
          `Đã chơi quá ${REFUND_MAX_HOURS} giờ.`
      };
    }

    return {
      ok: true,
      reason: ''
    };
  }

  refund(
    gameId: string,
    reason = ''
  ): {
    ok: boolean;
    message: string;
  } {

    const check =
      this.refundCheck(gameId);

    const entry =
      this.getLibraryEntry(gameId);

    const game =
      this.catalog.getById(gameId);

    if (
      !check.ok ||
      !entry ||
      !game
    ) {
      return {
        ok: false,
        message:
          check.reason ||
          'Không thể hoàn tiền.'
      };
    }

    this.libraryEntries =
      this.libraryEntries.filter(
        e => e.id !== gameId
      );

    this.stats.remove(gameId);

    this.commit();

    const amount =
      entry.paidPrice.toLocaleString('vi-VN');

    const why =
      reason
        ? ` Lý do: ${reason}.`
        : '';

    this.notifications.push(
      'purchase',
      'HOÀN TIỀN THÀNH CÔNG',
      `Đã hoàn ${amount}đ cho "${game.title}" về phương thức thanh toán ban đầu.${why}`,
      '↩️'
    );

    return {
      ok: true,
      message:
        `Đã hoàn tiền ${amount}đ cho "${game.title}"!`
    };
  }
  
  /**
 * Gửi yêu cầu hoàn tiền lên Backend.
 *
 * Game vẫn được giữ trong Library cho đến khi Admin duyệt.
 */
async requestRefund(
  gameId: string,
  reason = ''
): Promise<{
  ok: boolean;
  message: string;
}> {

  // Kiểm tra đăng nhập
  if (!this.auth.isLoggedIn) {
    this.auth.requestLogin();

    return {
      ok: false,
      message: 'Vui lòng đăng nhập để gửi yêu cầu hoàn tiền.'
    };
  }

  // Kiểm tra điều kiện hoàn tiền ở Frontend
  const check = this.refundCheck(gameId);

  if (!check.ok) {
    return {
      ok: false,
      message: check.reason
    };
  }

  // Lấy thông tin game
  const game = this.catalog.getById(gameId);

  if (!game) {
    return {
      ok: false,
      message: 'Không tìm thấy thông tin game.'
    };
  }

  try {
    // Gửi yêu cầu lên Backend
    const response = await firstValueFrom(
      this.http.post<BackendRefundResponse>(
        REFUND_REQUEST_API_URL,
        {
          maGame: game.code,
          lyDoKhachHang: reason,
          soGioDaChoi: this.stats.hoursPlayed(gameId)
        }
      )
    );

    if (!response || !response.success) {
      return {
        ok: false,
        message: response?.message || 'Không thể gửi yêu cầu hoàn tiền.'
      };
    }

    // Thông báo yêu cầu đã được ghi nhận
    this.notifications.push(
      'purchase',
      'ĐÃ GỬI YÊU CẦU HOÀN TIỀN',
      `Yêu cầu hoàn tiền cho "${game.title}" đang chờ Admin xử lý.`,
      '↩️'
    );

    return {
      ok: true,
      message: response.message ||
        'Gửi yêu cầu hoàn tiền thành công. Vui lòng chờ Admin xử lý.'
    };

  } catch (error: any) {
    console.error('Lỗi gửi yêu cầu hoàn tiền:', error);

    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể kết nối Backend để gửi yêu cầu hoàn tiền.'
    };
  }
}

  /* ===================== Đặt lại / dữ liệu mẫu ===================== */

/**
 * Xóa toàn bộ giỏ hàng sau khi thanh toán thành công.
 */
clearCart(): void {
  this.cartEntries = [];
  this.cartItems = [];

  // Ghi giỏ hàng rỗng vào localStorage của tài khoản hiện tại.
  saveJson(KEY_CART, []);

  // Cập nhật lại các dữ liệu hiển thị.
  this.refresh();

  console.log('ĐÃ XÓA GIỎ HÀNG SAU THANH TOÁN');
  console.log('cartEntries:', this.cartEntries);
  console.log('cartItems:', this.cartItems);
}
reset(): void {
  this.cartEntries = [];
  this.wishlistEntries = [];
  this.libraryEntries = [];
  this.cartItems = [];
  this.wishlistItems = [];
  this.libraryGames = [];
  this.orders = [];

  saveJson(KEY_CART, []);
  saveJson(KEY_WISHLIST, []);
  saveJson(KEY_LIBRARY, []);
  saveJson(KEY_ORDERS, []);

  this.refresh();

  console.log('ĐÃ RESET DỮ LIỆU TÀI KHOẢN');
  console.log('cartEntries:', this.cartEntries);
  console.log('wishlistEntries:', this.wishlistEntries);
  console.log('libraryEntries:', this.libraryEntries);
  console.log('orders:', this.orders);
}
  loadSample(): void {

    this.cartEntries =
      SAMPLE_CART.map(e => ({
        ...e
      }));

    this.wishlistEntries =
      sampleWishlist();

    this.libraryEntries =
      sampleLibrary(this.catalog);

    this.orders = [];

    this.commit();
  }

  /* ===================== Nội bộ ===================== */

  /** Yêu cầu đăng nhập. */
  private requireLogin(action: string): boolean {

    if (this.auth.isLoggedIn) {
      return true;
    }

    this.toast.warning(
      `Vui lòng đăng nhập để ${action}!`
    );

    this.auth.requestLogin();

    return false;
  }

  private addToLibrary(
    game: Game,
    paid: number,
    orderId: string | null,
    giftFrom?: string
  ): void {

    this.libraryEntries = [
      ...this.libraryEntries,
      {
        id: game.id,
        purchasedAt: Date.now(),
        paidPrice: paid,
        orderId,
        giftFrom
      }
    ];

    this.wishlistEntries =
      this.wishlistEntries.filter(
        e => e.id !== game.id
      );

    this.cartEntries =
      this.cartEntries.filter(
        e => e.id !== game.id
      );

    this.commit();
  }

  /** Giao quà vẫn giữ logic local hiện tại. */
  private deliverGift(
    game: Game,
    orderId: string,
    gift: GiftTarget
  ): void {

    const scope =
      gift.accountScope;

    if (!scope) {
      return;
    }

    const stored =
      loadJsonFor<LibraryEntry[] | null>(
        scope,
        KEY_LIBRARY,
        null
      );

    const library =
      stored ??
      (
        this.auth.isDemoScope(scope)
          ? sampleLibrary(this.catalog)
          : []
      );

    if (
      library.some(
        e => e.id === game.id
      )
    ) {
      return;
    }

    library.push({
      id: game.id,
      purchasedAt: Date.now(),
      paidPrice: 0,
      orderId,
      giftFrom: gift.senderName
    });

    saveJsonFor(
      scope,
      KEY_LIBRARY,
      library
    );

    const notes =
      loadJsonFor<NotificationItem[]>(
        scope,
        'steal_notifications',
        []
      );

    const nextId =
      notes.reduce(
        (max, n) =>
          Math.max(max, Number(n.id) || 0),
        0
      ) + 1;

    const message =
      gift.message
        ? ` Lời nhắn: "${gift.message}"`
        : '';

    notes.unshift({
      id: nextId,
      title: 'BẠN NHẬN ĐƯỢC MỘT MÓN QUÀ',
      icon: '🎁',
      category: 'purchase',
      createdAt: Date.now(),
      desc:
        `${gift.senderName} đã tặng bạn "${game.title}".${message}`,
      isRead: false,
      selected: false
    });

    saveJsonFor(
      scope,
      'steal_notifications',
      notes
    );
  }

  /**
   * Load dữ liệu khi tài khoản thay đổi.
   */
  private async reload(): Promise<void> {

    if (!this.auth.isLoggedIn) {

      this.cartEntries = [];
      this.wishlistEntries = [];
      this.libraryEntries = [];
      this.orders = [];

      this.refresh();

      return;
    }

    const demo =
      this.auth.isDemoAccount;

    /**
     * Cart vẫn dùng localStorage.
     */
    this.cartEntries =
      loadJson<CartEntry[] | null>(
        KEY_CART,
        null
      ) ??
      (
        demo
          ? SAMPLE_CART.map(e => ({ ...e }))
          : []
      );

    /**
     * Wishlist vẫn dùng localStorage.
     */
    const storedWishlist =
      loadJson<(WishlistEntry | string)[] | null>(
        KEY_WISHLIST,
        null
      );

    this.wishlistEntries =
      storedWishlist
        ? storedWishlist.map(
            e =>
              typeof e === 'string'
                ? {
                    id: e,
                    addedAt: Date.now()
                  }
                : e
          )
        : (
            demo
              ? sampleWishlist()
              : []
          );

    /**
     * Library:
     *
     * - Demo account → sample/localStorage
     * - Tài khoản thật → lấy từ MongoDB
     */
    if (demo) {

      this.libraryEntries =
        loadJson<LibraryEntry[] | null>(
          KEY_LIBRARY,
          null
        ) ??
        sampleLibrary(this.catalog);

    } else {

      this.libraryEntries =
        loadJson<LibraryEntry[] | null>(
          KEY_LIBRARY,
          null
        ) ?? [];
    }

    /**
     * Orders hiện vẫn localStorage.
     */
    this.orders =
      loadJson<OrderRecord[]>(
        KEY_ORDERS,
        []
      );

    this.sanitize();
    this.refresh();

    /**
     * Tài khoản thật → đồng bộ Library từ MongoDB.
     */
    if (!demo) {
      await this.loadLibraryFromBackend();
    }
  }

  /** Loại bỏ id không còn trong catalog và xử lý xung đột. */
  private sanitize(): void {

    const valid =
      (id: string) =>
        !!this.catalog.getById(id);

    const seen =
      new Set<string>();

    this.libraryEntries =
      this.libraryEntries.filter(
        e =>
          valid(e.id) &&
          !seen.has(e.id) &&
          !!seen.add(e.id)
      );

    const owned =
      (id: string) =>
        this.libraryEntries.some(
          e => e.id === id
        );

    const cartSeen =
      new Set<string>();

    this.cartEntries =
      this.cartEntries.filter(
        e =>
          valid(e.id) &&
          !owned(e.id) &&
          !cartSeen.has(e.id) &&
          !!cartSeen.add(e.id)
      );

    const wishSeen =
      new Set<string>();

    this.wishlistEntries =
      this.wishlistEntries.filter(
        e =>
          valid(e.id) &&
          !owned(e.id) &&
          !wishSeen.has(e.id) &&
          !!wishSeen.add(e.id)
      );
  }

  private commit(): void {

    this.refresh();

    saveJson(
      KEY_CART,
      this.cartEntries
    );

    saveJson(
      KEY_WISHLIST,
      this.wishlistEntries
    );

    saveJson(
      KEY_LIBRARY,
      this.libraryEntries
    );

    saveJson(
      KEY_ORDERS,
      this.orders
    );
  }

  private refresh(): void {

    const toItem = (
      g: Game,
      forGift: boolean
    ): CartItem => ({
      id: g.id,
      title: g.title,
      price: g.finalPrice,
      originalPrice: g.originalPrice,
      discountPercent: g.discountPercent,
      thumb: g.coverImage,
      forGift
    });

    const game =
      (id: string) =>
        this.catalog.getById(id);

    this.cartItems =
      this.cartEntries
        .map(e => ({
          g: game(e.id),
          forGift: e.forGift
        }))
        .filter(
          (
            x
          ): x is {
            g: Game;
            forGift: boolean;
          } => !!x.g
        )
        .map(
          x =>
            toItem(
              x.g,
              x.forGift
            )
        );

    this.wishlistItems =
      this.wishlistEntries
        .map(e => ({
          g: game(e.id),
          addedAt: e.addedAt
        }))
        .filter(
          (
            x
          ): x is {
            g: Game;
            addedAt: number;
          } => !!x.g
        )
        .map(
          x => ({
            ...toItem(
              x.g,
              false
            ),
            addedAt: x.addedAt
          })
        );

    this.libraryGames =
      this.libraryEntries
        .map(e => game(e.id))
        .filter(
          (g): g is Game => !!g
        );
  }
}