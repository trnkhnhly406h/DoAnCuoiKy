import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';
import { loadJson, removeKey, saveJson } from './storage';

export type NotificationCategory =
  | 'wishlistSale' | 'purchase' | 'news' | 'friend' | 'gameUpdate' | 'security' | 'system';

export interface NotificationItem {
  id: number | string;
  backendId?: string;
  title: string;
  desc: string;
  icon: string;
  category: NotificationCategory;
  createdAt: number;
  isRead: boolean;
  selected: boolean;
}

export interface NotificationPrefs {
  wishlistSale: boolean;
  purchase: boolean;
  news: boolean;
  friend: boolean;
  gameUpdate: boolean;
}

const KEY_ITEMS = 'steal_notifications';
const KEY_PREFS = 'steal_notification_prefs';
const MAX_ITEMS = 50;
const NOTIFICATION_API_URL = 'http://localhost:3000/api/store/notifications';
const HOUR = 60 * 60 * 1000;

function defaultPrefs(): NotificationPrefs {
  return { wishlistSale: true, purchase: true, news: false, friend: true, gameUpdate: true };
}

/** Thông báo trong ứng dụng, được tạo từ hành động thật (mua hàng, kết bạn, bảo mật...). */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  prefs: NotificationPrefs = defaultPrefs();
  items: NotificationItem[] = [];
  private seq = 0;

  constructor(private auth: AuthService, private http: HttpClient) {
    auth.scope$.subscribe(() => this.reload());
  }

  /** Tải thông báo của tài khoản hiện tại (khách: không có thông báo). */
  private reload(): void {
    this.prefs = { ...defaultPrefs(), ...loadJson<Partial<NotificationPrefs>>(KEY_PREFS, {}) };
    if (!this.auth.isLoggedIn) {
      this.items = [];
    } else {
      this.items = loadJson<NotificationItem[] | null>(KEY_ITEMS, null) ?? (this.auth.isDemoAccount ? this.seed() : this.welcome());
    }
    this.seq = this.items.reduce((max, n) =>
      typeof n.id === 'number' ? Math.max(max, n.id) : max, 0);
  }

  /** Tải thông báo được lưu trên Backend cho tài khoản hiện tại. */
  async refreshFromServer(): Promise<void> {
    if (!this.auth.isLoggedIn) return;

    try {
      const response = await firstValueFrom(
        this.http.get<{
          success: boolean;
          data?: Array<{
            _id: string;
            title: string;
            desc: string;
            icon?: string;
            createdAt: string;
            isRead: boolean;
            category?: string;
          }>;
        }>(`${NOTIFICATION_API_URL}/me`)
      );

      if (!response.success) return;

      const localItems = this.items.filter(item => !item.backendId);
      const serverItems: NotificationItem[] = (response.data ?? []).map(item => ({
        id: `server-${item._id}`,
        backendId: item._id,
        title: item.title,
        desc: item.desc,
        icon: item.icon || '🔔',

category:
  item.category === 'promo'
    ? 'news'
    : item.category === 'order'
      ? 'purchase'
      : 'system',
        createdAt: new Date(item.createdAt).getTime(),
        isRead: item.isRead,
        selected: false
      }));

      this.items = [...serverItems, ...localItems]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_ITEMS);
    } catch (error) {
      // Không làm mất các thông báo local nếu Backend tạm thời không kết nối.
      console.error('Lỗi tải thông báo từ Backend:', error);
    }
  }

  private welcome(): NotificationItem[] {
    return [{ id: 1, title: 'CHÀO MỪNG ĐẾN STEAL', desc: 'Cảm ơn bạn đã tham gia nền tảng STEAL Store!', icon: '👋', category: 'system', createdAt: Date.now(), isRead: false, selected: false }];
  }

  private seed(): NotificationItem[] {
    const now = Date.now();
    return [
      { id: 4, title: 'ƯU ĐÃI CUỐI TUẦN', desc: 'Hàng trăm game đang giảm giá, xem ngay mục Ưu đãi!', icon: '🏷️', category: 'news', createdAt: now - 3 * HOUR, isRead: false, selected: false },
      { id: 3, title: 'BẢN CẬP NHẬT MỚI', desc: 'Black Myth: Wukong vừa có bản vá mới.', icon: '🛠️', category: 'gameUpdate', createdAt: now - 26 * HOUR, isRead: false, selected: false },
      { id: 2, title: 'GAME MỚI RA MẮT', desc: 'Nhiều tựa game mới vừa lên kệ STEAL Store.', icon: '🎮', category: 'news', createdAt: now - 50 * HOUR, isRead: true, selected: false },
      { id: 1, title: 'CHÀO MỪNG ĐẾN STEAL', desc: 'Cảm ơn bạn đã tham gia nền tảng STEAL Store!', icon: '👋', category: 'system', createdAt: now - 72 * HOUR, isRead: true, selected: false }
    ];
  }

  get unreadCount(): number {
    return this.items.filter(n => !n.isRead).length;
  }

  get selectedCount(): number {
    return this.items.filter(n => n.selected).length;
  }

  get isAllSelected(): boolean {
    return this.items.length > 0 && this.items.every(n => n.selected);
  }

  /**
   * Thêm thông báo mới. Trả về false nếu người dùng đã tắt loại thông báo này.
   * Cảnh báo bảo mật và thông báo hệ thống luôn được gửi.
   */
  push(category: NotificationCategory, title: string, desc: string, icon = '🔔'): boolean {
    if (!this.auth.isLoggedIn) return false;
    if (category !== 'security' && category !== 'system' && !this.prefs[category]) return false;
    const item: NotificationItem = {
      id: ++this.seq, title, desc, icon, category, createdAt: Date.now(), isRead: false, selected: false
    };
    this.items = [item, ...this.items].slice(0, MAX_ITEMS);
    this.persist();
    return true;
  }

  markRead(item: NotificationItem): void {
    if (!item.isRead) {
      item.isRead = true;
      this.persist();

      if (item.backendId) {
        this.http.patch(`${NOTIFICATION_API_URL}/${item.backendId}/read`, { isRead: true })
          .subscribe({
            error: error => console.error('Lỗi đánh dấu thông báo đã đọc:', error)
          });
      }
    }
  }

  toggleSelected(item: NotificationItem): void {
    item.selected = !item.selected;
  }

  toggleSelectAll(): void {
    const target = !this.isAllSelected;
    this.items.forEach(n => (n.selected = target));
  }

  setSelectedRead(read: boolean): void {
    this.items.forEach(n => {
      if (n.selected) {
        n.isRead = read;
        if (n.backendId) {
          this.http.patch(`${NOTIFICATION_API_URL}/${n.backendId}/read`, { isRead: read })
            .subscribe({ error: error => console.error('Lỗi cập nhật thông báo:', error) });
        }
      }
    });
    this.persist();
  }

  deleteSelected(): void {
    const selected = this.items.filter(n => n.selected);
    selected.forEach(item => {
      if (item.backendId) {
        this.http.delete(`${NOTIFICATION_API_URL}/${item.backendId}`)
          .subscribe({ error: error => console.error('Lỗi xóa thông báo:', error) });
      }
    });
    this.items = this.items.filter(n => !n.selected);
    this.persist();
  }

  savePrefs(next: NotificationPrefs): void {
    this.prefs = { ...next };
    saveJson(KEY_PREFS, this.prefs);
  }

  reset(): void {
    this.items = [];
    this.prefs = defaultPrefs();
    saveJson(KEY_ITEMS, []); // lưu mảng rỗng để lần tải sau không nạp lại dữ liệu mẫu
    removeKey(KEY_PREFS);
  }

  restoreSample(): void {
    this.items = this.seed();
    this.seq = this.items.reduce((max, n) =>
      typeof n.id === 'number' ? Math.max(max, n.id) : max, 0);
    this.persist();
  }

  private persist(): void {
    saveJson(KEY_ITEMS, this.items.filter(item => !item.backendId));
  }
}
