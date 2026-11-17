import { AuthService } from '../../../services/auth';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type AuthStep =
  | 'login_form'
  | 'login_error'
  | 'locked'
  | '2fa'
  | 'forgot_password';

@Component({
  selector: 'app-login-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dang-nhap-admin-component.html',
  styleUrl: './dang-nhap-admin-component.css'
})

export class DangNhapAdminComponent implements OnInit, OnDestroy {

  currentStep: AuthStep = 'login_form';
  private stepHistory: AuthStep[] = [];

  // Form đăng nhập
  loginEmail: string = '';
  loginPassword: string = '';

  // HIỆN / ẨN MẬT KHẨU
  showLoginPassword: boolean = false;

  toggleLoginPassword(): void {
    this.showLoginPassword = !this.showLoginPassword;
    this.cdr.detectChanges();
  }

  failedAttempts: number = 0;
  attemptsLeft: number = 3;
  loginEmptyError: boolean = false;

  private adminOtpToken: string = '';

  isSubmitting: boolean = false;
  loginErrorMessage: string = '';

  // Khóa tạm thời 5 phút
  lockCountdown: number = 300;
  lockTimer: any = null;

  // 2FA RSA Hardware Token
  tokenDigits: string[] = ['', '', '', '', '', ''];
  rsaCountdown: number = 18;
  rsaTimer: any = null;

  // Form Khôi phục mật khẩu
  forgotForm = {
    email: '',
    otp: '',
    token2fa: '',
    newPassword: '',
    confirmPassword: ''
  };

  resendOtpCountdown: number = 60;
  otpTimer: any = null;

  // Quản lý popup từ chối Staff / Editor
  showRestrictedModal: boolean = false;
  restrictedRole: string = 'Staff / Editor';
  restrictedMessage: string = '';
  isCheckingRecovery: boolean = false;
  isSuperAdminVerified: boolean = false;
  recoveryToken: string = '';

  private isBrowser: boolean;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.checkLockStateOnLoad();
    }
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  // --- KIỂM TRA TRẠNG THÁI KHÓA 5 PHÚT KHI F5 RELOAD TRANG ---
  
private checkLockStateOnLoad(): void {
  const lockUntil = Number(
    sessionStorage.getItem('admin_lock_until')
  );

  if (Number.isFinite(lockUntil) && lockUntil > Date.now()) {
    this.startLockTimer(false);
  } else {
    sessionStorage.removeItem('admin_lock_until');
  }
}


  // --- CHUYỂN MÀN HÌNH VÀ LƯU LỊCH SỬ ---
  chuyenStep(nextStep: AuthStep): void {
    if (this.currentStep !== nextStep) {
      this.stepHistory.push(this.currentStep);
      this.currentStep = nextStep;
    }

    if (nextStep === 'forgot_password') {
      if (this.loginEmail && !this.forgotForm.email) {
        this.forgotForm.email = this.loginEmail.trim();
      }
    }

    if (this.isBrowser) {
      if (nextStep === 'locked') {
        this.startLockTimer(true);
      }

      if (nextStep === '2fa') {
        this.startRsaTimer();
      }
    }
  }

  quayLai(): void {
    if (this.stepHistory.length > 0) {
      this.currentStep = this.stepHistory.pop()!;
    } else {
      this.currentStep = 'login_form';
    }
  }

  // --- BƯỚC 1: XỬ LÝ ĐĂNG NHẬP EMAIL & MẬT KHẨU ---
  async xuLyDangNhap(): Promise<void> {
    const email = (this.loginEmail || '').trim().toLowerCase();
    const pass = this.loginPassword || '';

    if (!email || !pass) {
      this.loginEmptyError = true;
      this.loginErrorMessage = 'Vui lòng nhập đầy đủ Email và Mật khẩu!';
      this.currentStep = 'login_error';
      return;
    }

    this.loginEmptyError = false;
    this.isSubmitting = true;

    try {
      // Gọi đúng tên phương thức adminLogin trong AuthService
      const result = await this.authService.adminLogin(email, pass);

      if (!result.success) {
        this.xuLyDangNhapThatBai(result.message || 'Email hoặc mật khẩu không chính xác!');
        return;
      }

      if (result.requires2FA) {
        this.adminOtpToken = result.otpToken || '';
        this.currentStep = '2fa';
        this.startRsaTimer();
        return;
      }

      if (result.token) {
        this.dangNhapThanhCong(result.token, result.data);
      } else {
        this.xuLyDangNhapThatBai('Không nhận được JWT token từ máy chủ!');
      }

    } catch (err: any) {
      this.xuLyDangNhapThatBai(err?.error?.message || 'Lỗi kết nối máy chủ!');
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  private xuLyDangNhapThatBai(message: string): void {
    this.failedAttempts++;
    this.attemptsLeft = Math.max(0, 3 - this.failedAttempts);
    this.loginErrorMessage = message;

    if (this.failedAttempts >= 3) {
      this.chuyenStep('locked');
    } else {
      this.currentStep = 'login_error';
    }
  }

  private dangNhapThanhCong(token: string, userData: any): void {
    sessionStorage.setItem('admin_token', token);
    if (userData) {
      sessionStorage.setItem('adminUser', JSON.stringify(userData));
    }
    this.failedAttempts = 0;
    this.attemptsLeft = 3;
    this.onLoginSuccess();
  }

  // --- XỬ LÝ NHẬP Ô TOKEN 2FA ---
  onTokenKeyup(event: any, index: number): void {
    const input = event.target;
    if (input.value && index < 5) {
      const nextInput = input.nextElementSibling;
      if (nextInput) nextInput.focus();
    }
  }

  // --- BƯỚC 2: XÁC THỰC 2FA RSA TOKEN ---
  async xacNhan2FA(): Promise<void> {
    const otp = this.tokenDigits.join('');

    if (!/^\d{6}$/.test(otp)) {
      alert('Vui lòng nhập đủ 6 chữ số mã OTP!');
      return;
    }

    if (!this.adminOtpToken) {
      alert('Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại!');
      this.tokenDigits = ['', '', '', '', '', ''];
      this.chuyenStep('login_form');
      return;
    }

    if (this.isSubmitting) return;
    this.isSubmitting = true;

    try {
      const result = await this.authService.verifyAdminOtp(
        otp,
        this.adminOtpToken
      );

      if (!result.success) {
        alert(result.message);
        this.tokenDigits = ['', '', '', '', '', ''];
        return;
      }

      if (!result.token) {
        alert('Backend không trả về JWT đăng nhập chính thức!');
        return;
      }

      this.dangNhapThanhCong(result.token, result.data);

    } catch (error) {
      console.error('Lỗi xác minh OTP Admin:', error);
      alert('Không thể xác minh OTP. Vui lòng thử lại!');
    } finally {
      this.isSubmitting = false;
    }
  }

  // --- BƯỚC 3: KHÔI PHỤC MẬT KHẨU (CHỈ DÀNH CHO SUPER ADMIN) ---
  guiLaiOTP(): void {
    const email = (this.forgotForm.email || '').trim().toLowerCase();
    if (!email) {
      alert('Vui lòng nhập Email Admin để nhận mã OTP!');
      return;
    }

    this.isCheckingRecovery = true;
    this.http.post<any>('http://localhost:3000/api/store/auth/admin/recovery/check', { email }).subscribe({
      next: (res) => {
        this.isCheckingRecovery = false;
        if (res.success && res.isSuperAdmin) {
          this.isSuperAdminVerified = true;
          this.recoveryToken = res.recoveryToken || '';
          this.resendOtpCountdown = 59;
          if (this.isBrowser) this.startOtpTimer();
          alert('Đã gửi mã OTP đến Email của Super Admin!');
        } else {
          this.hienPopupTuChoi(res.role || 'Staff / Editor', res.message);
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isCheckingRecovery = false;
        if (err.status === 403 && !err.error?.isSuperAdmin) {
          // Xử lý khi tài khoản là Staff hoặc Editor
          this.hienPopupTuChoi(
            err.error?.role || 'Staff / Editor',
            err.error?.message || 'Tài khoản Staff / Editor không được phép tự khôi phục mật khẩu. Vui lòng liên hệ Super Admin!'
          );
        } else {
          alert(err.error?.message || 'Không tìm thấy tài khoản Quản trị với email này!');
        }
        this.cdr.detectChanges();
      }
    });
  }

  hienPopupTuChoi(role: string, message: string): void {
    this.restrictedRole = role;
    this.restrictedMessage = message;
    this.showRestrictedModal = true;
    this.cdr.detectChanges();
  }

  dongPopupRestricted(): void {
    this.showRestrictedModal = false;
    this.chuyenStep('login_form');
  }

  datLaiMatKhau(): void {
    if (!this.forgotForm.email || !this.forgotForm.otp || !this.forgotForm.newPassword) {
      alert('Vui lòng nhập đầy đủ các thông tin bắt buộc (*)!');
      return;
    }
    if (this.forgotForm.newPassword !== this.forgotForm.confirmPassword) {
      alert('Mật khẩu nhập lại không khớp!');
      return;
    }

    this.isSubmitting = true;
    this.http.post<any>('http://localhost:3000/api/store/auth/admin/recovery/reset-password', {
      email: this.forgotForm.email.trim(),
      otp: this.forgotForm.otp.trim(),
      recoveryToken: this.recoveryToken,
      matKhauMoi: this.forgotForm.newPassword
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        alert(res.message || 'Đặt lại mật khẩu Super Admin thành công! Vui lòng đăng nhập lại.');
        this.failedAttempts = 0;
        this.attemptsLeft = 3;
        this.forgotForm = { email: '', otp: '', token2fa: '', newPassword: '', confirmPassword: '' };
        this.chuyenStep('login_form');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err.status === 403) {
          this.hienPopupTuChoi('Staff / Editor', err.error?.message || 'Chỉ Super Admin mới có quyền đặt lại mật khẩu!');
        } else {
          alert(err.error?.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại!');
        }
        this.cdr.detectChanges();
      }
    });
  }

  // --- LOGIC BỘ ĐẾM NGƯỢC ---
  startRsaTimer(): void {
    this.rsaCountdown = 300;
    clearInterval(this.rsaTimer);

    this.rsaTimer = setInterval(() => {
      if (this.rsaCountdown > 0) {
        this.rsaCountdown--;
      } else {
        clearInterval(this.rsaTimer);
        this.adminOtpToken = '';
        this.tokenDigits = ['', '', '', '', '', ''];
        this.loginErrorMessage = 'Mã OTP đã hết hạn. Vui lòng đăng nhập lại.';
        this.currentStep = 'login_form';
        this.stepHistory = [];
        alert('Mã OTP đã hết hạn. Vui lòng đăng nhập lại!');
      }
    }, 1000);
  }

  
startLockTimer(createNewTimestamp: boolean = true): void {
  if (!this.isBrowser) return;

  // Chỉ tạo thời gian khóa mới khi nhập sai 3 lần.
  // Khi F5 sẽ sử dụng thời gian khóa đã lưu.
  if (createNewTimestamp) {
    sessionStorage.setItem(
      'admin_lock_until',
      String(Date.now() + 5 * 60 * 1000)
    );
  }

  // Xóa bộ đếm cũ để tránh chạy trùng nhiều timer.
  clearInterval(this.lockTimer);

  // Chuyển sang giao diện tài khoản bị khóa.
  this.currentStep = 'locked';

  const updateCountdown = (): void => {
    const lockUntil = Number(
      sessionStorage.getItem('admin_lock_until')
    );

    // Tính số giây còn lại dựa vào thời gian thực.
    this.lockCountdown =
      Number.isFinite(lockUntil) && lockUntil > 0
        ? Math.max(
            0,
            Math.ceil((lockUntil - Date.now()) / 1000)
          )
        : 0;

    // Khi hết 5 phút, tự động mở lại form đăng nhập.
    if (this.lockCountdown === 0) {
      clearInterval(this.lockTimer);
      this.lockTimer = null;

      sessionStorage.removeItem('admin_lock_until');

      this.failedAttempts = 0;
      this.attemptsLeft = 3;
      this.stepHistory = [];

      this.currentStep = 'login_form';
    }

    // Quan trọng: bắt Angular cập nhật giao diện ngay.
    this.cdr.detectChanges();
  };

  // Cập nhật ngay khi bắt đầu.
  updateCountdown();

  // Cập nhật đồng hồ mỗi 1 giây.
  if (this.lockCountdown > 0) {
    this.lockTimer = setInterval(updateCountdown, 1000);
  }
}


  startOtpTimer(): void {
    clearInterval(this.otpTimer);
    this.otpTimer = setInterval(() => {
      if (this.resendOtpCountdown > 0) this.resendOtpCountdown--;
      else clearInterval(this.otpTimer);
    }, 1000);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  clearAllTimers(): void {
    clearInterval(this.lockTimer);
    clearInterval(this.rsaTimer);
    clearInterval(this.otpTimer);
  }

  onLogoError(event: any): void {
    event.target.src = 'data:image/svg+xml;utf8, <svg xmlns="http://www.w3.org/2000/svg" width="81" height="85" viewBox="0 0 24 24" fill="%2350407A"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>';
  }

  onLoginSuccess(): void {
    const token = sessionStorage.getItem('admin_token');
    if (!token) {
      this.router.navigate(['/admin/login']);
      return;
    }
    this.router.navigate(['/admin/dashboard']);
  }
}