import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { CheckoutService, PAYMENT_METHODS, PaymentMethod } from '../../services/checkout';
import { PhoneCountryRule, PhoneValidationService } from '../../services/phone-validation';
import { loadJson, removeKey, saveJson } from '../../services/storage';
import { ToastService } from '../../services/toast';

interface SavedPayment {
  ho: string;
  ten: string;
  soDienThoai: string;
  method: PaymentMethod;
}

const SAVED_KEY = 'steal_payment_info';

@Component({
  selector: 'app-phuong-thuc-thanh-toan',
  templateUrl: './phuong-thuc-thanh-toan.html',
  styleUrls: ['./phuong-thuc-thanh-toan.css'],
  standalone: false
})
export class PhuongThucThanhToanComponent implements OnInit {
  // Danh sách động lấy từ Cài đặt Admin
  danhSachPhuongThuc: PaymentMethod[] = [];

  phuongThucChon: PaymentMethod = 'Ví điện tử MoMo';
  moDropdown = false;
  ten = '';
  ho = '';
  soDienThoai = '';
  luuThongTin = false;

  daChamTen = false;
  daChamHo = false;
  daChamSdt = false;
  daBamTiepTuc = false;

  constructor(
    private checkout: CheckoutService,
    private auth: AuthService,
    private phoneValidation: PhoneValidationService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const redirect = this.checkout.guard('method');
    if (redirect) {
      this.router.navigate([redirect]);
      return;
    }

    // 1. TẢI CÁC CỔNG THANH TOÁN ĐANG ĐƯỢC ADMIN BẬT
    this.taiDanhSachPhuongThucTuAdmin();

    const draft = this.checkout.draft;
    const saved = loadJson<SavedPayment | null>(SAVED_KEY, null);
    const source = draft.customer
      ? { ...draft.customer, method: draft.method }
      : saved ?? null;

    if (source) {
      this.ten = source.ten;
      this.ho = source.ho;
      this.soDienThoai = source.soDienThoai;
      this.phuongThucChon = this.danhSachPhuongThuc.includes(source.method)
        ? source.method
        : this.danhSachPhuongThuc[0] || 'Ví điện tử MoMo';
      this.luuThongTin = !!saved;
    } else {
      this.phuongThucChon = this.danhSachPhuongThuc.includes(draft.method)
        ? draft.method
        : this.danhSachPhuongThuc[0] || 'Ví điện tử MoMo';
    }

    // Cập nhật lại vào checkout draft
    this.checkout.update({ method: this.phuongThucChon });
  }

  // Đọc danh sách cổng thanh toán từ cấu hình Admin trong Storage
  private taiDanhSachPhuongThucTuAdmin(): void {
    try {
      const saved = localStorage.getItem('steal_setting_thanh_toan');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list) && list.length > 0) {
          // Chỉ lấy các cổng có trangThaiKichHoat === true
          const activeMethods = list
            .filter((item: any) => item.trangThaiKichHoat !== false)
            .map((item: any) => item.tenHienThi || item.congTichHop);

          if (activeMethods.length > 0) {
            this.danhSachPhuongThuc = activeMethods;
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc cấu hình thanh toán Admin:', e);
    }

    // Fallback mặc định
    this.danhSachPhuongThuc = [...PAYMENT_METHODS];
  }

  get phoneRule(): PhoneCountryRule {
    return this.phoneValidation.getRule(this.auth.currentUser?.country ?? 'Việt Nam');
  }

  get hienLoiTen(): boolean {
    return (this.daChamTen || this.daBamTiepTuc) && !this.ten.trim();
  }

  get hienLoiHo(): boolean {
    return (this.daChamHo || this.daBamTiepTuc) && !this.ho.trim();
  }

  get soDienThoaiHopLe(): boolean {
    return this.phoneValidation.validate(this.soDienThoai, this.auth.currentUser?.country ?? 'Việt Nam');
  }

  get hienLoiSoDienThoai(): boolean {
    return (this.daChamSdt || this.daBamTiepTuc) && !this.soDienThoaiHopLe;
  }

  toggleDropdown(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.moDropdown = !this.moDropdown;
  }

  chonPhuongThuc(method: PaymentMethod, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.phuongThucChon = method;
    this.checkout.update({ method: method });
    this.moDropdown = false;
  }

  onTenBlur(): void { this.daChamTen = true; }
  onHoBlur(): void { this.daChamHo = true; }
  onPhoneBlur(): void { this.daChamSdt = true; }

  onPhoneChange(value: string): void {
    this.soDienThoai = String(value || '').replace(/\D/g, '').slice(0, this.phoneRule.maxLength);
  }

  tiepTuc(): void {
    this.daBamTiepTuc = true;
    if (!this.ten.trim() || !this.ho.trim() || !this.soDienThoaiHopLe) {
      this.toast.warning('Vui lòng điền đầy đủ và đúng định dạng thông tin thanh toán!');
      return;
    }
    const customer = { ho: this.ho.trim(), ten: this.ten.trim(), soDienThoai: this.soDienThoai };
    this.checkout.update({ customer, method: this.phuongThucChon });
    if (this.luuThongTin) saveJson(SAVED_KEY, { ...customer, method: this.phuongThucChon } satisfies SavedPayment);
    else removeKey(SAVED_KEY);
    this.router.navigate(['/ma-qr-thanh-toan']);
  }
}