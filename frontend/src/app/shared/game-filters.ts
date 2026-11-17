import { GameView } from '../services/game-catalog';

export interface StorageOption {
  key: string;
  name: string;
  min: number;
  max: number;
}

/** Các mức dung lượng ổ cứng dùng cho bộ lọc (đơn vị GB). */
export const STORAGE_OPTIONS: StorageOption[] = [
  { key: 'duoi20', name: 'Dưới 20 GB', min: 0, max: 20 },
  { key: 'tu20den50', name: '20 - 50 GB', min: 20, max: 50 },
  { key: 'tu50den100', name: '50 - 100 GB', min: 50, max: 100 },
  { key: 'tren100', name: 'Trên 100 GB', min: 100, max: Number.POSITIVE_INFINITY }
];

export const MAX_PRICE_FILTER = 2000000;

export interface SidebarFilters {
  maxPrice: number;
  onlyDiscounted: boolean;
  hideFree: boolean;
  storage: Record<string, boolean>;
  /** Game phải thuộc ĐỒNG THỜI tất cả thể loại đã chọn. */
  genres: string[];
}

export function emptyStorage(): Record<string, boolean> {
  return Object.fromEntries(STORAGE_OPTIONS.map(o => [o.key, false]));
}

export function matchesFilters(game: GameView, f: SidebarFilters): boolean {
  if (f.maxPrice < MAX_PRICE_FILTER && game.price > f.maxPrice) return false;
  if (f.onlyDiscounted && game.discountPercent <= 0) return false;
  if (f.hideFree && game.isFree) return false;
  const chosen = STORAGE_OPTIONS.filter(o => f.storage[o.key]);
  if (chosen.length > 0 && !chosen.some(o => game.diskGB >= o.min && game.diskGB < o.max)) return false;
  return f.genres.every(slug => game.genres.includes(slug));
}
