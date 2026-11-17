import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { loadJson, saveJson } from './storage';

describe('AuthService', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    auth = TestBed.inject(AuthService);
  });

  it('starts logged out', () => {
    expect(auth.isLoggedIn).toBeFalse();
    expect(auth.currentUser).toBeNull();
  });

  it('logs in with username or email and rejects a wrong password', () => {
    expect(auth.login('khach_vip01', 'sai-mat-khau').success).toBeFalse();
    expect(auth.login('khach_vip01', 'password123').success).toBeTrue();
    expect(auth.currentUser?.username).toBe('khach_vip01');
    auth.logout();
    expect(auth.login('VIETTHANH.BUI@gmail.com', 'password123').success).toBeTrue();
    expect(auth.isDemoAccount).toBeTrue();
  });

  it('registers a new account with OTP and signs it in', () => {
    expect(auth.saveRegisterStep1('moi@example.com', 'Việt Nam')).toBeTrue();
    expect(auth.verifyOtp('000000').success).toBeFalse();
    expect(auth.verifyOtp(auth.currentOtp).success).toBeTrue();
    const result = auth.finishRegister('Người Mới', 'Abcdef1!', 'Abcdef1!');
    expect(result.success).toBeTrue();
    expect(auth.isLoggedIn).toBeTrue();
    expect(auth.isDemoAccount).toBeFalse();
  });

  it('rejects taken emails/usernames and weak passwords', () => {
    expect(auth.saveRegisterStep1('vietthanh.bui@gmail.com', 'Việt Nam')).toBeFalse();
    auth.saveRegisterStep1('khac@example.com', 'Việt Nam');
    expect(auth.finishRegister('khach_vip01', 'Abcdef1!', 'Abcdef1!').success).toBeFalse();
    expect(auth.finishRegister('Nguoi Khac', 'yeu', 'yeu').success).toBeFalse();
  });

  it('keeps data separated per account through the storage scope', () => {
    auth.login('khach_vip01', 'password123');
    saveJson('probe', 'a');
    auth.logout();
    auth.login('khach_vip02', 'password123');
    expect(loadJson('probe', 'none')).toBe('none');
    auth.logout();
    auth.login('khach_vip01', 'password123');
    expect(loadJson('probe', 'none')).toBe('a');
  });

  it('changes password only with the correct current password', () => {
    auth.login('khach_vip03', 'password123');
    expect(auth.changePassword('sai', 'Abcdef1!').success).toBeFalse();
    expect(auth.changePassword('password123', 'Abcdef1!').success).toBeTrue();
    auth.logout();
    expect(auth.login('khach_vip03', 'password123').success).toBeFalse();
    expect(auth.login('khach_vip03', 'Abcdef1!').success).toBeTrue();
  });

  it('deletes the account for good', () => {
    auth.login('khach_vip04', 'password123');
    auth.deleteCurrentAccount();
    expect(auth.isLoggedIn).toBeFalse();
    expect(auth.login('khach_vip04', 'password123').success).toBeFalse();
  });

  it('cancels the OTP after too many wrong attempts and enforces the resend cooldown', () => {
    auth.saveRegisterStep1('otp@example.com', 'Việt Nam');
    const good = auth.currentOtp;
    for (let i = 0; i < 5; i++) expect(auth.verifyOtp('000000' === good ? '111111' : '000000').success).toBeFalse();
    expect(auth.verifyOtp(good).success).toBeFalse(); // mã đã bị hủy
    expect(auth.resendOtp().success).toBeTrue();
    expect(auth.resendOtp().success).toBeFalse(); // đang trong thời gian chờ
  });

  it('does not let an OTP issued for one purpose verify another', () => {
    auth.saveRegisterStep1('muc-dich@example.com', 'Việt Nam');
    expect(auth.verifyOtp(auth.currentOtp, 'recovery').success).toBeFalse();
  });

  it('requires a verified OTP before resetting a password', () => {
    expect(auth.resetPassword('vietthanh.bui@gmail.com', 'Abcdef1!').success).toBeFalse();
    expect(auth.startRecovery('vietthanh.bui@gmail.com').success).toBeTrue();
    expect(auth.resetPassword('vietthanh.bui@gmail.com', 'Abcdef1!').success).toBeFalse();
    expect(auth.verifyOtp(auth.currentOtp, 'recovery').success).toBeTrue();
    expect(auth.resetPassword('vietthanh.bui@gmail.com', 'Abcdef1!').success).toBeTrue();
    expect(auth.login('khach_vip01', 'Abcdef1!').success).toBeTrue();
  });

  it('refuses to finish registration when the email was never verified', () => {
    auth.saveRegisterStep1('chua-xac-minh@example.com', 'Việt Nam');
    expect(auth.finishRegister('Nguoi Moi 2', 'Abcdef1!', 'Abcdef1!').success).toBeFalse();
  });

  it('locks login for a while after repeated wrong passwords', () => {
    for (let i = 0; i < 5; i++) auth.login('khach_vip04', 'sai');
    const r = auth.login('khach_vip04', 'password123');
    expect(r.success).toBeFalse();
    expect(r.message).toContain('thử lại sau');
  });
});
