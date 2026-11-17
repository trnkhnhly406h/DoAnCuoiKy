/**
 * Lưu trữ localStorage THEO TỪNG TÀI KHOẢN.
 * Mọi dữ liệu người dùng (giỏ hàng, thư viện, hồ sơ, chat...) được ghi với khóa
 * `steal:<scope>:<key>`; scope là tài khoản đang đăng nhập hoặc 'guest'.
 * Khách (guest) không được lưu dữ liệu.
 */
export const GUEST_SCOPE = 'guest';
let currentScope = GUEST_SCOPE;

export function setStorageScope(scope: string): void {
  currentScope = scope || GUEST_SCOPE;
}

export function getStorageScope(): string {
  return currentScope;
}

/** Tạo scope ổn định từ tên tài khoản. */
export function scopeOf(username: string): string {
  return `u:${encodeURIComponent(username.trim().toLowerCase())}`;
}

const fullKey = (scope: string, key: string) => `steal:${scope}:${key}`;

export function loadJsonFor<T>(scope: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(fullKey(scope, key));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function saveJsonFor(scope: string, key: string, value: unknown): boolean {
  if (scope === GUEST_SCOPE) return false;
  try {
    localStorage.setItem(fullKey(scope, key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  return loadJsonFor(currentScope, key, fallback);
}

export function saveJson(key: string, value: unknown): boolean {
  return saveJsonFor(currentScope, key, value);
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(fullKey(currentScope, key));
  } catch {
    /* bỏ qua */
  }
}

/** Xóa toàn bộ dữ liệu của một tài khoản (khi xóa tài khoản). */
export function clearScope(scope: string): void {
  if (scope === GUEST_SCOPE) return;
  try {
    const prefix = fullKey(scope, '');
    Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
  } catch {
    /* bỏ qua */
  }
}

/** Bỏ dấu tiếng Việt + chữ thường để tìm kiếm không phân biệt dấu. */
export function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
