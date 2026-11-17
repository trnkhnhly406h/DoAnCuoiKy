import { Injectable } from '@angular/core';
import { AuthService, EMAIL_REGEX, SHOW_TEST_OTP } from './auth';
import { CartWishlistService } from './cart-wishlist';
import { ChatService } from './chat';
import { LibraryStatsService } from './library-stats';
import { NotificationService } from './notification';
import { PhoneValidationService } from './phone-validation';
import { PreferencesService } from './preferences';
import { loadJson, saveJson } from './storage';
import { UserProfileService } from './user-profile';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export { EMAIL_REGEX, SHOW_TEST_OTP };

/** Giá trị hiển thị khi tài khoản chưa liên kết số điện thoại (dùng chung mọi nơi). */
export const NO_PHONE = 'Chưa liên kết';
export const MAX_OTP_ATTEMPTS = 3;

export interface DeviceSession {
  id: string;
  name: string;
  isCurrent: boolean;
  location: string;
  authorizedDate: string;
}

export interface AccountInfo {
  email: string;
  phone: string;
  status: string;
  country: string;
}

export interface OtpVerifyResult {
  ok: boolean;
  locked: boolean;
  message: string;
}

export interface SimpleResult {
  ok: boolean;
  message: string;
}

const STORAGE_KEY = 'steal_account';

function currentBrowserName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'thiết bị này';
  return `Trình duyệt - "${browser} trên ${os}"`;
}

function formatNow(): string {
  const d = new Date();
  const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()} @ ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function devices(): DeviceSession[] {
  return [
    { id: 'dev-1', name: currentBrowserName(), isCurrent: true, location: 'Ho Chi Minh City, VN', authorizedDate: formatNow() },
    { id: 'dev-2', name: 'Phần mềm STEAL trên máy tính - "DESKTOP-STEAL01"', isCurrent: false, location: 'Ho Chi Minh City, VN', authorizedDate: 'Thứ 5, 23 tháng 7, 2026 @ 16:31' }
  ];
}

/**
 * Thông tin tài khoản, bảo mật (OTP, mật khẩu, 2FA) và các thao tác
 * ảnh hưởng toàn hệ thống (xóa tài khoản, nạp dữ liệu mẫu).
 * Email, mật khẩu và việc xóa tài khoản đều đi qua AuthService.
 */
@Injectable({ providedIn: 'root' })
export class AccountSettingsService {
  accountInfo: AccountInfo = { email: '', phone: NO_PHONE, status: 'Đã xác thực', country: 'Việt Nam' };
  twoFactorEnabled = false;
  activeDevices: DeviceSession[] = devices();

  currentOtpCode = '';
  wrongOtpCount = 0;

  constructor(
    private auth: AuthService,
    private cart: CartWishlistService,
    private chat: ChatService,
    private profile: UserProfileService,
    private notifications: NotificationService,
    private preferences: PreferencesService,
    private stats: LibraryStatsService,
    private phoneValidation: PhoneValidationService,
    private http: HttpClient
  ) {
    auth.currentUser$.subscribe(() => this.reload());
  }

  private reload(): void {
    const user = this.auth.currentUser;
    const stored = loadJson<Partial<{ phone: string }>>(STORAGE_KEY, {});
    this.accountInfo = {
      email: user?.email ?? '',
      phone: stored.phone || NO_PHONE,
      status: 'Đã xác thực',
      country: user?.country ?? 'Việt Nam'
    };
    this.twoFactorEnabled = this.auth.isTwoFactorEnabled;
    this.activeDevices = devices();
    this.cancelOtp();
  }

  
get hasPhone(): boolean {
  const phone = String(
    this.accountInfo.phone || ''
  ).trim();

  return phone !== '' && phone !== NO_PHONE;
}


  /* ===================== Số điện thoại theo quốc gia ===================== */

  isValidPhone(phone: string): boolean {
    return this.phoneValidation.validate(phone, this.accountInfo.country);
  }

  get phoneErrorMessage(): string {
    return this.phoneValidation.errorMessage(this.accountInfo.country);
  }

  get phonePlaceholder(): string {
    return this.phoneValidation.getRule(this.accountInfo.country).example;
  }

  /* ===================== OTP ===================== */

  /** Tạo mã OTP mới. Với luồng nhiều bước (xóa tài khoản), giữ nguyên số lần nhập sai. */
  issueOtp(resetAttempts = true): string {
    this.currentOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    if (resetAttempts) this.wrongOtpCount = 0;
    return this.currentOtpCode;
  }

  cancelOtp(): void {
    this.currentOtpCode = '';
    this.wrongOtpCount = 0;
  }

  verifyOtp(input: string): OtpVerifyResult {
    if (!this.currentOtpCode) {
      return { ok: false, locked: false, message: 'Mã OTP đã hết hiệu lực, vui lòng gửi lại mã.' };
    }
    if (input.trim() === this.currentOtpCode) {
      this.currentOtpCode = '';
      this.wrongOtpCount = 0;
      return { ok: true, locked: false, message: '' };
    }
    this.wrongOtpCount++;
    if (this.wrongOtpCount >= MAX_OTP_ATTEMPTS) {
      this.cancelOtp();
      return { ok: false, locked: true, message: `Mã xác minh bị sai quá ${MAX_OTP_ATTEMPTS} lần! Tài khoản của bạn đã bị tự động đăng xuất.` };
    }
    return { ok: false, locked: false, message: `Mã xác minh bị sai, vui lòng nhập lại! (Sai ${this.wrongOtpCount}/${MAX_OTP_ATTEMPTS} lần)` };
  }

  /* ===================== Liên hệ ===================== */

  
async refreshFromApi(): Promise<void> {
  const username = this.auth.currentUser?.username;

  if (!username) return;

  try {
    const response = await firstValueFrom(
      this.http.get<{
        success: boolean;
        data?: {
          email: string;
          soDienThoai?: string;
        };
      }>('http://localhost:3000/api/store/users/me')
    );

    if (
      !response.success ||
      !response.data ||
      this.auth.currentUser?.username !== username
    ) {
      return;
    }

    this.accountInfo = {
      ...this.accountInfo,
      email: response.data.email,
      phone: response.data.soDienThoai || NO_PHONE
    };

  } catch (error) {
    console.warn('Lỗi đồng bộ tài khoản:', error);
  }
}

// =====================================
// ĐỔI EMAIL THẬT
// =====================================

async updateEmail(email: string): Promise<SimpleResult> {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_REGEX.test(normalized)) {
    return { ok: false, message: 'Email không hợp lệ' };
  }

  try {
    const res = await firstValueFrom(
      this.http.put<{
        success: boolean;
        message: string;
        data?: { email: string };
      }>(
        'http://localhost:3000/api/store/users/me',
        { email: normalized }
      )
    );

    if (!res.success || !res.data) {
      return {
        ok: false,
        message: res.message || 'Không cập nhật được email'
      };
    }

    this.auth.syncEmailFromServer(res.data.email);

    this.accountInfo = {
      ...this.accountInfo,
      email: res.data.email
    };

    this.notifications.push(
      'security',
      'ĐỔI EMAIL THÀNH CÔNG',
      'Địa chỉ email đã được cập nhật trên hệ thống.',
      '🔐'
    );

    return { ok: true, message: res.message };

  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể kết nối API đổi email'
    };
  }
}

// =====================================
// THÊM / ĐỔI SỐ ĐIỆN THOẠI THẬT
// =====================================

async updatePhone(phone: string): Promise<SimpleResult> {
  const normalized = phone.trim();

  if (!this.isValidPhone(normalized)) {
    return {
      ok: false,
      message: this.phoneErrorMessage
    };
  }

  try {
    const res = await firstValueFrom(
      this.http.put<{
        success: boolean;
        message: string;
        data?: { soDienThoai: string };
      }>(
        'http://localhost:3000/api/store/users/me',
        { soDienThoai: normalized }
      )
    );

    if (!res.success || !res.data) {
      return {
        ok: false,
        message: res.message || 'Cập nhật thất bại'
      };
    }

    this.accountInfo = {
      ...this.accountInfo,
      phone: res.data.soDienThoai || NO_PHONE
    };

    this.persist();

    this.notifications.push(
      'security',
      'LIÊN KẾT SỐ ĐIỆN THOẠI',
      'Số điện thoại đã được lưu trên hệ thống.',
      '📱'
    );

    return { ok: true, message: res.message };

  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể cập nhật số điện thoại'
    };
  }
}

// =====================================
// GỠ SỐ ĐIỆN THOẠI
// =====================================


async removePhone(): Promise<SimpleResult> {
  try {
    // Bước 1: Yêu cầu backend xóa số điện thoại
    const response = await firstValueFrom(
      this.http.put<{
        success: boolean;
        message?: string;
      }>(
        'http://localhost:3000/api/store/users/me',
        { soDienThoai: '' }
      )
    );

    if (!response.success) {
      return {
        ok: false,
        message: response.message ||
          'Backend không thể gỡ số điện thoại.'
      };
    }

    // Bước 2: Đọc lại MongoDB để xác minh
    const verify = await firstValueFrom(
      this.http.get<{
        success: boolean;
        data?: {
          soDienThoai?: string;
        };
      }>(
        'http://localhost:3000/api/store/users/me'
      )
    );

    if (!verify.success || !verify.data) {
      return {
        ok: false,
        message:
          'Đã gửi yêu cầu gỡ nhưng chưa xác minh được dữ liệu từ máy chủ.'
      };
    }

    const serverPhone = String(
      verify.data.soDienThoai || ''
    ).trim();

    // Nếu MongoDB vẫn còn số điện thoại, báo lỗi
    if (serverPhone !== '') {
      this.accountInfo = {
        ...this.accountInfo,
        phone: serverPhone
      };

      this.persist();

      return {
        ok: false,
        message:
          'MongoDB vẫn còn số điện thoại. Kiểm tra API PUT /users/me.'
      };
    }

    // Bước 3: Xóa số điện thoại ở frontend
    // Chỉ thực hiện sau khi MongoDB xác nhận
    this.accountInfo = {
      ...this.accountInfo,
      phone: NO_PHONE
    };

    this.persist();

    return {
      ok: true,
      message: 'Đã gỡ số điện thoại thành công!'
    };

  } catch (error: any) {
    console.error(
      '[STEAL] Lỗi API gỡ số điện thoại:',
      error
    );

    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể kết nối API gỡ số điện thoại.'
    };
  }
}


// =====================================
// ĐỔI MẬT KHẨU THẬT
// =====================================

async changePassword(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<SimpleResult> {

  if (!oldPassword) {
    return {
      ok: false,
      message: 'Vui lòng nhập mật khẩu hiện tại!'
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      message: 'Xác nhận mật khẩu mới không khớp!'
    };
  }

  if (!this.auth.validatePassword(newPassword)) {
    return {
      ok: false,
      message:
        'Cần ít nhất 8 ký tự, chữ hoa, chữ cái, số và ký tự đặc biệt.'
    };
  }

  try {
    const res = await firstValueFrom(
      this.http.put<{
        success: boolean;
        message: string;
      }>(
        'http://localhost:3000/api/store/users/me/password',
        {
          matKhauCu: oldPassword,
          matKhauMoi: newPassword
        }
      )
    );

    if (!res.success) {
      return {
        ok: false,
        message: res.message || 'Đổi mật khẩu thất bại'
      };
    }

    this.notifications.push(
      'security',
      'ĐỔI MẬT KHẨU THÀNH CÔNG',
      'Mật khẩu đã được cập nhật trên hệ thống.',
      '🔑'
    );

    return { ok: true, message: res.message };

  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể đổi mật khẩu'
    };
  }
}

// =====================================
// XÓA TÀI KHOẢN THẬT
// =====================================

async deleteAccount(): Promise<SimpleResult> {
  try {
    const res = await firstValueFrom(
      this.http.request<{
        success: boolean;
        message: string;
      }>(
        'DELETE',
        'http://localhost:3000/api/store/users/me',
        {
          body: { confirmation: 'DELETE' }
        }
      )
    );

    if (!res.success) {
      return {
        ok: false,
        message: res.message || 'Không gửi được yêu cầu xóa tài khoản' 
      };
    }

    // Backend đã KHÓA và lên lịch xóa, chưa xóa vĩnh viễn.
    // Giữ dữ liệu local để Admin có thể khôi phục tài khoản trong thời hạn.
    this.auth.logout();

    return { ok: true, message: res.message };

  } catch (error: any) {
    return {
      ok: false,
      message:
        error?.error?.message ||
        'Không thể gửi yêu cầu khóa chờ xóa tài khoản'
    };
  }
}


  /* ===================== Bảo mật ===================== */

  setTwoFactor(enabled: boolean): void {
    this.twoFactorEnabled = enabled;
    this.auth.setTwoFactor(enabled);
    this.notifications.push('security', enabled ? 'BẬT STEAL GUARD' : 'TẮT STEAL GUARD',
      enabled ? 'Xác thực 2 yếu tố đã được bật.' : 'Xác thực 2 yếu tố đã bị tắt. Tài khoản của bạn kém an toàn hơn.', '🛡️');
  }

  logoutOtherDevices(): void {
    this.activeDevices = this.activeDevices.filter(d => d.isCurrent);
  }

  

  /* ===================== Thao tác toàn hệ thống ===================== */
  

  /** Đưa mọi dữ liệu về trạng thái "tài khoản mới" (vẫn đăng nhập) để demo. */
  resetToNewAccount(): void {
    this.cancelOtp();
    this.accountInfo = { ...this.accountInfo, phone: NO_PHONE };
    this.twoFactorEnabled = false;
    this.auth.setTwoFactor(false);
    this.persist();
    this.cart.reset();
    this.chat.reset();
    this.profile.reset();
    this.notifications.reset();
    this.preferences.reset();
    this.stats.reset();
  }

  loadSampleData(): void {
    this.accountInfo = { ...this.accountInfo, phone: NO_PHONE };
    this.twoFactorEnabled = false;
    this.auth.setTwoFactor(false);
    this.persist();
    this.profile.loadSample();
    this.cart.loadSample();
    this.chat.loadSample();
    this.notifications.restoreSample();
    this.stats.loadSample();
  }

  private persist(): void {
    saveJson(STORAGE_KEY, { phone: this.accountInfo.phone });
  }
}
