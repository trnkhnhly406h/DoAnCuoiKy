import { Component } from '@angular/core';
import { AuthService } from '../../services/auth';
import { CookieSettings, PreferencesService } from '../../services/preferences';
import { ToastService } from '../../services/toast';

/** Trang Cookie: dùng chung cài đặt với mục "Dữ liệu và duyệt web" trong Cài đặt tài khoản. */
@Component({
  selector: 'app-cookie',
  templateUrl: './cookie.html',
  styleUrls: ['./cookie.css'],
  standalone: false
})
export class CookieComponent {
  constructor(
    public auth: AuthService,
    private preferences: PreferencesService,
    private toast: ToastService
  ) {}

  get c(): CookieSettings {
    return this.preferences.prefs.cookies;
  }

  get accountName(): string {
    return this.auth.currentUser?.username ?? 'Khách';
  }

  get isAcceptAll(): boolean {
    const c = this.c;
    return c.recentApps && c.analytics && c.feedbackRequests && c.frameRateData;
  }

  set(key: keyof CookieSettings, value: boolean): void {
    this.preferences.save({ ...this.preferences.prefs, cookies: { ...this.c, [key]: value } });
  }

  chapNhanTatCa(): void {
    this.preferences.save({
      ...this.preferences.prefs,
      cookies: { ...this.c, recentApps: true, analytics: true, feedbackRequests: true, frameRateData: true }
    });
    this.toast.success('Đã chấp nhận tất cả cookies!');
  }

  tuChoiTatCa(): void {
    this.preferences.save({
      ...this.preferences.prefs,
      cookies: { ...this.c, recentApps: false, analytics: false, feedbackRequests: false, frameRateData: false }
    });
    this.toast.warning('Đã từ chối tất cả cookies tùy chọn!');
  }

  themPC(): void {
    this.set('pcSaved', !this.c.pcSaved);
  }
}
