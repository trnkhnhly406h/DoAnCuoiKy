import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { clearScope, GUEST_SCOPE, scopeOf, setStorageScope } from './storage';
import { ApplicationRef, inject, Injectable } from '@angular/core';
export type AuthModal = 'none' | 'login' | 'register';

export interface CurrentUser {
  username: string;
  email: string;
  country: string;
}

interface StoredUser {
  username: string;
  email: string;
  passwordHash: string;
  country: string;
  createdAt: number;
  /** Tài khoản demo có sẵn dữ liệu mẫu (bạn bè, thư viện...). */
  demo?: boolean;
  /** STEAL Guard: yêu cầu mã OTP mỗi lần đăng nhập. */
  twoFactor?: boolean;
}

export type OtpPurpose = 'register' | 'login' | 'recovery';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_MS = 30 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_FAILS = 5;
const LOGIN_LOCK_MS = 60 * 1000;

export interface AuthResult {
  success: boolean;
  message: string;
  needsOtp?: boolean;
  token?: string;
  data?: {
    maTaiKhoan: string;
    tenDangNhap: string;
    email: string;
    hoTen: string;
    anhDaiDien?: string;
    vaiTro: string;
    quyen?: string[];
    viTien?: number;
  };
}
// Kết quả đăng nhập Admin
export interface AdminAuthResult {
  success: boolean;
  message: string;
  requires2FA?: boolean;
  otpToken?: string;
  token?: string;
  data?: {
    maTaiKhoan: string;
    tenDangNhap: string;
    email: string;
    hoTen: string;
    anhDaiDien?: string;
    vaiTro: string;
    quyen?: string[];
  };
}
/** Hiển thị mã OTP trên giao diện vì chưa có dịch vụ gửi Email/SMS thật. */
export const SHOW_TEST_OTP = true;
export const USERNAME_REGEX = /^[\p{L}\p{N} ._-]{3,24}$/u;
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const PASSWORD_HINT = 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa (A-Z), chữ cái, số và ký tự đặc biệt!';

const KEY_ACCOUNTS = 'steal_accounts';
const KEY_DELETED = 'steal_deleted_accounts';
const KEY_SESSION = 'steal_session';
const KEY_GUARD = 'steal_login_guard';

/** Băm đơn giản (cyrb53) để không lưu mật khẩu dạng thô. Chỉ phù hợp bản demo, KHÔNG thay thế băm phía máy chủ. */
function hashPassword(username: string, password: string): string {
  const str = `${username.trim().toLowerCase()}:${password}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const seed = (username: string, email: string, password: string): StoredUser => ({
  username, email, passwordHash: hashPassword(username, password), country: 'Việt Nam', createdAt: 0, demo: true
});

/** Tài khoản có sẵn để đăng nhập thử (mật khẩu: Steal@123 hoặc password123). */
const BUILT_IN_USERS: StoredUser[] = [
  seed('5 con nhái', 'ban.choi@example.com', 'Steal@123'),
  seed('khach_vip01', 'vietthanh.bui@gmail.com', 'password123'),
  seed('khach_vip02', 'harry.brown@gmail.com', 'password123'),
  seed('khach_vip03', 'ucanh.hoang@outlook.com', 'password123'),
  seed('khach_vip04', 'khanhlinh.le@outlook.com', 'password123'),
  seed('khach_vip05', 'eunji.lee@hotmail.com', 'password123'),
  seed('moba_player', 'hoangnam.bui@yahoo.com', 'password123'),
  seed('gamer_hcm02', 'vanminh.huynh@hotmail.com', 'password123')
];

const norm = (v: string) => String(v || '').trim().toLowerCase();

/**
 * Tài khoản + phiên đăng nhập. Mỗi tài khoản có kho dữ liệu riêng (xem storage.ts);
 * các service dữ liệu lắng nghe `scope$` để tải lại khi đổi tài khoản.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly appRef = inject(ApplicationRef);
  /** Mã OTP đang chờ xác minh (đăng ký / khôi phục mật khẩu). */
  currentOtp = '';
  tempRegisterData: { email?: string; country?: string; verified?: boolean } = {};

  private otpPurpose: OtpPurpose | null = null;
  private otpIssuedAt = 0;
  private otpAttempts = 0;
  /** Email đã xác minh OTP trong luồng khôi phục: chỉ khi đó mới được đặt lại mật khẩu. */
  private recoveryEmail = '';
  private recoveryVerified = false;
  private recoveryMode: 'backend' | 'local' = 'local';
  private remembered = true;

  private pendingLogin: { user: StoredUser; remember: boolean } | null = null;
  private current: CurrentUser | null = null;
  private currentIsDemo = false;
  private readonly userSubject = new BehaviorSubject<CurrentUser | null>(null);
  private readonly scopeSubject = new BehaviorSubject<string>(GUEST_SCOPE);
  private readonly modalSubject = new BehaviorSubject<AuthModal>('none');

  readonly currentUser$: Observable<CurrentUser | null> = this.userSubject.asObservable();
  readonly loggedIn$: Observable<boolean> = this.userSubject.pipe(map(u => !!u), distinctUntilChanged());
  readonly scope$: Observable<string> = this.scopeSubject.asObservable();
  readonly showAuthModal$: Observable<AuthModal> = this.modalSubject.asObservable();

  constructor(private http: HttpClient) {
  // Khôi phục phiên đăng nhập sau khi F5 / reload trang.
  try {
    const token = localStorage.getItem('steal_token');
    const savedUser = localStorage.getItem('steal_user');

    if (token && savedUser) {
      const data = JSON.parse(savedUser);

      if (data?.tenDangNhap && data?.email) {
        this.current = {
          username: data.tenDangNhap,
          email: data.email,
          country: 'Việt Nam'
        };

        this.currentIsDemo = false;
        this.remembered = true;

        const scope = scopeOf(data.tenDangNhap);

        setStorageScope(scope);
        this.scopeSubject.next(scope);
        this.userSubject.next(this.current);
      }
    }
  } catch (error) {
    console.error(
      'Không thể khôi phục phiên đăng nhập:',
      error
    );
  }

  // Đồng bộ nhiều tab:
  // đăng xuất / đổi tài khoản ở tab khác thì tab này theo.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key !== KEY_SESSION || !this.remembered) {
        return;
      }

      if (!e.newValue) {
        if (this.current) {
          this.logout(false);
        }
      } else if (
        norm(e.newValue) !==
        norm(this.current?.username ?? '')
      ) {
        const next = this.findUser(e.newValue);

        if (next) {
          this.activate(next);
        }
      }
    });
  }
}

/**
 * Khôi phục phiên đăng nhập sau khi tải lại trang.
 * Chỉ xác nhận đăng nhập khi Backend xác minh JWT thành công.
 */
private async restoreSession(): Promise<void> {
  const token = localStorage.getItem('steal_token');

  if (!token) {
    // Không có JWT thì không được tự nhận là đã đăng nhập.
    this.current = null;
    this.currentIsDemo = false;

    localStorage.removeItem('steal_user');

    setStorageScope(GUEST_SCOPE);
    this.scopeSubject.next(GUEST_SCOPE);
    this.userSubject.next(null);

    return;
  }

  try {
    const response = await firstValueFrom(
      this.http.get<{
        success: boolean;
        data?: {
          maTaiKhoan: string;
          tenDangNhap: string;
          email: string;
          hoTen: string;
          anhDaiDien?: string;
          vaiTro: string;
          quyen?: string[];
          viTien?: number;
        };
      }>('http://localhost:3000/api/store/auth/me')
    );

    const data = response?.data;

    if (!response.success || !data?.tenDangNhap || !data?.email) {
      throw new Error('Thông tin phiên đăng nhập không hợp lệ');
    }

    // Backend đã xác minh JWT và tìm thấy tài khoản.
    this.current = {
      username: data.tenDangNhap,
      email: data.email,
      country: 'Việt Nam'
    };

    this.currentIsDemo = false;
    this.remembered = true;

    // Cập nhật thông tin tài khoản mới nhất từ Backend.
    localStorage.setItem('steal_user', JSON.stringify(data));

    const scope = scopeOf(data.tenDangNhap);

    setStorageScope(scope);
    this.scopeSubject.next(scope);
    this.userSubject.next(this.current);

  } catch (error: any) {
    console.error('Không thể khôi phục phiên đăng nhập:', error);

    // Token không hợp lệ hoặc tài khoản không còn tồn tại.
    if (error?.status === 401 || error?.status === 403) {
      this.logout();
      return;
    }

    // Backend tạm thời không kết nối được:
    // Không tự xóa token hợp lệ chỉ vì lỗi mạng.
    this.current = null;
    this.currentIsDemo = false;

    setStorageScope(GUEST_SCOPE);
    this.scopeSubject.next(GUEST_SCOPE);
    this.userSubject.next(null);
  }
}

  get currentUser(): CurrentUser | null {
    return this.current;
  }

  get isLoggedIn(): boolean {
    return !!this.current;
  }

  /** Tài khoản demo được nạp sẵn dữ liệu mẫu. */
  get isDemoAccount(): boolean {
    return this.currentIsDemo;
  }

  get scope(): string {
    return this.scopeSubject.value;
  }

  /* ===================== Cửa sổ đăng nhập / đăng ký ===================== */

  openModal(type: AuthModal): void {
    this.modalSubject.next(type);
    queueMicrotask(() => this.appRef.tick());
  }

  closeModal(): void {
    this.modalSubject.next('none');
    queueMicrotask(() => this.appRef.tick());
  }

  /** Mở cửa sổ đăng nhập (dùng cho mọi nút "Đăng nhập" trong ứng dụng). */
  requestLogin(): void {
    this.openModal('login');
  }

  /* ===================== Đăng nhập / đăng xuất ===================== */

async login(
  identifier: string,
  password: string,
  remember = true
): Promise<AuthResult> {
  try {
    const response = await firstValueFrom(
      this.http.post<AuthResult>(
        'http://localhost:3000/api/store/auth/login',
        {
          tenDangNhap: identifier,
          matKhau: password
        }
      )
    );

    if (!response.success || !response.token || !response.data) {
      return {
        success: false,
        message: response.message || 'Đăng nhập thất bại'
      };
    }

    // ============================================
    // 1. Lưu JWT token
    // ============================================
    localStorage.setItem(
      'steal_token',
      response.token
    );

    // ============================================
    // 2. Lưu thông tin tài khoản
    // ============================================
    localStorage.setItem(
      'steal_user',
      JSON.stringify(response.data)
    );

    // ============================================
    // 3. Lưu username theo cơ chế session hiện tại
    // ============================================
    if (remember) {
      localStorage.setItem(
        'steal_session_username',
        response.data.tenDangNhap
      );

      sessionStorage.removeItem(
        'steal_session_username'
      );
    } else {
      sessionStorage.setItem(
        'steal_session_username',
        response.data.tenDangNhap
      );

      localStorage.removeItem(
        'steal_session_username'
      );
    }

    // ============================================
    // 4. Cập nhật current user
    // ============================================
    this.current = {
      username: response.data.tenDangNhap,
      email: response.data.email,
      country: 'Việt Nam'
    };

    this.currentIsDemo = false;
    this.remembered = remember;

    // ============================================
    // 5. CỰC KỲ QUAN TRỌNG
    //    Cập nhật scope cho tài khoản vừa đăng nhập
    // ============================================
    const scope = scopeOf(
      response.data.tenDangNhap
    );

    setStorageScope(scope);

    this.scopeSubject.next(scope);

    // ============================================
    // 6. Thông báo user đã đăng nhập
    // ============================================
    this.userSubject.next(this.current);
    queueMicrotask(() => this.appRef.tick());
    return {
      success: true,
      message:
        response.message ||
        'Đăng nhập thành công',
      token: response.token,
      data: response.data
    };

  } catch (error: any) {
    console.error(
      'Login API error:',
      error
    );

    return {
      success: false,
      message:
        error?.error?.message ||
        'Không thể kết nối đến máy chủ. Hãy kiểm tra backend.'
    };
  }
}

  /** Bước 2 của đăng nhập có STEAL Guard: xác minh OTP rồi mới vào tài khoản. */
  completeLogin(code: string): AuthResult {
    const pending = this.pendingLogin;
    if (!pending) return { success: false, message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' };
    const result = this.verifyOtp(code, 'login');
    if (!result.success) return result;
    this.pendingLogin = null;
    this.resetOtp();
    this.activate(pending.user, pending.remember);
    this.closeModal();
    return { success: true, message: `Chào mừng ${pending.user.username} quay trở lại!` };
  }

  cancelPendingLogin(): void {
    this.pendingLogin = null;
    this.resetOtp();
  }

  /** Bật/tắt STEAL Guard cho tài khoản đang đăng nhập. */
  setTwoFactor(enabled: boolean): void {
    const user = this.currentStoredUser();
    if (user) this.saveStoredUser({ ...user, twoFactor: enabled });
  }

  get isTwoFactorEnabled(): boolean {
    return !!this.currentStoredUser()?.twoFactor;
  }

  logout(clearShared = true): void {
  this.pendingLogin = null;
  this.tempRegisterData = {};
  this.recoveryVerified = false;
  this.recoveryEmail = '';
  this.recoveryMode = 'local';

  this.resetOtp();

  this.current = null;
  this.currentIsDemo = false;

  // Xóa JWT và thông tin tài khoản khách hàng.
  localStorage.removeItem('steal_token');
  localStorage.removeItem('steal_user');

  // Xóa thông tin phiên đăng nhập.
  localStorage.removeItem('steal_session_username');
  sessionStorage.removeItem('steal_session_username');

  if (clearShared) {
    localStorage.removeItem(KEY_SESSION);
  }

  sessionStorage.removeItem(KEY_SESSION);

  setStorageScope(GUEST_SCOPE);

  this.scopeSubject.next(GUEST_SCOPE);
  this.userSubject.next(null);
}
/* ===================== Đăng nhập Admin ===================== */
/* ===================== Đăng nhập Admin ===================== */

  loginAdmin(email: string, matKhau: string): Promise<AdminAuthResult> {
    return this.adminLogin(email, matKhau);
  }

  async adminLogin(
    email: string,
    matKhau: string
  ): Promise<AdminAuthResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<AdminAuthResult>(
          'http://localhost:3000/api/store/auth/admin/login',
          {
            email: email.trim().toLowerCase(),
            matKhau: matKhau
          }
        )
      );

      return response;
    } catch (error: any) {
      console.error('Admin login API error:', error);
      return {
        success: false,
        message: error?.error?.message || 'Không thể kết nối đến máy chủ. Hãy kiểm tra backend.'
      };
    }
  }

/**
 * Bước 2: Admin xác minh OTP.
 * Chỉ khi OTP hợp lệ Backend mới trả về JWT chính thức.
 */
async verifyAdminOtp(
  otp: string,
  otpToken: string
): Promise<AdminAuthResult> {
  try {
    const response = await firstValueFrom(
      this.http.post<AdminAuthResult>(
        'http://localhost:3000/api/store/auth/admin/verify-otp',
        {
          otp: otp.trim(),
          otpToken: otpToken
        }
      )
    );

    return response;

  } catch (error: any) {
    console.error('Admin OTP verification error:', error);

    return {
      success: false,
      message:
        error?.error?.message ||
        'Không thể xác minh OTP. Vui lòng kiểm tra backend.'
    };
  }
}
  /* ===================== Tra cứu tài khoản ===================== */

  isEmailTaken(email: string): boolean {
    const key = norm(email);
    return !!key && this.getAllUsers().some(u => norm(u.email) === key);
  }

  isUsernameTaken(username: string): boolean {
    const key = norm(username);
    return !!key && this.getAllUsers().some(u => norm(u.username) === key);
  }

  findUserByEmail(email: string): { username: string; email: string } | null {
    const user = this.getAllUsers().find(u => norm(u.email) === norm(email));
    return user ? { username: user.username, email: user.email } : null;
  }

  /** Tìm tài khoản theo tên hoặc email (dùng khi tặng quà). */
  lookupAccount(identifier: string): { username: string; email: string; scope: string } | null {
    const key = norm(identifier);
    const user = this.getAllUsers().find(u => norm(u.username) === key || norm(u.email) === key);
    return user ? { username: user.username, email: user.email, scope: scopeOf(user.username) } : null;
  }

  /** Scope này thuộc tài khoản demo (có dữ liệu mẫu chưa được ghi ra bộ nhớ)? */
  isDemoScope(scope: string): boolean {
    return this.getAllUsers().some(u => scopeOf(u.username) === scope && !!u.demo);
  }

  /* ===================== OTP ===================== */

  /** Cấp mã OTP mới (6 số) cho một mục đích; làm mới hạn dùng và số lần thử. */
  issueOtp(purpose?: OtpPurpose): string {
    if (purpose) this.otpPurpose = purpose;
    const previous = this.currentOtp;
    do {
      this.currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.currentOtp === previous);
    this.otpIssuedAt = Date.now();
    this.otpAttempts = 0;
    return this.currentOtp;
  }

  /** Hủy mã đang chờ (đóng cửa sổ, rời trang, đăng xuất). */
  resetOtp(): void {
    this.currentOtp = '';
    this.otpPurpose = null;
    this.otpIssuedAt = 0;
    this.otpAttempts = 0;
  }

  /** Số giây còn lại trước khi được gửi lại mã (0 = gửi được ngay). */
  get otpCooldownLeft(): number {
    return Math.max(0, Math.ceil((this.otpIssuedAt + OTP_RESEND_MS - Date.now()) / 1000));
  }

  /** Gửi lại mã (giữ nguyên mục đích), có chặn gửi dồn dập. */
  resendOtp(): AuthResult {
    if (!this.otpPurpose) return { success: false, message: 'Phiên xác minh đã kết thúc, vui lòng thực hiện lại từ đầu.' };
    const wait = this.otpCooldownLeft;
    if (wait > 0) return { success: false, message: `Vui lòng đợi ${wait} giây để gửi lại mã.` };
    this.issueOtp();
    return { success: true, message: 'Đã gửi lại mã xác minh mới!' };
  }

  verifyOtp(entered: string, purpose?: OtpPurpose): AuthResult {
    const code = (entered || '').trim();
    if (!code) return { success: false, message: 'Vui lòng nhập mã OTP!' };
    if (!/^\d{6}$/.test(code)) return { success: false, message: 'Mã OTP phải gồm đúng 6 chữ số!' };
    if (!this.currentOtp || (purpose && purpose !== this.otpPurpose)) {
      return { success: false, message: 'Mã OTP không còn hiệu lực. Vui lòng bấm "Gửi lại mã".' };
    }
    if (Date.now() - this.otpIssuedAt > OTP_TTL_MS) {
      this.currentOtp = '';
      this.otpIssuedAt = 0;
      return { success: false, message: 'Mã OTP đã hết hạn. Vui lòng bấm "Gửi lại mã".' };
    }
    if (code !== this.currentOtp) {
      this.otpAttempts++;
      const left = MAX_OTP_ATTEMPTS - this.otpAttempts;
      if (left <= 0) {
        this.currentOtp = '';
        this.otpIssuedAt = 0; // cho phép gửi lại mã ngay
        return { success: false, message: 'Bạn đã nhập sai quá nhiều lần. Mã đã bị hủy, vui lòng bấm "Gửi lại mã".' };
      }
      return { success: false, message: `Mã OTP không chính xác! Bạn còn ${left} lần thử.` };
    }
    const done = this.otpPurpose;
    this.currentOtp = '';
    this.otpAttempts = 0;
    if (done === 'register') this.tempRegisterData.verified = true;
    if (done === 'recovery') this.recoveryVerified = true;
    if (done !== 'login') this.otpPurpose = null;
    return { success: true, message: 'Xác thực thành công!' };
  }

  /* ===================== Đăng ký ===================== */

  /** Bước 1: lưu email + quốc gia và gửi OTP. */
  saveRegisterStep1(email: string, country: string): boolean {
    const normalized = norm(email);

    if (!EMAIL_REGEX.test(normalized)) {
      return false;
    }

    this.tempRegisterData = {
      email: normalized,
      country,
      verified: false
    };

    this.issueOtp('register');
    return true;
  }

  validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-zA-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^a-zA-Z0-9]/.test(password)
  );
}

  /** Bước 3: tạo tài khoản. */
  async finishRegister(
  username: string,
  password: string,
  confirmPassword: string
): Promise<AuthResult> {
  try {
    if (!username || !password || !confirmPassword) {
      return {
        success: false,
        message: 'Vui lòng nhập đầy đủ thông tin'
      };
    }

    if (password !== confirmPassword) {
      return {
        success: false,
        message: 'Mật khẩu xác nhận không khớp'
      };
    }

    const email = this.tempRegisterData.email || '';

    if (!email) {
      return {
        success: false,
        message: 'Không tìm thấy email đăng ký'
      };
    }

    const response = await firstValueFrom(
      this.http.post<AuthResult>(
        'http://localhost:3000/api/store/auth/register',
        {
          tenDangNhap: username,
          email: email,
          matKhau: password,
          hoTen: ''
        }
      )
    );

    if (!response.success || !response.data) {
      return {
        success: false,
        message: response.message || 'Đăng ký thất bại'
      };
    }

    return {
      success: true,
      message: response.message || 'Đăng ký tài khoản thành công',
      data: response.data
    };

  } catch (error: any) {
    console.error('Register API error:', error);

    return {
      success: false,
      message:
        error?.error?.message ||
        'Không thể kết nối đến máy chủ. Hãy kiểm tra backend.'
    };
  }
}
async checkEmailExists(email: string): Promise<boolean> {
  try {
    const response = await firstValueFrom(
      this.http.post<{ success: boolean; exists: boolean }>(
        'http://localhost:3000/api/store/auth/check-email',
        {
          email: email.trim().toLowerCase()
        }
      )
    );

    return response.exists;
  } catch (error) {
    console.error('Check email error:', error);
    throw error;
  }
}


async checkUsernameExists(username: string): Promise<boolean> {
  const response = await firstValueFrom(
    this.http.post<{
      success: boolean;
      exists: boolean;
    }>(
      'http://localhost:3000/api/store/auth/check-username',
      {
        tenDangNhap: username.trim()
      }
    )
  );

  if (!response.success) {
    throw new Error('Không thể kiểm tra tên tài khoản');
  }

  return response.exists;
}

  /* ===================== Khôi phục / đổi mật khẩu ===================== */

  /** Bước 1 khôi phục: kiểm tra email trong MongoDB rồi gửi OTP. */
  async startRecovery(email: string): Promise<AuthResult & { username?: string }> {
    const normalizedEmail = norm(email);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return {
        success: false,
        message: 'Địa chỉ email không đúng định dạng!'
      };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{
          success: boolean;
          message: string;
          data?: {
            maTaiKhoan: string;
            tenDangNhap: string;
            email: string;
          };
        }>(
          'http://localhost:3000/api/store/auth/recovery/check',
          {
            email: normalizedEmail
          }
        )
      );

      if (!response.success || !response.data) {
        return {
          success: false,
          message: response.message || 'Email chưa được đăng ký tài khoản'
        };
      }

      this.recoveryMode = 'backend';
      this.recoveryEmail = norm(response.data.email);
      this.recoveryVerified = false;
      this.issueOtp('recovery');

      return {
        success: true,
        message: 'Đã gửi mã xác minh.',
        username: response.data.tenDangNhap
      };

    
} catch (error: any) {

  // Email không tồn tại trong MongoDB.
  // Không chuyển sang tài khoản demo/local nữa,
  // vì đăng nhập Customer hiện kiểm tra MongoDB.
  if (error?.status === 404) {
    return {
      success: false,
      message:
        'Email này chưa có tài khoản trong hệ thống. ' +
        'Không thể khôi phục mật khẩu.'
    };
  }

  console.error(
    'Lỗi kiểm tra email khôi phục:',
    error
  );

  return {
    success: false,
    message:
      error?.error?.message ||
      'Không thể kiểm tra email. Vui lòng thử lại!'
  };
}

  }

  async resetPassword(
    email: string,
    newPassword: string
  ): Promise<AuthResult> {
    if (!this.recoveryVerified || this.recoveryEmail !== norm(email)) {
      return {
        success: false,
        message: 'Bạn cần xác minh mã OTP trước khi đặt lại mật khẩu.'
      };
    }

    if (!this.validatePassword(newPassword)) {
      return {
        success: false,
        message: PASSWORD_HINT
      };
    }

    if (this.recoveryMode === 'backend') {
      try {
        const response = await firstValueFrom(
          this.http.post<AuthResult>(
            'http://localhost:3000/api/store/auth/recovery/reset-password',
            {
              email: norm(email),
              matKhauMoi: newPassword
            }
          )
        );

        if (!response.success) {
          return {
            success: false,
            message: response.message || 'Không thể cập nhật mật khẩu.'
          };
        }

        this.recoveryVerified = false;
        this.recoveryEmail = '';
        this.recoveryMode = 'local';

        return {
          success: true,
          message: response.message || 'Đã cập nhật mật khẩu.'
        };

      } catch (error: any) {
        console.error('Lỗi cập nhật mật khẩu trên MongoDB:', error);

        return {
          success: false,
          message:
            error?.error?.message ||
            'Không thể cập nhật mật khẩu. Vui lòng kiểm tra backend và thử lại!'
        };
      }
    }

    // Tài khoản demo/local cũ.
    const user = this.getAllUsers().find(
      u => norm(u.email) === norm(email)
    );

    if (!user) {
      return {
        success: false,
        message: 'Không tìm thấy email để cập nhật mật khẩu!'
      };
    }

    this.saveStoredUser({
      ...user,
      passwordHash: hashPassword(user.username, newPassword)
    });

    this.recoveryVerified = false;
    this.recoveryEmail = '';
    this.recoveryMode = 'local';
    this.clearLoginFails(norm(user.username));
    this.clearLoginFails(norm(user.email));

    return {
      success: true,
      message: 'Đã cập nhật mật khẩu.'
    };
  }

  /** Đổi mật khẩu của tài khoản đang đăng nhập (kiểm tra mật khẩu cũ). */
  changePassword(oldPassword: string, newPassword: string): AuthResult {
    const user = this.currentStoredUser();
    if (!user) return { success: false, message: 'Bạn cần đăng nhập để đổi mật khẩu.' };
    if (user.passwordHash !== hashPassword(user.username, oldPassword)) return { success: false, message: 'Mật khẩu hiện tại không đúng!' };
    if (newPassword === oldPassword) return { success: false, message: 'Mật khẩu mới không được trùng mật khẩu cũ!' };
    if (!this.validatePassword(newPassword)) return { success: false, message: PASSWORD_HINT };
    this.saveStoredUser({ ...user, passwordHash: hashPassword(user.username, newPassword) });
    return { success: true, message: 'Đã đổi mật khẩu tài khoản thành công!' };
  }

  /** Mật khẩu demo của tài khoản mặc định, dùng để hiển thị gợi ý đăng nhập thử. */
  readonly demoCredentialsHint = '5 con nhái / Steal@123  hoặc  khach_vip01 / password123';

  /* ===================== Thay đổi thông tin tài khoản ===================== */

  changeEmail(newEmail: string): AuthResult {
    const user = this.currentStoredUser();
    if (!user) return { success: false, message: 'Bạn cần đăng nhập.' };
    const email = norm(newEmail);
    if (!EMAIL_REGEX.test(email)) return { success: false, message: 'Địa chỉ email không đúng định dạng!' };
    if (email !== norm(user.email) && this.isEmailTaken(email)) return { success: false, message: 'Email này đã được tài khoản khác sử dụng!' };
    this.saveStoredUser({ ...user, email });
    this.current = { ...(this.current as CurrentUser), email };
    this.userSubject.next(this.current);
    return { success: true, message: 'Đã cập nhật email.' };
  }

  /** Xóa vĩnh viễn tài khoản đang đăng nhập cùng toàn bộ dữ liệu của nó. */
  
deleteCurrentAccount(): void {
  const username = this.current?.username;

  if (!username) return;

  const scope = scopeOf(username);
  const accounts = this.readAccounts();

  delete accounts[norm(username)];

  this.writeAccounts(accounts);

  this.setDeleted([
    ...new Set([
      ...this.readDeleted(),
      norm(username)
    ])
  ]);

  this.logout();
  clearScope(scope);
}


  /* ===================== Nội bộ ===================== */

  private activate(user: StoredUser, remember = true): void {
    this.current = { username: user.username, email: user.email, country: user.country };
    this.currentIsDemo = !!user.demo;
    this.remembered = remember;
    const scope = scopeOf(user.username);
    setStorageScope(scope);
    try {
      // Không chọn "Ghi nhớ tôi": phiên chỉ tồn tại đến khi đóng tab.
      (remember ? localStorage : sessionStorage).setItem(KEY_SESSION, user.username);
      (remember ? sessionStorage : localStorage).removeItem(KEY_SESSION);
    } catch {
      /* bỏ qua */
    }
    this.scopeSubject.next(scope);
    this.userSubject.next(this.current);
  }

  private currentStoredUser(): StoredUser | undefined {
    return this.current ? this.findUser(this.current.username) : undefined;
  }

  private findUser(username: string): StoredUser | undefined {
    return this.getAllUsers().find(u => norm(u.username) === norm(username));
  }

  private getAllUsers(): StoredUser[] {
    const deleted = this.readDeleted();
    const map = new Map<string, StoredUser>();
    BUILT_IN_USERS.filter(u => !deleted.includes(norm(u.username))).forEach(u => map.set(norm(u.username), u));
    Object.values(this.readAccounts()).forEach(u => map.set(norm(u.username), u));
    return [...map.values()];
  }

  private saveStoredUser(user: StoredUser): void {
    const accounts = this.readAccounts();
    accounts[norm(user.username)] = user;
    this.writeAccounts(accounts);
  }

  private readAccounts(): Record<string, StoredUser> {
    try {
      const data = JSON.parse(localStorage.getItem(KEY_ACCOUNTS) || '{}') as Record<string, StoredUser>;
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      return {};
    }
  }

  private writeAccounts(accounts: Record<string, StoredUser>): void {
    try {
      localStorage.setItem(KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch {
      /* bỏ qua */
    }
  }

  private readDeleted(): string[] {
    try {
      const data = JSON.parse(localStorage.getItem(KEY_DELETED) || '[]') as string[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private setDeleted(list: string[]): void {
    try {
      localStorage.setItem(KEY_DELETED, JSON.stringify(list));
    } catch {
      /* bỏ qua */
    }
  }

  private readGuard(): Record<string, { count: number; until: number }> {
    try {
      return JSON.parse(localStorage.getItem(KEY_GUARD) || '{}') || {};
    } catch {
      return {};
    }
  }

  private writeGuard(g: Record<string, { count: number; until: number }>): void {
    try {
      localStorage.setItem(KEY_GUARD, JSON.stringify(g));
    } catch {
      /* bỏ qua */
    }
  }

  private loginLockLeft(key: string): number {
    const e = this.readGuard()[key];
    return e && e.until > Date.now() ? Math.ceil((e.until - Date.now()) / 1000) : 0;
  }

  private recordLoginFail(key: string): void {
    const g = this.readGuard();
    const e = g[key] && g[key].until <= Date.now() ? g[key] : { count: 0, until: 0 };
    e.count++;
    if (e.count >= MAX_LOGIN_FAILS) { e.count = 0; e.until = Date.now() + LOGIN_LOCK_MS; }
    g[key] = e;
    this.writeGuard(g);
  }

  private clearLoginFails(key: string): void {
    const g = this.readGuard();
    if (g[key]) { delete g[key]; this.writeGuard(g); }
  }

  private readSession(): string | null {
    try {
      return localStorage.getItem(KEY_SESSION) ?? sessionStorage.getItem(KEY_SESSION);
    } catch {
      return null;
    }
  }
  async testAuthMe(): Promise<any> {
  try {
    const response = await firstValueFrom(
      this.http.get(
        'http://localhost:3000/api/store/auth/me'
      )
    );

    console.log('AUTH ME RESULT:', response);

    return response;
  } catch (error: any) {
    console.error('AUTH ME ERROR:', error);
    return null;
  }
}

syncEmailFromServer(email: string): void {
  if (!this.current) return;

  this.current = { ...this.current, email };

  const stored = this.currentStoredUser();

  if (stored) {
    this.saveStoredUser({ ...stored, email });
  }

  try {
    const raw = localStorage.getItem('steal_user');

    if (raw) {
      const data = JSON.parse(raw);

      localStorage.setItem(
        'steal_user',
        JSON.stringify({ ...data, email })
      );
    }
  } catch {
    // Bỏ qua dữ liệu session cũ không hợp lệ
  }

  this.userSubject.next(this.current);
  queueMicrotask(() => this.appRef.tick());
}

}
