import { Injectable } from '@angular/core';
import { AuthService } from './auth';
import { loadJson, saveJson } from './storage';

export interface GameStats {
  /** Tổng số phút đã chơi (đã nhân hệ số demo). */
  playMinutes: number;
  lastPlayedAt: number | null;
}

const KEY = 'steal_library_stats';
const DAY = 24 * 60 * 60 * 1000;

/**
 * Hệ số tăng tốc thời gian chơi để DEMO chính sách hoàn tiền (tối đa 2 giờ):
 * 1 giây chơi thật = 1 phút trong thống kê. Đặt = 1 để dùng thời gian thật.
 */
export const DEMO_PLAY_SPEED = 60;

/** Thời gian chơi từng game của tài khoản hiện tại (dùng cho thư viện và hoàn tiền). */
@Injectable({ providedIn: 'root' })
export class LibraryStatsService {
  private stats: Record<string, GameStats> = {};

  constructor(private auth: AuthService) {
    auth.scope$.subscribe(() => {
      this.stats = auth.isLoggedIn
        ? loadJson<Record<string, GameStats>>(KEY, auth.isDemoAccount ? this.demoStats() : {})
        : {};
    });
  }

  private demoStats(): Record<string, GameStats> {
    const now = Date.now();
    return {
      'dead-by-daylight': { playMinutes: 312, lastPlayedAt: now - 2 * DAY },
      'outlast': { playMinutes: 48, lastPlayedAt: now - 1 * DAY },
      'phasmophobia': { playMinutes: 750, lastPlayedAt: now - 5 * DAY }
    };
  }

  get(gameId: string): GameStats {
    return this.stats[gameId] ?? { playMinutes: 0, lastPlayedAt: null };
  }

  hoursPlayed(gameId: string): number {
    return this.get(gameId).playMinutes / 60;
  }

  /** Cộng thời gian của một phiên chơi (tính bằng giây thật). */
  addSession(gameId: string, realSeconds: number): void {
    if (realSeconds <= 0) return;
    const current = this.get(gameId);
    this.stats = {
      ...this.stats,
      [gameId]: {
        playMinutes: current.playMinutes + (realSeconds * DEMO_PLAY_SPEED) / 60,
        lastPlayedAt: Date.now()
      }
    };
    saveJson(KEY, this.stats);
  }

  remove(gameId: string): void {
    const { [gameId]: _removed, ...rest } = this.stats;
    this.stats = rest;
    saveJson(KEY, this.stats);
  }

  reset(): void {
    this.stats = {};
    saveJson(KEY, this.stats);
  }

  loadSample(): void {
    this.stats = this.demoStats();
    saveJson(KEY, this.stats);
  }

  lastPlayedLabel(gameId: string): string {
    const ts = this.get(gameId).lastPlayedAt;
    if (!ts) return 'Chưa chơi';
    const days = Math.floor((Date.now() - ts) / DAY);
    if (days <= 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    return new Date(ts).toLocaleDateString('vi-VN');
  }
}
