import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectorRef,
  inject
} from '@angular/core';

import { Router } from '@angular/router';

import {
  AuthService,
  SHOW_TEST_OTP
} from '../../services/auth';

import { ToastService } from '../../services/toast';
import { OtpInputComponent } from '../otp-input/otp-input';

@Component({
  selector: 'app-dang-nhap',
  templateUrl: './dang-nhap.html',
  styleUrls: ['./dang-nhap.css'],
  standalone: false
})
export class DangNhapComponent implements OnInit, OnDestroy {

  // Hiển thị mã OTP thử nghiệm nếu AuthService cho phép
  readonly showHint = SHOW_TEST_OTP;

  // ================================
  // DỮ LIỆU ĐĂNG NHẬP
  // ================================

  loginUser = '';
  loginPass = '';

  rememberMe = true;

  showPass = false;

  // ================================
  // TRẠNG THÁI LOGIN / OTP
  // ================================

  step: 'password' | 'otp' = 'password';

  otpCode = '';

  @ViewChild(OtpInputComponent)
  otpBox?: OtpInputComponent;

  // ================================
  // HIỂN THỊ LỖI
  // ================================

  hasError = false;
  errorMessage = '';

  // ================================
  // TIMER
  // ================================

  private tick?: ReturnType<typeof setInterval>;

  // ================================
  // ROUTER
  // ================================

  private readonly router = inject(Router);

  // ================================
  // PHÍM TẮT ADMIN
  // ================================

  private readonly ADMIN_KEY = 'STEAL2026';

  private typedKeys = '';

  // ================================
  // CONSTRUCTOR
  // ================================

  constructor(
    public auth: AuthService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.tick = setInterval(
      () => undefined,
      1000
    );
  }

  ngOnDestroy(): void {
    if (this.tick) {
      clearInterval(this.tick);
    }
  }

  get resendLabel(): string {
    const s = this.auth.otpCooldownLeft;

    return s > 0
      ? `Gửi lại mã (${s}s)`
      : 'Gửi lại mã';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('window:keydown', ['$event'])
  onSecretKey(event: KeyboardEvent): void {
    if (!event || typeof event.key !== 'string') {
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    this.typedKeys = (
      this.typedKeys + event.key.toUpperCase()
    ).slice(-this.ADMIN_KEY.length);

    if (this.typedKeys !== this.ADMIN_KEY) {
      return;
    }

    this.typedKeys = '';

    this.loginUser = '';
    this.loginPass = '';

    try {
      sessionStorage.setItem(
        'admin_gate_passed',
        '1'
      );
    } catch {
      // bỏ qua
    }

    this.close();

    this.router.navigate(['/admin/login']);
  }

  clearError(): void {
    this.hasError = false;
    this.errorMessage = '';
  }

  togglePasswordVisibility(): void {
    this.showPass = !this.showPass;
  }

  // ================================
  // ĐĂNG NHẬP
  // ================================

  async onLogin(): Promise<void> {
    // Kiểm tra tài khoản + mật khẩu
    if (
      !this.loginUser.trim() ||
      !this.loginPass
    ) {
      this.hasError = true;
      this.errorMessage =
        'Vui lòng nhập tên tài khoản (hoặc email) và mật khẩu.';
      this.cdr.detectChanges();
      return;
    }

    // Gọi API đăng nhập
    const result = await this.auth.login(
      this.loginUser,
      this.loginPass,
      this.rememberMe
    );

    console.log('LOGIN RESULT:', result);

    // ĐĂNG NHẬP THẤT BẠI
    if (!result.success) {
      this.hasError = true;
      this.errorMessage = result.message;
      this.cdr.detectChanges();
      return;
    }

    // NẾU CÓ OTP
    if (result.needsOtp) {
      this.step = 'otp';
      this.otpCode = '';
      this.clearError();
      this.cdr.detectChanges();
      return;
    }

    // ĐĂNG NHẬP THÀNH CÔNG: Đóng modal & cập nhật giao diện ngay lập tức
    this.clearError();
    this.close();
    this.toast.success(result.message);
    this.cdr.detectChanges();
  }

  onOtpChange(code: string): void {
    this.otpCode = code;
    this.clearError();
  }

  submitOtp(): void {
    if (this.otpCode.length < 6) {
      this.hasError = true;
      this.errorMessage =
        'Vui lòng nhập đủ 6 chữ số mã xác minh!';
      this.cdr.detectChanges();
      return;
    }

    const result = this.auth.completeLogin(this.otpCode);

    if (!result.success) {
      this.hasError = true;
      this.errorMessage = result.message;
      this.otpBox?.clear();
      this.cdr.detectChanges();
      return;
    }

    this.toast.success(result.message);
    this.cdr.detectChanges();
  }

  onOtpInput(code: string): void {
    this.otpCode = code;
    this.clearError();
  }

  resendOtp(): void {
    const result = this.auth.resendOtp();

    if (!result.success) {
      this.hasError = true;
      this.errorMessage = result.message;
      this.cdr.detectChanges();
      return;
    }

    this.otpBox?.clear();
    this.clearError();
    this.toast.success(result.message);
    this.cdr.detectChanges();
  }

  backToPassword(): void {
    this.auth.cancelPendingLogin();
    this.step = 'password';
    this.loginPass = '';
    this.clearError();
  }

  get currentOtp(): string {
    return this.auth.currentOtp;
  }

  switchToRegister(): void {
    this.auth.cancelPendingLogin();
    this.auth.openModal('register');
  }

  close(): void {
    this.auth.cancelPendingLogin();
    this.auth.closeModal();
  }
}