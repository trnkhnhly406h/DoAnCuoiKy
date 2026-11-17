/**
 * Sinh ảnh minh họa (SVG) đồng bộ bảng màu tím của cửa hàng cho các game chưa có ảnh thật.
 * Ảnh phụ thuộc vào tên game nên luôn ổn định; thay bằng ảnh thật bằng cách khai báo
 * trong REAL_COVERS / REAL_MEDIA của GameCatalogService.
 */
const PALETTES: [string, string, string][] = [
  ['#35204e', '#542e85', '#9367c1'],
  ['#2a1840', '#7448a6', '#b186d7'],
  ['#3d2561', '#542e85', '#c5a9dc'],
  ['#35204e', '#7448a6', '#9367c1'],
  ['#241338', '#542e85', '#b186d7'],
  ['#3a2160', '#9367c1', '#c5a9dc']
];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Ngắt tiêu đề thành tối đa 3 dòng. */
function wrap(title: string, maxChars: number): string[] {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].replace(/.{1,2}$/, '…');
  }
  return lines;
}

export interface CoverOptions {
  width?: number;
  height?: number;
  /** 0 = ảnh bìa, 1/2 = ảnh minh họa. */
  variant?: number;
  caption?: string;
  /** Không vẽ tiêu đề (dùng làm ảnh nền có huy hiệu chữ phía trên). */
  noText?: boolean;
}

export function coverArt(title: string, options: CoverOptions = {}): string {
  const w = options.width ?? 480;
  const h = options.height ?? 270;
  const variant = options.variant ?? 0;
  const seed = hash(`${title}#${variant}`);
  const [c1, c2, c3] = PALETTES[hash(title) % PALETTES.length];

  const shapes: string[] = [];
  for (let i = 0; i < 6; i++) {
    const s = hash(`${seed}-${i}`);
    const cx = (s % 100) / 100 * w;
    const cy = ((s >> 7) % 100) / 100 * h;
    const r = (0.08 + (((s >> 14) % 100) / 100) * 0.28) * Math.min(w, h);
    const opacity = (0.08 + (((s >> 3) % 100) / 100) * 0.18).toFixed(2);
    shapes.push(
      i % 2 === 0
        ? `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${c3}" opacity="${opacity}"/>`
        : `<rect x="${(cx - r).toFixed(0)}" y="${(cy - r).toFixed(0)}" width="${(r * 1.6).toFixed(0)}" height="${(r * 1.6).toFixed(0)}" rx="${(r * 0.2).toFixed(0)}" transform="rotate(${(s % 60) - 30} ${cx.toFixed(0)} ${cy.toFixed(0)})" fill="#ffffff" opacity="${(Number(opacity) * 0.6).toFixed(2)}"/>`
    );
  }

  const fontSize = Math.round(h * (variant === 0 ? 0.13 : 0.08));
  const lines = options.noText ? [] : wrap(title, variant === 0 ? 14 : 22);
  const startY = h / 2 - ((lines.length - 1) * fontSize * 1.1) / 2 + fontSize * 0.2;
  const text = lines
    .map((line, i) => `<text x="${w / 2}" y="${(startY + i * fontSize * 1.15).toFixed(0)}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#ffffff">${escapeXml(line)}</text>`)
    .join('');
  const caption = options.caption
    ? `<text x="${w / 2}" y="${h - Math.round(h * 0.07)}" text-anchor="middle" font-size="${Math.round(h * 0.045)}" fill="#e9defa" opacity="0.85">${escapeXml(options.caption)}</text>`
    : '';

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Commissioner, Segoe UI, Arial, sans-serif">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="0.6" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>${shapes.join('')}` +
    `<rect width="100%" height="100%" fill="#000000" opacity="0.12"/>${text}${caption}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Banner thể loại rộng (dùng ở trang thể loại). */
export function bannerArt(label: string): string {
  return coverArt(label, { width: 1100, height: 420, variant: 2, caption: 'STEAL STORE' });
}
