import { TestBed } from '@angular/core/testing';
import { AccountSettingsService, NO_PHONE } from './account-settings';
import { AuthService } from './auth';

describe('AccountSettingsService', () => {
  let service: AccountSettingsService;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    auth = TestBed.inject(AuthService);
    service = TestBed.inject(AccountSettingsService);
    auth.login('khach_vip01', 'password123');
  });

  it('takes email and country from the signed-in account', () => {
    expect(service.accountInfo.email).toBe('vietthanh.bui@gmail.com');
    expect(service.accountInfo.phone).toBe(NO_PHONE);
    expect(service.hasPhone).toBeFalse();
  });

  it('validates phone numbers by the account country', () => {
    expect(service.isValidPhone('0912345678')).toBeTrue();
    expect(service.isValidPhone('0|12345678')).toBeFalse();
  });

  it('accepts only the issued OTP and locks after 3 wrong attempts', () => {
    const code = service.issueOtp();
    expect(service.verifyOtp('000000').ok).toBeFalse();
    expect(service.verifyOtp('111111').ok).toBeFalse();
    expect(service.verifyOtp('222222').locked).toBeTrue();
    expect(service.verifyOtp(code).ok).toBeFalse();
  });

  it('changes password through AuthService and enforces the current password', () => {
    expect(service.changePassword('sai', 'Abcdef1!', 'Abcdef1!').ok).toBeFalse();
    expect(service.changePassword('password123', 'Abcdef1!', 'Khac1234!').ok).toBeFalse();
    expect(service.changePassword('password123', 'Abcdef1!', 'Abcdef1!').ok).toBeTrue();
  });

  it('rejects an email already used by another account', () => {
    expect(service.updateEmail('harry.brown@gmail.com').ok).toBeFalse();
    expect(service.updateEmail('moi.hoan.toan@example.com').ok).toBeTrue();
    expect(service.accountInfo.email).toBe('moi.hoan.toan@example.com');
  });

  it('delete account removes the account and signs out', () => {
    service.deleteAccount();
    expect(auth.isLoggedIn).toBeFalse();
    expect(auth.login('khach_vip01', 'password123').success).toBeFalse();
  });
});
