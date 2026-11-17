import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, EMAIL_REGEX, PASSWORD_HINT, SHOW_TEST_OTP } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { OtpInputComponent } from '../../shared/otp-input/otp-input';

@Component({
  selector: 'app-khoi-phuc',
  templateUrl: './khoi-phuc.html',
  styleUrls: ['./khoi-phuc.css'],
  standalone: false
})
export class KhoiPhucComponent implements OnInit, OnDestroy {
  readonly showTestOtp = SHOW_TEST_OTP;

  step = 1;
  recoveryEmail = '';
  emailErrorMsg = '';
  accountName = '';

  @ViewChild(OtpInputComponent) otpBox?: OtpInputComponent;
  otpCode = '';
  otpErrorMsg = '';

  newPass = '';
  confirmNewPass = '';
  showPass = false;
  showConfirmPass = false;
  passErrorMsg = '';
  isSubmittingEmail = false;

  constructor(public authService: AuthService, private router: Router, private toast: ToastService) {}

  private tick?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.authService.resetOtp();

    this.step = 1;
    this.recoveryEmail = '';
    this.emailErrorMsg = '';
    this.accountName = '';
    this.otpCode = '';
    this.otpErrorMsg = '';
    this.newPass = '';
    this.confirmNewPass = '';
    this.showPass = false;
    this.showConfirmPass = false;
    this.passErrorMsg = '';

    this.tick = setInterval(() => undefined, 1000);
  }

  ngOnDestroy(): void {
    if (this.tick) clearInterval(this.tick);
    this.authService.resetOtp();
  }

  get resendLabel(): string {
    const s = this.authService.otpCooldownLeft;
    return s > 0 ? `Gửi lại mã (${s}s)` : 'Gửi lại mã';
  }

  /** Quay lại bước nhập email. */
  backToStep1(): void {
    this.authService.resetOtp();
    this.otpErrorMsg = '';
    this.otpCode = '';
    this.recoveryEmail = '';
    this.accountName = '';
    this.emailErrorMsg = '';
    this.step = 1;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  get currentOtp(): string {
    return this.authService.currentOtp;
  }

  close(): void {
    this.authService.resetOtp();
    this.router.navigate(['/']);
  }

  /* ---------- Bước 1: email ---------- */

  
async submitRecoveryEmail(): Promise<void> {
  if (this.isSubmittingEmail || this.step !== 1) return;

  const email = this.recoveryEmail.trim();

  if (!email) {
    this.emailErrorMsg = 'Vui lòng nhập địa chỉ email!';
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    this.emailErrorMsg = 'Địa chỉ email không đúng định dạng!';
    return;
  }

  this.isSubmittingEmail = true;

  try {
    const started = await this.authService.startRecovery(email);

    if (!started.success) {
      this.emailErrorMsg = started.message;
      return;
    }

    this.recoveryEmail = email;
    this.accountName = started.username ?? '';
    this.emailErrorMsg = '';
    this.otpCode = '';

    this.step = 2;

  } finally {
    this.isSubmittingEmail = false;
  }
}


  /* ---------- Bước 2: OTP ---------- */

  onOtpChange(code: string): void {
    this.otpCode = code;
    this.otpErrorMsg = '';
  }

  
submitOtp(): void {

  if (this.otpCode.length < 6) {
    this.otpErrorMsg =
      'Vui lòng nhập đủ 6 chữ số mã xác minh!';
    return;
  }

  const result = this.authService.verifyOtp(
    this.otpCode,
    'recovery'
  );

  if (result.success) {

    this.otpErrorMsg = '';

    // Luôn làm trống hai ô mật khẩu
    // trước khi chuyển sang bước đặt mật khẩu mới
    this.newPass = '';
    this.confirmNewPass = '';

    // Đặt lại trạng thái hiển thị mật khẩu
    this.showPass = false;
    this.showConfirmPass = false;

    // Xóa lỗi mật khẩu trước đó
    this.passErrorMsg = '';

    // Chuyển sang bước 3
    this.step = 3;

  } else {

    this.otpErrorMsg = result.message;
    this.otpBox?.clear();

  }
}


  resendOtp(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const result = this.authService.resendOtp();
    if (!result.success) {
      this.otpErrorMsg = result.message;
      return;
    }
    this.otpBox?.clear();
    this.otpErrorMsg = '';
    this.toast.success(result.message);
  }

  /* ---------- Bước 3: mật khẩu mới ---------- */

get hasUppercase(): boolean {
  return /[A-Z]/.test(this.newPass);
}

  get hasMinLength(): boolean { return this.newPass.length >= 8; }
  get hasLetterAndNumber(): boolean { return /[a-zA-Z]/.test(this.newPass) && /\d/.test(this.newPass); }
  get hasSpecialChar(): boolean { return /[^a-zA-Z0-9]/.test(this.newPass); }

  async finishRecovery(): Promise<void> {
    
if (
  !this.hasMinLength ||
  !this.hasLetterAndNumber ||
  !this.hasSpecialChar ||
  !this.hasUppercase
) {
  this.passErrorMsg = PASSWORD_HINT;
  return;
}

    if (this.newPass !== this.confirmNewPass) {
      this.passErrorMsg = 'Mật khẩu xác nhận không khớp!';
      return;
    }
    const result = await this.authService.resetPassword(this.recoveryEmail, this.newPass);
    if (!result.success) {
      this.passErrorMsg = result.message;
      return;
    }
    this.passErrorMsg = '';
    this.toast.success(`Khôi phục tài khoản ${this.accountName} thành công! Hãy đăng nhập bằng mật khẩu mới.`);
    this.router.navigate(['/']);
    this.authService.openModal('login');
  }
}
