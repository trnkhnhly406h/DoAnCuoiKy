import { Injectable } from '@angular/core';

export interface PhoneCountryRule {
  name: string;
  dialCode: string;
  example: string;
  maxLength: number;
  pattern: RegExp;
}

/** Quy tắc số điện thoại theo quốc gia của tài khoản. */
@Injectable({ providedIn: 'root' })
export class PhoneValidationService {
  private readonly rules: Record<string, PhoneCountryRule> = {
    'Việt Nam': { name: 'Việt Nam', dialCode: '+84', example: '0912345678', maxLength: 10, pattern: /^0[35789]\d{8}$/ },
    'Anh': { name: 'Anh', dialCode: '+44', example: '07700900123', maxLength: 11, pattern: /^07\d{9}$/ },
    'Hàn Quốc': { name: 'Hàn Quốc', dialCode: '+82', example: '01012345678', maxLength: 11, pattern: /^010\d{8}$/ },
    'Hoa Kỳ': { name: 'Hoa Kỳ', dialCode: '+1', example: '2025550123', maxLength: 10, pattern: /^[2-9]\d{2}[2-9]\d{6}$/ },
    'Mỹ (Hoa Kỳ)': { name: 'Mỹ (Hoa Kỳ)', dialCode: '+1', example: '2025550123', maxLength: 10, pattern: /^[2-9]\d{2}[2-9]\d{6}$/ },
    'Nhật Bản': { name: 'Nhật Bản', dialCode: '+81', example: '09012345678', maxLength: 11, pattern: /^0[789]0\d{8}$/ },
    'Trung Quốc': { name: 'Trung Quốc', dialCode: '+86', example: '13800138000', maxLength: 11, pattern: /^1[3-9]\d{9}$/ },
    'Singapore': { name: 'Singapore', dialCode: '+65', example: '81234567', maxLength: 8, pattern: /^[89]\d{7}$/ },
    'Thái Lan': { name: 'Thái Lan', dialCode: '+66', example: '0812345678', maxLength: 10, pattern: /^0[689]\d{8}$/ },
    'Úc': { name: 'Úc', dialCode: '+61', example: '0412345678', maxLength: 10, pattern: /^04\d{8}$/ },
    'Đức': { name: 'Đức', dialCode: '+49', example: '015123456789', maxLength: 12, pattern: /^01[5-7]\d{8,9}$/ }
  };

  /** Quốc gia không có quy tắc riêng sẽ dùng quy tắc Việt Nam. */
  getRule(country: string): PhoneCountryRule {
    return this.rules[country] || this.rules['Việt Nam'];
  }

  validate(phone: string, country: string): boolean {
    return this.getRule(country).pattern.test(String(phone || '').replace(/[\s()-]/g, ''));
  }

  errorMessage(country: string): string {
    const rule = this.getRule(country);
    return `Số điện thoại không đúng định dạng (${rule.name}, ví dụ ${rule.example}).`;
  }
}
