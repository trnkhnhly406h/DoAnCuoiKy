import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { UserProfileService } from './user-profile';

describe('UserProfileService', () => {
  let auth: AuthService;
  let profile: UserProfileService;

  beforeEach(() => {
    localStorage.clear();
    auth = TestBed.inject(AuthService);
    profile = TestBed.inject(UserProfileService);
  });

  it('uses the account name and a sample profile for demo accounts', () => {
    auth.login('5 con nhái', 'Steal@123');
    expect(profile.displayName).toBe('5 con nhái');
    expect(profile.isEmpty).toBeFalse();
  });

  it('starts empty for a newly registered account and keeps the name and country', () => {
    auth.saveRegisterStep1('moi2@example.com', 'Nhật Bản');
    auth.finishRegister('Tai Khoan Moi', 'Abcdef1!', 'Abcdef1!');
    expect(profile.isEmpty).toBeTrue();
    expect(profile.displayName).toBe('Tai Khoan Moi');
    expect(profile.profile.country).toBe('Nhật Bản');
  });

  it('keeps each account profile separate', () => {
    auth.login('khach_vip01', 'password123');
    profile.updateProfile({ bio: 'Xin chào' });
    auth.logout();
    auth.login('khach_vip02', 'password123');
    expect(profile.profile.bio).not.toBe('Xin chào');
  });

  it('generates a stable account code per username', () => {
    auth.login('khach_vip01', 'password123');
    const code = profile.accountCode;
    expect(code).toMatch(/^CUS-\d{5}$/);
    expect(profile.accountCode).toBe(code);
  });
});
