import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth';
import { loadJson, saveJson } from './storage';

export const OTHER_COUNTRY = 'Khác (Tự nhập...)';

export const POPULAR_COUNTRIES: string[] = [
  'Việt Nam', 'Mỹ (Hoa Kỳ)', 'Nhật Bản', 'Hàn Quốc', 'Trung Quốc',
  'Anh', 'Pháp', 'Đức', 'Úc', 'Thái Lan', OTHER_COUNTRY
];

const FLAGS: Record<string, string> = {
  'Việt Nam': '🇻🇳', 'Mỹ (Hoa Kỳ)': '🇺🇸', 'Hoa Kỳ': '🇺🇸', 'Nhật Bản': '🇯🇵', 'Hàn Quốc': '🇰🇷',
  'Trung Quốc': '🇨🇳', 'Anh': '🇬🇧', 'Pháp': '🇫🇷', 'Đức': '🇩🇪', 'Úc': '🇦🇺', 'Thái Lan': '🇹🇭', 'Singapore': '🇸🇬'
};

export function countryFlag(country: string): string {
  return FLAGS[country] ?? '🌐';
}

export interface UserProfile {
  username: string;
  realName: string;
  country: string;
  bio: string;
  searchUrl: string;
  avatarUrl: string;
  showGames: boolean;
  showWishlist: boolean;
  showFriends: boolean;
}

const STORAGE_KEY = 'steal_profile';
export const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/bottts/svg?seed=stealuser_avatar';

function blankProfile(username: string, country: string): UserProfile {
  return {
    username, realName: '', country: country || 'Việt Nam', bio: '', searchUrl: '',
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || 'stealuser_avatar')}`,
    showGames: true, showWishlist: true, showFriends: true
  };
}

function sampleProfile(username: string, country: string): UserProfile {
  return {
    ...blankProfile(username, country),
    realName: 'Ly',
    bio: 'Hello cả nhà, tui là con nhái thích ăn bánh xèo, bún bò, phở, cơm nhà...',
    searchUrl: username.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') || 'namconnnhai'
  };
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  readonly defaultAvatar = DEFAULT_AVATAR;
  profile: UserProfile = blankProfile('', 'Việt Nam');

  constructor(
    private auth: AuthService,
    private http: HttpClient
  ) {
    auth.scope$.subscribe(() => this.reload());
  }

  get accountCode(): string {
    const name = (this.auth.currentUser?.username ?? '').toLowerCase();
    let hash = 7;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 90000;
    return `CUS-${String(10000 + hash)}`;
  }

  get displayName(): string {
    return this.profile.username.trim() || this.profile.realName.trim() || this.auth.currentUser?.username || 'Tài khoản STEAL';
  }

  get avatar(): string {
    return this.profile.avatarUrl || DEFAULT_AVATAR;
  }

  get isEmpty(): boolean {
    return !this.profile.bio.trim() && !this.profile.realName.trim();
  }

  // CẬP NHẬT PROFILE: LƯU STORAGE + ĐỒNG BỘ VÀO MONGODB
  async updateProfile(changes: Partial<UserProfile>): Promise<void> {
    this.profile = { ...this.profile, ...changes };
    saveJson(STORAGE_KEY, this.profile);

    const token = localStorage.getItem('steal_token');
    if (token) {
      try {
        const response = await firstValueFrom(
          this.http.put<{ success: boolean; data: any }>(
            'http://localhost:3000/api/store/users/me',
            {
              hoTen: this.profile.realName || this.profile.username,
              username: this.profile.username,
              anhDaiDien: this.profile.avatarUrl,
              quocTich: this.profile.country,
              bio: this.profile.bio,
              searchUrl: this.profile.searchUrl
            }
          )
        );

        if (response?.success && response?.data) {
          const savedUser = localStorage.getItem('steal_user');
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            parsed.hoTen = response.data.hoTen;
            parsed.anhDaiDien = response.data.anhDaiDien;
            localStorage.setItem('steal_user', JSON.stringify(parsed));
          }
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ hồ sơ lên Backend:', err);
      }
    }
  }

  reset(): void {
    const user = this.auth.currentUser;
    this.profile = blankProfile(user?.username ?? '', user?.country ?? 'Việt Nam');
    saveJson(STORAGE_KEY, this.profile);
  }

  loadSample(): void {
    const user = this.auth.currentUser;
    this.profile = sampleProfile(user?.username ?? '', user?.country ?? 'Việt Nam');
    saveJson(STORAGE_KEY, this.profile);
  }

  private reload(): void {
    const user = this.auth.currentUser;
    const username = user?.username ?? '';
    const country = user?.country ?? 'Việt Nam';
    const base = this.auth.isDemoAccount ? sampleProfile(username, country) : blankProfile(username, country);

    const backendUserStr = localStorage.getItem('steal_user');
    let backendHoTen = '';
    let backendAvatar = '';
    if (backendUserStr) {
      try {
        const u = JSON.parse(backendUserStr);
        backendHoTen = u.hoTen || '';
        backendAvatar = u.anhDaiDien || '';
      } catch {}
    }

    const localProfile = loadJson<Partial<UserProfile>>(STORAGE_KEY, {});
    this.profile = { 
      ...base, 
      ...localProfile,
      username: localProfile.username || backendHoTen || username,
      realName: localProfile.realName || backendHoTen || '',
      avatarUrl: localProfile.avatarUrl || backendAvatar || base.avatarUrl
    };
  }
}