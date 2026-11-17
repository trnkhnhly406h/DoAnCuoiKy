import { Injectable } from '@angular/core';
import { ContentFlag } from '../models/game.model';
import { AuthService } from './auth';
import { loadJson, removeKey, saveJson } from './storage';

export type ProfanityMode = 'all' | 'custom_only' | 'none';

export interface ContentHideSettings {
  mature: boolean;
  violence: boolean;
  nuditySome: boolean;
  nudityFrequent: boolean;
  adultOnly: boolean;
}

export interface CookieSettings {
  recentApps: boolean;
  analytics: boolean;
  youtube: boolean;
  vimeo: boolean;
  sketchfab: boolean;
  feedbackRequests: boolean;
  frameRateData: boolean;
  pcSaved: boolean;
}

export interface Preferences {
  hide: ContentHideSettings;
  profanityMode: ProfanityMode;
  customWords: string[];
  cookies: CookieSettings;
}

const STORAGE_KEY = 'steal_preferences';

/** Danh sách từ tục tĩu cơ bản, chỉ áp dụng khi chọn "Lọc ẩn từ ngữ tục tĩu". */
const BUILT_IN_PROFANITY = ['dcm', 'vcl', 'vl', 'đm', 'đmm', 'dmm'];

function defaults(): Preferences {
  return {
    hide: { mature: false, violence: false, nuditySome: false, nudityFrequent: false, adultOnly: false },
    profanityMode: 'custom_only',
    customWords: ['dcm', 'vl'],
    cookies: { recentApps: true, analytics: true, youtube: true, vimeo: false, sketchfab: true, feedbackRequests: false, frameRateData: false, pcSaved: false }
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tùy chọn người dùng: lọc nội dung cửa hàng, lọc từ ngữ chat, cookie. */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  prefs: Preferences = defaults();

  constructor(auth: AuthService) {
    // Tải lại cài đặt mỗi khi đổi tài khoản (hoặc đăng xuất).
    auth.scope$.subscribe(() => (this.prefs = this.load()));
  }

  private load(): Preferences {
    const stored = loadJson<Partial<Preferences> | null>(STORAGE_KEY, null);
    const base = defaults();
    if (!stored) return base;
    return {
      hide: { ...base.hide, ...stored.hide },
      profanityMode: stored.profanityMode ?? base.profanityMode,
      customWords: Array.isArray(stored.customWords) ? stored.customWords : base.customWords,
      cookies: { ...base.cookies, ...stored.cookies }
    };
  }

  save(next: Preferences): void {
    this.prefs = JSON.parse(JSON.stringify(next)) as Preferences;
    saveJson(STORAGE_KEY, this.prefs);
  }

  reset(): void {
    this.prefs = defaults();
    removeKey(STORAGE_KEY);
  }

  /** Game có bị ẩn do bộ lọc nội dung của người dùng không? */
  isHidden(flags: ContentFlag[]): boolean {
    const hide = this.prefs.hide;
    return flags.some(flag => {
      switch (flag) {
        case 'mature': return hide.mature;
        case 'violence': return hide.violence;
        case 'nuditySome': return hide.nuditySome;
        default: return false;
      }
    });
  }

  /** Che các từ bị lọc trong tin nhắn theo cài đặt hiện tại. */
  censor(text: string): string {
    if (!text || this.prefs.profanityMode === 'none') return text;
    const words = this.prefs.customWords.map(w => w.trim()).filter(w => w.length > 0);
    if (this.prefs.profanityMode === 'all') words.push(...BUILT_IN_PROFANITY);
    if (words.length === 0) return text;
    const pattern = words.map(escapeRegExp).join('|');
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'giu');
    return text.replace(regex, match => '♥'.repeat(Math.min(Math.max(match.length, 3), 6)));
  }
}
