
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import {
  AccountSettingsService,
  EMAIL_REGEX,
  NO_PHONE,
  SHOW_TEST_OTP
} from '../services/account-settings';

import { AuthService } from '../services/auth';
import { ConfirmService } from '../services/confirm';
import { NotificationService } from '../services/notification';
import {
  CookieSettings,
  PreferencesService,
  ProfanityMode
} from '../services/preferences';
import { ToastService } from '../services/toast';
import { UserProfileService } from '../services/user-profile';
import { OtpInputComponent } from '../shared/otp-input/otp-input';

type OtpPurpose = 'email' | 'phone';

type SettingsTab =
  | 'chi-tiet'
  | 'tuy-chinh'
  | 'thong-bao'
  | 'bao-mat'
  | 'du-lieu';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CUSTOM_WORDS = 20;
const MAX_WORD_LENGTH = 30;

@Component({
  selector: 'app-cai-dat-tai-khoan',
  templateUrl: './cai-dat-tai-khoan.html',
  styleUrls: ['./cai-dat-tai-khoan.css'],
  standalone: false
})
export class CaiDatTaiKhoanComponent implements OnInit, OnDestroy {

  readonly noPhone = NO_PHONE;
  readonly showTestOtp = SHOW_TEST_OTP;

  activeTab: SettingsTab = 'chi-tiet';
  subMode: 'view' | 'edit-email' | 'edit-phone' = 'view';

  // EMAIL VÀ SỐ ĐIỆN THOẠI
  newEmailInput = '';
  emailErrorMsg = '';

  newPhoneInput = '';
  phoneErrorMsg = '';

  // OTP ĐỔI EMAIL / SĐT
  showOtpModal = false;
  otpPurpose: OtpPurpose = 'email';

  @ViewChild('otpBox')
  otpBox?: OtpInputComponent;

  otpCode = '';
  otpErrorMessage = '';
  otpInfoMessage = '';

  isOtpLocked = false;
  isOtpSuccess = false;
  resendCooldown = 0;

  // XÓA TÀI KHOẢN
  showDeleteModal = false;
  confirmDeleteText = '';
  deleteStep = 0;

  @ViewChild('deleteOtpBox')
  deleteOtpBox?: OtpInputComponent;

  deleteOtpCode = '';
  deleteOtpErrorMsg = '';
  deleteOtpInfoMsg = '';
  deleteResendCooldown = 0;
  deleteOtpVerified = false; // OTP 3/3 đã xác minh, cho phép thử lại API nếu lỗi

  // TÙY CHỈNH CỬA HÀNG
  matureContentFilter = false;
  frequentViolence = false;
  nuditySome = false;
  nudityFrequent = false;
  adultOnlyNudity = false;

  profanityFilterOption: ProfanityMode = 'custom_only';
  customProfanityWords: string[] = [];

  // CÀI ĐẶT THÔNG BÁO
  notifyWishlistSale = true;
  notifyPurchaseReceipt = true;
  notifyNewsEvents = false;
  notifyFriendRequest = true;
  notifyGameUpdates = true;

  // BẢO MẬT
  oldPasswordInput = '';
  newPasswordInput = '';
  confirmPasswordInput = '';
  passwordErrorMsg = '';

  isSavingAccount = false;
  isDeletingAccount = false;

  // COOKIE
  cookies: CookieSettings = {
    recentApps: true,
    analytics: true,
    youtube: true,
    vimeo: false,
    sketchfab: true,
    feedbackRequests: false,
    frameRateData: false,
    pcSaved: false
  };

  // SUBSCRIPTION VÀ TIMER
  private authSub?: Subscription;
  private destroyed = false;

  private timerInterval:
    ReturnType<typeof setInterval> | null = null;

  private deleteTimerInterval:
    ReturnType<typeof setInterval> | null = null;

  private lockTimeout:
    ReturnType<typeof setTimeout> | null = null;

  constructor(
    public accountService: AccountSettingsService,
    public userProfileService: UserProfileService,
    public authService: AuthService,
    private preferences: PreferencesService,
    private notifications: NotificationService,
    private confirm: ConfirmService,
    private toast: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  // ==========================================
  // KHỞI TẠO VÀ DỌN DẸP
  // ==========================================

  ngOnInit(): void {
    this.loadDrafts();

    this.authSub = this.authService.currentUser$
      .subscribe(() => {

        this.loadDrafts();
        this.updateView();

        // Đồng bộ thông tin thật từ MongoDB
        void this.accountService.refreshFromApi()
          .then(() => this.updateView())
          .catch(err => {
            console.warn(
              'Không đồng bộ được tài khoản:',
              err
            );
          });

      });
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.authSub?.unsubscribe();

    this.clearTimer();
    this.clearDeleteTimer();

    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout);
      this.lockTimeout = null;
    }

    this.accountService.cancelOtp();
  }

  private updateView(): void {
    if (!this.destroyed) {
      this.cdr.detectChanges();
    }
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  get phonePlaceholder(): string {
    return this.accountService.phonePlaceholder;
  }

  get is2FAEnabled(): boolean {
    return this.accountService.twoFactorEnabled;
  }

  get otpCodeHint(): string {
    return this.accountService.currentOtpCode;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private loadDrafts(): void {
    const p = this.preferences.prefs;

    this.matureContentFilter = p.hide.mature;
    this.frequentViolence = p.hide.violence;
    this.nuditySome = p.hide.nuditySome;
    this.nudityFrequent = p.hide.nudityFrequent;
    this.adultOnlyNudity = p.hide.adultOnly;

    this.profanityFilterOption = p.profanityMode;
    this.customProfanityWords = [...p.customWords];
    this.cookies = { ...p.cookies };

    const n = this.notifications.prefs;

    this.notifyWishlistSale = n.wishlistSale;
    this.notifyPurchaseReceipt = n.purchase;
    this.notifyNewsEvents = n.news;
    this.notifyFriendRequest = n.friend;
    this.notifyGameUpdates = n.gameUpdate;
  }

  // ==========================================
  // TAB 1 - ĐỔI EMAIL
  // ==========================================

  startChangeEmail(): void {
    this.subMode = 'edit-email';
    this.newEmailInput = '';
    this.emailErrorMsg = '';
  }

  cancelChangeEmail(): void {
    this.subMode = 'view';
    this.emailErrorMsg = '';
  }

  confirmNewEmail(): void {
    const email = this.newEmailInput.trim().toLowerCase();

    if (!EMAIL_REGEX.test(email)) {
      this.emailErrorMsg =
        'Địa chỉ email mới không đúng định dạng!';
      return;
    }

    if (
      email ===
      this.accountService.accountInfo.email.trim().toLowerCase()
    ) {
      this.emailErrorMsg =
        'Email mới không được trùng email hiện tại!';
      return;
    }

    // Email trùng được kiểm tra thật tại MongoDB
    this.emailErrorMsg = '';
    this.newEmailInput = email;

    this.openOtpPopup('email');
  }

  // ==========================================
  // TAB 1 - SỐ ĐIỆN THOẠI
  // ==========================================

  startChangePhone(): void {
    this.subMode = 'edit-phone';

    this.newPhoneInput = this.accountService.hasPhone
      ? this.accountService.accountInfo.phone
      : '';

    this.phoneErrorMsg = '';
  }

  cancelChangePhone(): void {
    this.subMode = 'view';
    this.phoneErrorMsg = '';
  }

  confirmNewPhone(): void {
    const phone = this.newPhoneInput.trim();

    if (!this.accountService.isValidPhone(phone)) {
      this.phoneErrorMsg =
        this.accountService.phoneErrorMessage;
      return;
    }

    if (phone === this.accountService.accountInfo.phone) {
      this.phoneErrorMsg =
        'Số điện thoại mới trùng số hiện tại!';
      return;
    }

    this.phoneErrorMsg = '';
    this.openOtpPopup('phone');
  }

 

async removePhone(): Promise<void> {
  if (
    this.isSavingAccount ||
    !this.accountService.hasPhone
  ) {
    return;
  }

  const ok = await this.confirm.ask({
    title: 'Gỡ số điện thoại?',
    message:
      'Bạn có chắc chắn muốn gỡ số điện thoại khỏi tài khoản STEAL?',
    confirmText: 'Gỡ số điện thoại',
    cancelText: 'Hủy bỏ',
    danger: true
  });

  if (!ok || this.destroyed) return;

  this.isSavingAccount = true;
  this.phoneErrorMsg = '';
  this.updateView();

  try {
    const result =
      await this.accountService.removePhone();

    if (!result.ok) {
      this.phoneErrorMsg = result.message;
      this.toast.warning(result.message);
      return;
    }

    // MongoDB đã xác nhận số điện thoại trống
    this.subMode = 'view';
    this.newPhoneInput = '';
    this.phoneErrorMsg = '';

    this.toast.success(result.message);

  } catch (error) {
    console.error('Lỗi gỡ số điện thoại:', error);

    this.toast.warning(
      'Không thể gỡ số điện thoại. Vui lòng thử lại!'
    );

  } finally {
    this.isSavingAccount = false;
    this.updateView();
  }
}



  // ==========================================
  // ĐĂNG XUẤT THIẾT BỊ KHÁC
  // ==========================================

  async logoutAllDevices(): Promise<void> {
    if (this.accountService.activeDevices.length <= 1) {
      this.toast.warning(
        'Không có thiết bị nào khác đang đăng nhập.'
      );
      return;
    }

    const ok = await this.confirm.ask({
      title: 'Đăng xuất các thiết bị khác?',
      message:
        'Tất cả thiết bị khác (trừ thiết bị này) sẽ bị đăng xuất khỏi tài khoản của bạn.',
      confirmText: 'Đăng xuất tất cả',
      danger: true
    });

    if (!ok || this.destroyed) return;

    this.accountService.logoutOtherDevices();

    this.toast.success(
      'Đã đăng xuất khỏi tất cả thiết bị khác thành công!'
    );

    this.updateView();
  }

  // ==========================================
  // OTP ĐỔI EMAIL / SỐ ĐIỆN THOẠI
  // ==========================================

  openOtpPopup(purpose: OtpPurpose): void {
    if (this.isSavingAccount) return;

    this.otpPurpose = purpose;
    this.showOtpModal = true;

    this.otpCode = '';
    this.otpErrorMessage = '';

    this.isOtpLocked = false;
    this.isOtpSuccess = false;

    this.accountService.issueOtp(true);

    const target =
      purpose === 'email'
        ? this.newEmailInput.trim()
        : this.newPhoneInput.trim();

    this.otpInfoMessage =
      `Mã xác minh ${OTP_LENGTH} chữ số đã gửi tới ` +
      `${purpose === 'email' ? 'Email' : 'Số điện thoại'}: ${target}`;

    this.startResendCooldown();
  }

  closeOtpPopup(): void {
    if (this.isSavingAccount) return;

    this.showOtpModal = false;

    this.clearTimer();
    this.accountService.cancelOtp();

    this.otpCode = '';
    this.updateView();
  }

  onOtpChange(code: string): void {
    this.otpCode = code;
    this.otpErrorMessage = '';
  }

  
async submitOtp(): Promise<void> {
  if (
    this.isOtpLocked ||
    this.isSavingAccount ||
    this.isOtpSuccess
  ) {
    return;
  }

  if (this.otpCode.length !== OTP_LENGTH) {
    this.otpErrorMessage =
      `Vui lòng nhập đủ ${OTP_LENGTH} chữ số OTP!`;
    return;
  }

  // Xác minh OTP duy nhất
  const verified = this.accountService.verifyOtp(this.otpCode);

  if (!verified.ok) {
    this.otpErrorMessage = verified.message;

    if (verified.locked) {
      this.isOtpLocked = true;

      this.lockTimeout = setTimeout(() => {
        this.closeOtpPopup();
        this.subMode = 'view';
        this.authService.logout();

        this.toast.warning(
          'Sai OTP quá 3 lần. Tài khoản đã tự động đăng xuất!'
        );

        this.updateView();
      }, 1800);
    } else {
      this.otpBox?.clear();
    }

    this.updateView();
    return;
  }

  // OTP đúng -> Lưu dữ liệu qua API
  this.isSavingAccount = true;
  this.otpErrorMessage = '';
  this.updateView();

  try {
    const result =
      this.otpPurpose === 'email'
        ? await this.accountService.updateEmail(
            this.newEmailInput
          )
        : await this.accountService.updatePhone(
            this.newPhoneInput
          );

    if (!result.ok) {
      this.otpErrorMessage =
        `${result.message}. Hãy gửi lại mã OTP để thử lại.`;

      this.clearTimer();
      this.resendCooldown = 0;
      this.otpCode = '';
      this.otpBox?.clear();
      return;
    }

    // API ĐÃ LƯU THÀNH CÔNG

    // Tự đóng popup OTP, không chuyển sang popup thứ hai
    this.showOtpModal = false;

    // Trở về tab Chi tiết tài khoản
    this.subMode = 'view';

    // Dọn OTP và đồng hồ
    this.clearTimer();
    this.accountService.cancelOtp();

    this.otpCode = '';
    this.otpErrorMessage = '';
    this.isOtpSuccess = false;

    // Thông báo thành công duy nhất
    this.toast.success(
      this.otpPurpose === 'email'
        ? 'Đã thay đổi địa chỉ email thành công!'
        : 'Đã cập nhật số điện thoại thành công!'
    );

  } catch (error) {
    console.error('Lỗi cập nhật email/SĐT:', error);

    this.otpErrorMessage =
      'Không thể cập nhật thông tin. Vui lòng thử lại.';

    this.clearTimer();
    this.resendCooldown = 0;

  } finally {
    this.isSavingAccount = false;
    this.updateView();
  }
}


  handleResendOtp(): void {
    if (
      this.resendCooldown > 0 ||
      this.isOtpLocked ||
      this.isSavingAccount ||
      this.isOtpSuccess
    ) {
      return;
    }

    this.accountService.issueOtp(false);

    this.otpBox?.clear();
    this.otpCode = '';

    this.otpErrorMessage = '';
    this.otpInfoMessage = 'Mã OTP mới đã được gửi lại!';

    this.startResendCooldown();
  }

  finishOtpSuccess(): void {
    this.closeOtpPopup();
    this.subMode = 'view';

    this.updateView();
  }

  goToHome(): void {
    this.closeOtpPopup();
    this.subMode = 'view';

    void this.router.navigate(['/']);
  }

  private startResendCooldown(): void {
    this.clearTimer();

    this.resendCooldown = RESEND_COOLDOWN_SECONDS;
    this.updateView();

    this.timerInterval = setInterval(() => {
      this.resendCooldown = Math.max(
        0,
        this.resendCooldown - 1
      );

      if (this.resendCooldown === 0) {
        this.clearTimer();
      }

      this.updateView();

    }, 1000);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  // ==========================================
  // XÓA TÀI KHOẢN - BA BƯỚC OTP DEMO
  // ==========================================

  openDeleteModal(): void {
    if (this.isDeletingAccount) return;

    this.clearDeleteTimer();

    this.showDeleteModal = true;
    this.confirmDeleteText = '';

    this.deleteStep = 0;
    this.deleteOtpVerified = false;
    this.deleteOtpCode = '';
    this.deleteOtpErrorMsg = '';
    this.deleteOtpInfoMsg = '';

    this.accountService.cancelOtp();
  }

  closeDeleteModal(): void {
    if (this.isDeletingAccount) return;

    this.showDeleteModal = false;

    this.clearDeleteTimer();

    this.deleteStep = 0;
    this.deleteOtpVerified = false;
    this.accountService.cancelOtp();

    this.updateView();
  }

  startDeleteVerification(): void {
    if (this.isDeletingAccount) return;

    if (this.confirmDeleteText.trim() !== 'DELETE') {
      this.toast.warning(
        'Vui lòng nhập đúng từ "DELETE"!'
      );
      return;
    }

    this.deleteOtpVerified = false;
    this.accountService.issueOtp(true);
    this.advanceDeleteStep(1, false);
  }

  private advanceDeleteStep(
    step: number,
    issueNewOtp = true
  ): void {
    this.deleteStep = step;

    this.deleteOtpCode = '';
    this.deleteOtpErrorMsg = '';

    if (issueNewOtp) {
      this.accountService.issueOtp(false);
    }

    const { email, phone } =
      this.accountService.accountInfo;

    if (step === 1) {
      this.deleteOtpInfoMsg =
        `Mã xác minh Bước 1/3 đã gửi tới Email: (${email}).`;

    } else if (step === 2) {
      this.deleteOtpInfoMsg =
        this.accountService.hasPhone
          ? `Mã xác minh Bước 2/3 đã gửi tới SMS SĐT: (${phone}).`
          : `Chưa liên kết SĐT. Mã Bước 2/3 đã gửi tới Email: (${email}).`;

    } else {
      this.deleteOtpInfoMsg =
        this.accountService.hasPhone
          ? `Mã Bước 3/3 đã gửi tới Email (${email}) và SĐT (${phone}).`
          : `Mã Bước 3/3 đã gửi tới Email (${email}).`;
    }

    this.startDeleteResendCooldown();
  }

  onDeleteOtpChange(code: string): void {
    this.deleteOtpCode = code;
    this.deleteOtpErrorMsg = '';
  }

  submitDeleteOtpStep(): void {
    if (this.isDeletingAccount || this.deleteStep < 1) return;

    // Đã xác minh đủ ba OTP: khi API lỗi cho phép thử lại mà không nhập OTP lại.
    if (this.deleteStep === 3 && this.deleteOtpVerified) {
      void this.executeAccountDeletion();
      return;
    }

    if (this.deleteOtpCode.length !== OTP_LENGTH) {
      this.deleteOtpErrorMsg = `Vui lòng nhập đủ ${OTP_LENGTH} chữ số OTP!`;
      this.updateView();
      return;
    }

    const verified = this.accountService.verifyOtp(this.deleteOtpCode);

    if (verified.ok) {
      if (this.deleteStep < 3) {
        this.advanceDeleteStep(this.deleteStep + 1);
      } else {
        this.deleteOtpVerified = true;
        void this.executeAccountDeletion();
      }
      return;
    }

    if (verified.locked) {
      this.closeDeleteModal();
      this.authService.logout();
      this.toast.warning('Sai OTP 3 lần. Tiến trình đã hủy và tài khoản đã đăng xuất!');
      void this.router.navigate(['/']);
      return;
    }

    this.deleteOtpErrorMsg = verified.message;
    this.deleteOtpBox?.clear();
    this.updateView();
  }

  handleResendDeleteOtp(): void {
    if (
      this.isDeletingAccount ||
      this.deleteStep < 1 ||
      this.deleteResendCooldown > 0
    ) {
      return;
    }

    this.accountService.issueOtp(false);

    this.deleteOtpBox?.clear();
    this.deleteOtpCode = '';

    this.deleteOtpErrorMsg = '';
    this.deleteOtpInfoMsg =
      `Mã OTP mới cho Bước ${this.deleteStep}/3 đã được gửi lại!`;

    this.startDeleteResendCooldown();
  }

  private async executeAccountDeletion(): Promise<void> {
    if (this.isDeletingAccount || !this.deleteOtpVerified || this.deleteStep !== 3) return;

    this.isDeletingAccount = true;
    this.deleteOtpErrorMsg = '';
    this.updateView();

    try {
      const result = await this.accountService.deleteAccount();

      if (!result.ok) {
        // Giữ lại bước OTP 3 đã hoàn tất để hiện lỗi thật từ backend.
        // Ví dụ: đang có yêu cầu hoàn tiền chờ xử lý (HTTP 409).
        this.deleteOtpErrorMsg = result.message ||
          'Không gửi được yêu cầu khóa chờ xóa tài khoản.';
        return;
      }

      // Backend đã khóa tài khoản và lên lịch xóa sau 30 ngày.
      this.clearDeleteTimer();
      this.showDeleteModal = false;
      this.deleteStep = 0;
      this.deleteOtpVerified = false;

      this.toast.success(result.message);
      await this.router.navigate(['/']);

    } catch (err) {
      console.error('Lỗi yêu cầu khóa chờ xóa tài khoản:', err);
      this.deleteOtpErrorMsg =
        'Không thể kết nối máy chủ. Vui lòng thử lại yêu cầu, không cần xác minh OTP lại.';
    } finally {
      this.isDeletingAccount = false;
      this.updateView();
    }
  }

  private startDeleteResendCooldown(): void {
    this.clearDeleteTimer();

    this.deleteResendCooldown =
      RESEND_COOLDOWN_SECONDS;

    this.updateView();

    this.deleteTimerInterval = setInterval(() => {
      this.deleteResendCooldown = Math.max(
        0,
        this.deleteResendCooldown - 1
      );

      if (this.deleteResendCooldown === 0) {
        this.clearDeleteTimer();
      }

      this.updateView();

    }, 1000);
  }

  private clearDeleteTimer(): void {
    if (this.deleteTimerInterval) {
      clearInterval(this.deleteTimerInterval);
      this.deleteTimerInterval = null;
    }
  }

  // ==========================================
  // TAB 2 - TÙY CHỈNH CỬA HÀNG
  // ==========================================

  addProfanityWord(): void {
    if (
      this.customProfanityWords.length >=
      MAX_CUSTOM_WORDS
    ) {
      this.toast.warning(
        `Tối đa ${MAX_CUSTOM_WORDS} từ ngữ cụ thể.`
      );
      return;
    }

    this.customProfanityWords.push('');
  }

  removeProfanityWord(index: number): void {
    this.customProfanityWords.splice(index, 1);
  }

  saveStoreCustomization(): void {
    const seen = new Set<string>();

    const words = this.customProfanityWords
      .map(w => w.trim().slice(0, MAX_WORD_LENGTH))
      .filter(w => {
        const key = w.toLowerCase();

        if (!w || seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

    this.customProfanityWords = words;

    this.preferences.save({
      ...this.preferences.prefs,
      hide: {
        mature: this.matureContentFilter,
        violence: this.frequentViolence,
        nuditySome: this.nuditySome,
        nudityFrequent: this.nudityFrequent,
        adultOnly: this.adultOnlyNudity
      },
      profanityMode: this.profanityFilterOption,
      customWords: words
    });

    this.toast.success(
      'Đã lưu cấu hình tùy chỉnh nội dung.'
    );
  }

  // ==========================================
  // TAB 3 - CÀI ĐẶT THÔNG BÁO
  // ==========================================

  saveNotificationSettings(): void {
    this.notifications.savePrefs({
      wishlistSale: this.notifyWishlistSale,
      purchase: this.notifyPurchaseReceipt,
      news: this.notifyNewsEvents,
      friend: this.notifyFriendRequest,
      gameUpdate: this.notifyGameUpdates
    });

    this.toast.success(
      'Cài đặt thông báo đã được lưu!'
    );
  }

  // ==========================================
  // TAB 4 - BẢO MẬT VÀ THIẾT BỊ
  // ==========================================

  async toggle2FA(): Promise<void> {
    if (this.accountService.twoFactorEnabled) {
      const ok = await this.confirm.ask({
        title: 'Tắt STEAL Guard?',
        message:
          'Tắt xác thực 2 yếu tố sẽ khiến tài khoản dễ bị xâm nhập hơn. Bạn vẫn muốn tiếp tục?',
        confirmText: 'Tắt STEAL Guard',
        danger: true
      });

      if (!ok || this.destroyed) return;

      this.accountService.setTwoFactor(false);

      this.toast.warning(
        'Đã tắt xác thực 2 yếu tố STEAL Guard!'
      );

    } else {
      this.accountService.setTwoFactor(true);

      this.toast.success(
        'Đã kích hoạt xác thực 2 yếu tố STEAL Guard!'
      );
    }

    this.updateView();
  }

  async changePassword(): Promise<void> {
    if (this.isSavingAccount) return;

    this.passwordErrorMsg = '';
    this.isSavingAccount = true;

    this.updateView();

    try {
      const result =
        await this.accountService.changePassword(
          this.oldPasswordInput,
          this.newPasswordInput,
          this.confirmPasswordInput
        );

      if (!result.ok) {
        this.passwordErrorMsg = result.message;
        return;
      }

      this.oldPasswordInput = '';
      this.newPasswordInput = '';
      this.confirmPasswordInput = '';

      this.toast.success(result.message);

    } catch (err) {
      console.error('Lỗi đổi mật khẩu:', err);

      this.passwordErrorMsg =
        'Không thể đổi mật khẩu trên máy chủ.';

    } finally {
      this.isSavingAccount = false;
      this.updateView();
    }
  }

  // ==========================================
  // TAB 5 - COOKIE VÀ DỮ LIỆU
  // ==========================================

  setCookie(
    key: keyof CookieSettings,
    value: boolean
  ): void {
    this.cookies = {
      ...this.cookies,
      [key]: value
    };

    this.persistCookies();
  }

  acceptAllCookies(): void {
    this.cookies = {
      ...this.cookies,
      recentApps: true,
      analytics: true,
      youtube: true,
      vimeo: true,
      sketchfab: true
    };

    this.persistCookies();

    this.toast.success(
      'Đã chấp nhận tất cả cookies!'
    );
  }

  rejectAllCookies(): void {
    this.cookies = {
      ...this.cookies,
      recentApps: false,
      analytics: false,
      youtube: false,
      vimeo: false,
      sketchfab: false
    };

    this.persistCookies();

    this.toast.warning(
      'Đã từ chối tất cả cookies tùy chọn!'
    );
  }

  private persistCookies(): void {
    this.preferences.save({
      ...this.preferences.prefs,
      cookies: this.cookies
    });
  }

  async clearBrowserData(): Promise<void> {
    try {
      sessionStorage.clear();

      if ('caches' in window) {
        const keys = await caches.keys();

        await Promise.all(
          keys.map(key => caches.delete(key))
        );
      }

    } catch {
      // Trình duyệt không cho phép xóa cache
    }

    this.toast.success(
      'Đã xóa bộ nhớ tạm và dữ liệu phiên duyệt web!'
    );
  }

  // ==========================================
  // CHỨC NĂNG DỮ LIỆU DEMO
  // ==========================================

  async loadSampleData(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Nạp dữ liệu mẫu?',
      message:
        'Hồ sơ, bạn bè, giỏ hàng, thư viện và thông báo sẽ được thay bằng dữ liệu mẫu.',
      confirmText: 'Nạp dữ liệu mẫu'
    });

    if (!ok || this.destroyed) return;

    this.accountService.loadSampleData();
    this.loadDrafts();

    this.toast.success('Đã nạp dữ liệu mẫu.');
    this.updateView();
  }

  async resetToNewAccount(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Đặt lại về tài khoản mới?',
      message:
        'Toàn bộ hồ sơ, bạn bè, nhóm, giỏ hàng, thư viện và thông báo sẽ bị xóa (bạn vẫn ở trạng thái đăng nhập).',
      confirmText: 'Đặt lại',
      danger: true
    });

    if (!ok || this.destroyed) return;

    this.accountService.resetToNewAccount();
    this.loadDrafts();

    this.toast.success(
      'Đã đặt lại về trạng thái tài khoản mới.'
    );

    this.updateView();
  }
}
