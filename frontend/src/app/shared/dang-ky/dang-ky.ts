import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectorRef
} from '@angular/core';

import { Router } from '@angular/router';

import {
  AuthService,
  EMAIL_REGEX,
  PASSWORD_HINT,
  SHOW_TEST_OTP
} from '../../services/auth';

import { ToastService } from '../../services/toast';
import { OtpInputComponent } from '../otp-input/otp-input';

@Component({
  selector: 'app-dang-ky',
  templateUrl: './dang-ky.html',
  styleUrls: ['./dang-ky.css'],
  standalone: false
})
export class DangKyComponent implements OnInit, OnDestroy {

get hasUppercase(): boolean {
  return /[A-Z]/.test(this.regPass);
}

  readonly showTestOtp = SHOW_TEST_OTP;

  step = 1;

  // =========================================================
  // BƯỚC 1 - EMAIL
  // =========================================================

  regEmail = '';
  regEmailConfirm = '';
  regCountry = 'Việt Nam';

  isHuman = false;
  acceptTerms = false;

  emailError = '';
  emailConfirmError = '';
  step1Error = '';

  /*
   * Đang kiểm tra email trên MongoDB.
   *
   * Dùng biến này để:
   * - Không cho người dùng bấm nút nhiều lần
   * - Không gửi nhiều request check-email
   * - Tránh tình trạng email mới phải bấm 2 lần
   */
  isCheckingEmail = false;

  /*
   * ID của request kiểm tra email hiện tại.
   *
   * Dùng để tránh trường hợp có nhiều request cũ
   * trả kết quả sau request mới và ghi đè dữ liệu.
   */
  private emailCheckRequestId = 0;

  // =========================================================
  // BƯỚC 2 - OTP
  // =========================================================

  @ViewChild(OtpInputComponent)
  otpBox?: OtpInputComponent;

  otpCode = '';
  otpErrorMsg = '';

  // =========================================================
  // BƯỚC 3 - TÀI KHOẢN
  // =========================================================

  regUsername = '';
  regPass = '';
  regConfirmPass = '';

  showPass = false;
  showConfirmPass = false;

  usernameError = '';
  passMismatchMsg = '';
  step3Error = '';

isCheckingUsername = false;
isSubmittingRegistration = false;
registeredUsername = '';

private usernameCheckTimer?: ReturnType<typeof setTimeout>;
private usernameCheckRequestId = 0;
private destroyed = false;


  private tick?: ReturnType<typeof setInterval>;

  constructor(
    public auth: AuthService,
    private router: Router,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  // =========================================================
  // LIFECYCLE
  // =========================================================

  ngOnInit(): void {
    this.auth.tempRegisterData = {};

    this.auth.resetOtp();

    this.isCheckingEmail = false;

    this.emailCheckRequestId = 0;

    this.tick = setInterval(() => undefined, 1000);
  }

  ngOnDestroy(): void {

this.destroyed = true;
clearTimeout(this.usernameCheckTimer);
this.usernameCheckRequestId++;

    if (this.tick) {
      clearInterval(this.tick);
    }

    /*
     * Tăng request ID để vô hiệu hóa
     * các request cũ nếu component bị destroy.
     */
    this.emailCheckRequestId++;

    this.isCheckingEmail = false;

    this.auth.resetOtp();
  }

  // =========================================================
  // OTP COOLDOWN
  // =========================================================

  get resendLabel(): string {
    const seconds = this.auth.otpCooldownLeft;

    return seconds > 0
      ? `Gửi lại mã (${seconds}s)`
      : 'Gửi lại mã';
  }

  // =========================================================
  // QUAY LẠI BƯỚC 1
  // =========================================================

  backToStep1(): void {
    /*
     * Vô hiệu hóa request check-email cũ
     * nếu người dùng quay lại bước 1.
     */
    this.emailCheckRequestId++;

    this.auth.tempRegisterData = {};

    this.auth.resetOtp();

    this.otpErrorMsg = '';
    this.otpCode = '';

    this.emailError = '';
    this.emailConfirmError = '';
    this.step1Error = '';

    this.isCheckingEmail = false;

    this.step = 1;
  }

  // =========================================================
  // ESC - ĐÓNG MODAL
  // =========================================================

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  get currentOtp(): string {
    return this.auth.currentOtp;
  }

  // =========================================================
  // BƯỚC 1 - KIỂM TRA EMAIL KHI NHẬP
  // =========================================================

  onEmailChange(): void {
    /*
     * Nếu người dùng đang sửa email,
     * xóa lỗi tổng hợp cũ.
     */
    this.step1Error = '';

    const email = this.regEmail.trim();

    if (!email) {
      this.emailError = '';
    }
    else if (!EMAIL_REGEX.test(email)) {
      this.emailError =
        'Địa chỉ email không đúng định dạng!';
    }
    else {
      /*
       * Không kiểm tra email tồn tại ở đây.
       *
       * Email tồn tại sẽ được kiểm tra trực tiếp
       * trên MongoDB khi người dùng bấm "Tiếp tục".
       */
      this.emailError = '';
    }

    this.onEmailConfirmChange();
  }

  // =========================================================
  // KIỂM TRA EMAIL XÁC NHẬN
  // =========================================================

  onEmailConfirmChange(): void {
    this.step1Error = '';

    const email = this.regEmail.trim();
    const confirm = this.regEmailConfirm.trim();

    if (
      confirm &&
      confirm.toLowerCase() !== email.toLowerCase()
    ) {
      this.emailConfirmError =
        'Email xác nhận không khớp!';
    }
    else {
      this.emailConfirmError = '';
    }
  }

  clearStep1Error(): void {
    this.step1Error = '';
  }

  // =========================================================
  // THỎA THUẬN ĐĂNG KÝ
  // =========================================================

  openTerms(event: Event): void {
    event.preventDefault();

    this.auth.closeModal();

    this.router.navigate([
      '/thoa-thuan-dang-ky'
    ]);
  }

  // =========================================================
  // SUBMIT BƯỚC 1
  // =========================================================

  async submitStep1(): Promise<void> {

    /*
     * ========================================================
     * CHẶN BẤM NHIỀU LẦN
     * ========================================================
     *
     * Nếu request trước vẫn đang chạy,
     * không cho tạo request mới.
     */
    if (this.isCheckingEmail) {
      return;
    }

    // =======================================================
    // XÓA LỖI CŨ
    // =======================================================

    this.step1Error = '';

    // =======================================================
    // LẤY DỮ LIỆU
    // =======================================================

    const email = this.regEmail.trim();
    const confirmEmail = this.regEmailConfirm.trim();

    // =======================================================
    // 1. KIỂM TRA EMAIL
    // =======================================================

    if (!email) {
      this.emailError =
        'Vui lòng nhập email!';

      this.step1Error =
        this.emailError;

      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      this.emailError =
        'Địa chỉ email không đúng định dạng!';

      this.step1Error =
        this.emailError;

      return;
    }

    this.emailError = '';

    // =======================================================
    // 2. KIỂM TRA EMAIL XÁC NHẬN
    // =======================================================

    if (!confirmEmail) {
      this.emailConfirmError =
        'Vui lòng nhập email xác nhận!';

      this.step1Error =
        this.emailConfirmError;

      return;
    }

    if (
      confirmEmail.toLowerCase() !==
      email.toLowerCase()
    ) {
      this.emailConfirmError =
        'Email xác nhận không khớp!';

      this.step1Error =
        this.emailConfirmError;

      return;
    }

    this.emailConfirmError = '';

    // =======================================================
    // 3. KIỂM TRA CAPTCHA
    // =======================================================

    if (!this.isHuman) {
      this.step1Error =
        'Vui lòng xác nhận bạn là con người!';

      return;
    }

    // =======================================================
    // 4. KIỂM TRA ĐIỀU KHOẢN
    // =======================================================

    if (!this.acceptTerms) {
      this.step1Error =
        'Bạn cần đồng ý với Thỏa thuận đăng ký để tiếp tục!';

      return;
    }

    // =======================================================
    // 5. BẮT ĐẦU KIỂM TRA MONGODB
    // =======================================================

    this.isCheckingEmail = true;

    /*
     * Tạo ID riêng cho request hiện tại.
     *
     * Nếu somehow có request cũ trả về sau,
     * nó sẽ không được phép thay đổi trạng thái mới.
     */
    const requestId = ++this.emailCheckRequestId;

    try {

      console.log(
        'ĐANG KIỂM TRA EMAIL:',
        email
      );

      const emailExists =
        await this.auth.checkEmailExists(email);

      /*
       * Nếu request này không còn là request mới nhất
       * thì bỏ qua kết quả.
       */
      if (requestId !== this.emailCheckRequestId) {
        return;
      }

      console.log(
        'KẾT QUẢ CHECK EMAIL:',
        {
          email,
          emailExists
        }
      );

      // =====================================================
      // 6. EMAIL ĐÃ TỒN TẠI
      // =====================================================

      if (emailExists) {
        const duplicateEmailMessage =
          'Email này đã được sử dụng để đăng ký tài khoản. Vui lòng sử dụng email khác!';

        this.emailError = duplicateEmailMessage;

        // Bắt Angular cập nhật giao diện ngay
        this.cdr.detectChanges();

        return;
      }

      // =====================================================
      // 7. EMAIL MỚI
      // =====================================================

      const saved =
        this.auth.saveRegisterStep1(
          email,
          this.regCountry
        );

      if (!saved) {

        this.step1Error =
          'Không thể bắt đầu đăng ký. Vui lòng kiểm tra lại email!';

        return;
      }

      // =====================================================
      // 8. EMAIL HỢP LỆ -> OTP
      // =====================================================

      console.log(
      'EMAIL HỢP LỆ -> CHUYỂN SANG OTP'
      );

      this.step = 2;

      // Ép Angular cập nhật giao diện ngay
      this.cdr.detectChanges();

    }
    catch (error) {

      /*
       * Chỉ xử lý lỗi nếu đây vẫn là request hiện tại.
       */
      if (requestId !== this.emailCheckRequestId) {
        return;
      }

      console.error(
        'LỖI KIỂM TRA EMAIL TRÊN MONGODB:',
        error
      );

      this.step1Error =
        'Không thể kiểm tra email. Vui lòng kiểm tra kết nối máy chủ và thử lại!';

    }
    finally {

      /*
       * Chỉ mở khóa nếu đây vẫn là request hiện tại.
       */
      if (requestId === this.emailCheckRequestId) {
        this.isCheckingEmail = false;
      }
    }
  }

  // =========================================================
  // BƯỚC 2 - OTP
  // =========================================================

  onOtpChange(code: string): void {
    this.otpCode = code;

    this.otpErrorMsg = '';
  }

  // =========================================================
  // GỬI LẠI OTP
  // =========================================================

  resendOtp(event: Event): void {
    event.preventDefault();

    const result =
      this.auth.resendOtp();

    if (!result.success) {

      this.otpErrorMsg =
        result.message;

      return;
    }

    this.otpBox?.clear();

    this.otpErrorMsg = '';

    this.toast.success(
      result.message
    );
  }

  // =========================================================
  // XÁC NHẬN OTP
  // =========================================================

  submitOtp(): void {

    if (this.otpCode.length < 6) {

      this.otpErrorMsg =
        'Vui lòng nhập đủ 6 chữ số mã xác minh!';

      return;
    }

    const result =
      this.auth.verifyOtp(
        this.otpCode,
        'register'
      );

    if (!result.success) {

      this.otpErrorMsg =
        result.message;

      this.otpBox?.clear();

      return;
    }

    this.otpErrorMsg = '';

    this.step = 3;
  }

  // =========================================================
  // BƯỚC 3 - PASSWORD
  // =========================================================

  get hasMinLength(): boolean {
    return this.regPass.length >= 8;
  }

  get hasLetterAndNumber(): boolean {
    return (
      /[a-zA-Z]/.test(this.regPass) &&
      /\d/.test(this.regPass)
    );
  }

  get hasSpecialChar(): boolean {
    return /[^a-zA-Z0-9]/.test(this.regPass);
  }

  // =========================================================
  // USERNAME
  // =========================================================

 
onUsernameChange(): void {
  this.usernameError = '';
  this.step3Error = '';

  // Hủy lần kiểm tra trước khi người dùng tiếp tục gõ
  clearTimeout(this.usernameCheckTimer);

  const username = this.regUsername.trim();
  const requestId = ++this.usernameCheckRequestId;

  this.isCheckingUsername = false;

  if (!username) return;

  // Chờ 400ms sau khi ngừng gõ mới gọi API
  this.usernameCheckTimer = setTimeout(async () => {
    if (
      this.destroyed ||
      requestId !== this.usernameCheckRequestId
    ) {
      return;
    }

    this.isCheckingUsername = true;
    this.cdr.detectChanges();

    try {
      const exists =
        await this.auth.checkUsernameExists(username);

      // Bỏ kết quả cũ nếu người dùng đã thay tên
      if (
        this.destroyed ||
        requestId !== this.usernameCheckRequestId ||
        username !== this.regUsername.trim()
      ) {
        return;
      }

      this.usernameError = exists
        ? 'Tên tài khoản này đã tồn tại. Vui lòng chọn tên khác!'
        : '';

    } catch (error) {
      console.error('Lỗi kiểm tra tên tài khoản:', error);

      if (
        !this.destroyed &&
        requestId === this.usernameCheckRequestId
      ) {
        this.usernameError =
          'Không thể kiểm tra tên tài khoản. Vui lòng thử lại!';
      }

    } finally {
      if (
        !this.destroyed &&
        requestId === this.usernameCheckRequestId
      ) {
        this.isCheckingUsername = false;
        this.cdr.detectChanges();
      }
    }
  }, 400);
}


  // =========================================================
  // XÓA LỖI BƯỚC 3
  // =========================================================

  clearStep3Error(): void {

    this.step3Error = '';

    this.passMismatchMsg =
      this.regConfirmPass &&
      this.regPass !== this.regConfirmPass
        ? 'Mật khẩu xác nhận không khớp!'
        : '';
  }

  // =========================================================
  // HOÀN TẤT ĐĂNG KÝ
  // =========================================================

  
async finish(): Promise<void> {
  // Ngăn bấm Hoàn tất nhiều lần
  if (this.isSubmittingRegistration) return;

  const username = this.regUsername.trim();

  this.step3Error = '';
  this.passMismatchMsg = '';

  // 1. Kiểm tra tên tài khoản
  if (!username) {
    this.usernameError = 'Vui lòng nhập tên tài khoản!';
    return;
  }

  // 2. Kiểm tra mật khẩu
  if (!this.regPass || !this.regConfirmPass) {
    this.step3Error = 'Vui lòng nhập đầy đủ mật khẩu!';
    return;
  }

  if (this.regPass !== this.regConfirmPass) {
    this.passMismatchMsg =
      'Mật khẩu xác nhận không khớp!';
    return;
  }

  if (
    !this.hasMinLength ||
    !this.hasLetterAndNumber ||
    !this.hasSpecialChar ||
    !this.hasUppercase
  ) {
    this.step3Error = PASSWORD_HINT;
    return;
  }

  this.isSubmittingRegistration = true;

  // Ngăn kết quả kiểm tra lúc gõ ghi đè kết quả submit
  clearTimeout(this.usernameCheckTimer);
  ++this.usernameCheckRequestId;
  this.isCheckingUsername = false;

  try {
    // 3. Kiểm tra trùng tên trực tiếp trên MongoDB
    const usernameExists =
      await this.auth.checkUsernameExists(username);

    if (this.destroyed) return;

    if (usernameExists) {
      this.usernameError =
        'Tên tài khoản này đã tồn tại. Vui lòng chọn tên khác!';
      return;
    }

    this.usernameError = '';

    // 4. Gọi API đăng ký thật
    const result = await this.auth.finishRegister(
      username,
      this.regPass,
      this.regConfirmPass
    );

    if (this.destroyed) return;

    // 5. Backend từ chối đăng ký
    if (!result.success) {
      if (
        /tên đăng nhập|tên tài khoản|username/i.test(
          result.message
        )
      ) {
        this.usernameError = result.message;
      } else {
        this.step3Error = result.message;
      }

      return;
    }

    // 6. Đăng ký thành công: giữ modal để thông báo
    this.registeredUsername = username;
    this.step = 4;

    // Không gọi this.close() tại đây.
    // Người dùng tự bấm "Đăng nhập ngay".

  } catch (error) {
    console.error('Lỗi hoàn tất đăng ký:', error);

    if (!this.destroyed) {
      this.step3Error =
        'Không thể hoàn tất đăng ký. Vui lòng thử lại!';
    }

  } finally {
    this.isSubmittingRegistration = false;

    if (!this.destroyed) {
      this.cdr.detectChanges();
    }
  }
}


  // =========================================================
  // CHUYỂN SANG LOGIN
  // =========================================================

  switchToLogin(): void {

    this.close();

    this.auth.openModal('login');
  }

  // =========================================================
  // ĐÓNG FORM
  // =========================================================

  close(): void {

    /*
     * Vô hiệu hóa các request check-email cũ
     * khi đóng form.
     */
    this.emailCheckRequestId++;

    this.auth.tempRegisterData = {};

    this.auth.resetOtp();

    this.isCheckingEmail = false;

    this.auth.closeModal();
  }
}
