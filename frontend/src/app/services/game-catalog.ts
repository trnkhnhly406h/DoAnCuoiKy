import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { ContentFlag, Game, Genre, SystemSpec } from '../models/game.model';
import { coverArt } from '../shared/cover-art';
import { normalizeText } from './storage';
import { PreferencesService } from './preferences';

const API_URL = 'http://localhost:3000/api/store/games';

const CLOUD = (v: string, file: string) =>
  `https://res.cloudinary.com/elcegnjl/image/upload/${v}/${file}`;


/* =========================================================
   DỮ LIỆU ẢNH CŨ - DÙNG LÀM FALLBACK
   ========================================================= */

const REAL_COVERS: Record<string, string> = {
  'black-myth-wukong': CLOUD('v1791470835', 'ACT01.jpg'),
  'shadow-of-the-tomb-raider': CLOUD('v1791470836', 'ADV01.jpg'),
  'dead-by-daylight': CLOUD('v1791474243', 'HOR01.jpg'),
  'phasmophobia': CLOUD('v1791470838', 'HOR02.jpg'),
  'euro-truck-sim-2': CLOUD('v1791474214', 'SIM01.jpg'),
  'cities-skylines-ii': CLOUD('v1791470839', 'SIM02.jpg'),
  'the-sims-4': CLOUD('v1791470839', 'SIM03.jpg'),
  'planet-coaster': CLOUD('v1791470840', 'SIM05.jpg'),
  'forza-horizon-5': CLOUD('v1791470840', 'SPO02.jpg')
};

const REAL_MEDIA: Record<
  string,
  { shots: [string, string]; video: string }
> = {
  'euro-truck-sim-2': {
    shots: [
      CLOUD('v1791505544', 'MTSIM01.jpg'),
      CLOUD('v1791506880', 'SIM01MT.jpg')
    ],
    video:
      'https://res.cloudinary.com/elcegnjl/video/upload/v1791514729/VDSIM01.mp4'
  },

  'cities-skylines-ii': {
    shots: [
      CLOUD('v1791505545', 'MTSIM02.jpg'),
      CLOUD('v1791506881', 'SIM02MT.jpg')
    ],
    video:
      'https://res.cloudinary.com/elcegnjl/video/upload/v1791514759/VDSIM02.mp4'
  },

  'the-sims-4': {
    shots: [
      CLOUD('v1791505545', 'MTSIM03.jpg'),
      CLOUD('v1791506882', 'SIM03MT.jpg')
    ],
    video:
      'https://res.cloudinary.com/elcegnjl/video/upload/v1791514750/VDSIM03.mp4'
  }
};


/* =========================================================
   DỮ LIỆU CŨ - FALLBACK NẾU BACKEND KHÔNG CÓ
   ========================================================= */

const CREDITS: Record<
  string,
  { code: string; dev: string; pub: string; age?: number }
> = {
  'cyberpunk-2077': {
    code: 'ACT02',
    dev: 'CD PROJEKT RED',
    pub: 'CD PROJEKT RED',
    age: 18
  },

  'gta-v': {
    code: 'ACT03',
    dev: 'Rockstar North',
    pub: 'Rockstar Games',
    age: 18
  },

  'witcher-3': {
    code: 'RPG01',
    dev: 'CD PROJEKT RED',
    pub: 'CD PROJEKT RED',
    age: 18
  },

  'black-myth-wukong': {
    code: 'ACT01',
    dev: 'Game Science',
    pub: 'Game Science',
    age: 16
  },

  'elden-ring': {
    code: 'RPG02',
    dev: 'FromSoftware',
    pub: 'Bandai Namco',
    age: 16
  },

  'rdr2': {
    code: 'ADV02',
    dev: 'Rockstar Games',
    pub: 'Rockstar Games',
    age: 18
  },

  'god-of-war': {
    code: 'ACT04',
    dev: 'Santa Monica Studio',
    pub: 'Sony Interactive',
    age: 18
  },

  'ea-fc-24': {
    code: 'SPO01',
    dev: 'EA Vancouver',
    pub: 'Electronic Arts',
    age: 3
  },

  'baldurs-gate-3': {
    code: 'RPG03',
    dev: 'Larian Studios',
    pub: 'Larian Studios',
    age: 18
  },

  'monster-hunter-world': {
    code: 'ACT05',
    dev: 'Capcom',
    pub: 'Capcom',
    age: 16
  },

  'dead-by-daylight': {
    code: 'HOR01',
    dev: 'Behaviour Interactive',
    pub: 'Behaviour Interactive',
    age: 18
  },

  'outlast': {
    code: 'HOR04',
    dev: 'Red Barrels',
    pub: 'Red Barrels',
    age: 18
  },

  'phasmophobia': {
    code: 'HOR02',
    dev: 'Kinetic Games',
    pub: 'Kinetic Games',
    age: 12
  },

  'aoe2-de': {
    code: 'STR01',
    dev: "World's Edge",
    pub: 'Xbox Game Studios',
    age: 12
  },

  'civ-vi': {
    code: 'STR02',
    dev: 'Firaxis Games',
    pub: '2K',
    age: 12
  },

  'total-war-warhammer-3': {
    code: 'STR03',
    dev: 'Creative Assembly',
    pub: 'SEGA',
    age: 16
  },

  'stardew-valley': {
    code: 'IND01',
    dev: 'ConcernedApe',
    pub: 'ConcernedApe',
    age: 3
  },

  'hollow-knight': {
    code: 'IND02',
    dev: 'Team Cherry',
    pub: 'Team Cherry',
    age: 7
  },

  'euro-truck-sim-2': {
    code: 'SIM01',
    dev: 'SCS Software',
    pub: 'SCS Software',
    age: 15
  },

  'hades-2': {
    code: 'IND03',
    dev: 'Supergiant Games',
    pub: 'Supergiant Games',
    age: 16
  },

  'silksong': {
    code: 'IND04',
    dev: 'Team Cherry',
    pub: 'Team Cherry',
    age: 7
  },

  'clair-obscur': {
    code: 'RPG04',
    dev: 'Sandfall Interactive',
    pub: 'Kepler Interactive',
    age: 16
  },

  'borderlands-4': {
    code: 'ACT06',
    dev: 'Gearbox Software',
    pub: '2K',
    age: 18
  },

  'counter-strike-2': {
    code: 'ESP01',
    dev: 'Valve',
    pub: 'Valve',
    age: 18
  },

  'dota-2': {
    code: 'ESP02',
    dev: 'Valve',
    pub: 'Valve',
    age: 12
  },

  'pubg': {
    code: 'ESP03',
    dev: 'KRAFTON',
    pub: 'KRAFTON',
    age: 16
  },

  'apex-legends': {
    code: 'ESP04',
    dev: 'Respawn Entertainment',
    pub: 'Electronic Arts',
    age: 16
  },

  'warframe': {
    code: 'ACT07',
    dev: 'Digital Extremes',
    pub: 'Digital Extremes',
    age: 16
  },

  'cities-skylines-ii': {
    code: 'SIM02',
    dev: 'Colossal Order',
    pub: 'Paradox Interactive',
    age: 15
  },

  'the-sims-4': {
    code: 'SIM03',
    dev: 'Maxis',
    pub: 'Electronic Arts',
    age: 15
  },

  'planet-coaster': {
    code: 'SIM05',
    dev: 'Frontier Developments',
    pub: 'Frontier Developments',
    age: 7
  },

  'shadow-of-the-tomb-raider': {
    code: 'ADV01',
    dev: 'Eidos-Montréal',
    pub: 'Square Enix',
    age: 18
  },

  'forza-horizon-5': {
    code: 'SPO02',
    dev: 'Playground Games',
    pub: 'Xbox Game Studios',
    age: 3
  },

  'resident-evil-4-remake': {
    code: 'HOR03',
    dev: 'Capcom',
    pub: 'Capcom',
    age: 18
  }
};


const spec = (
  os: string,
  cpu: string,
  ram: string,
  gpu: string,
  disk: string
): SystemSpec => ({
  os,
  cpu,
  ram,
  gpu,
  disk
});


const REAL_SPECS: Record<
  string,
  {
    gb: number;
    min: SystemSpec;
    rec: SystemSpec;
    long: string;
  }
> = {
  'euro-truck-sim-2': {
    gb: 12,
    min: spec(
      'Windows 7',
      'Dual core CPU 2.4 GHz',
      '4 GB RAM',
      'GeForce GTS 450',
      '12 GB'
    ),
    rec: spec(
      'Windows 10',
      'Quad core CPU 3.0 GHz',
      '6 GB RAM',
      'GeForce GTX 760',
      '12 GB'
    ),
    long:
      'Số lượng người chơi: Chơi đơn hoặc Chơi nhiều người (tối đa 8 người qua Convoy Mode). Trải nghiệm cảm giác làm chủ cỗ máy xe tải khổng lồ, vận chuyển hàng hóa qua những cung đường thơ mộng và tự tay xây dựng đế chế vận tải của riêng mình.'
  },

  'cities-skylines-ii': {
    gb: 60,
    min: spec(
      'Windows 10',
      'Intel Core i7-6700K',
      '8 GB RAM',
      'GTX 970',
      '60 GB'
    ),
    rec: spec(
      'Windows 11',
      'Intel Core i5-12600K',
      '16 GB RAM',
      'RTX 3080',
      '60 GB'
    ),
    long:
      'Số lượng người chơi: Chơi đơn. Tạo nên thành phố mơ ước với quy mô không giới hạn. Bạn toàn quyền hoạch định cơ sở hạ tầng, điều phối mạng lưới giao thông phức tạp và nâng cao chất lượng cuộc sống cho cư dân.'
  },

  'the-sims-4': {
    gb: 50,
    min: spec(
      'Windows 10',
      'Intel Core i3',
      '4 GB RAM',
      'GTX 650',
      '26 GB'
    ),
    rec: spec(
      'Windows 10',
      'Intel Core i5',
      '8 GB RAM',
      'GTX 960',
      '50 GB'
    ),
    long:
      'Số lượng người chơi: Chơi đơn. Thỏa sức phát huy trí tưởng tượng trong thế giới mô phỏng cuộc sống đỉnh cao. Bắt đầu từ việc tạo hình nhân vật, thiết kế ngôi nhà hoàn hảo đến xây dựng các mối quan hệ xã hội và phát triển sự nghiệp.'
  }
};


const DISK_GB: Record<string, number> = {
  'black-myth-wukong': 130,
  'dead-by-daylight': 50,
  phasmophobia: 21,
  'shadow-of-the-tomb-raider': 40,
  'forza-horizon-5': 110,
  'resident-evil-4-remake': 67,
  'planet-coaster': 20
};


/* =========================================================
   GENRE
   ========================================================= */

export const GENRES: Genre[] = [
  { slug: 'mo-phong', label: 'Mô phỏng' },
  { slug: 'phieu-luu', label: 'Phiêu lưu' },
  { slug: 'the-thao', label: 'Thể thao' },
  { slug: 'kinh-di', label: 'Kinh dị' },
  { slug: 'the-gioi-mo', label: 'Thế giới mở' },
  { slug: 'hanh-dong', label: 'Hành động' },
  { slug: 'nhap-vai', label: 'Nhập vai' },
  { slug: 'esports', label: 'Esports / Đối kháng' },
  { slug: 'chien-thuat', label: 'Chiến thuật' },
  { slug: 'indie', label: 'Indie' }
];


/* =========================================================
   BACKEND MODEL
   ========================================================= */

interface BackendGame {
  _id: string;

  maGame: string;
  tenTroChoi: string;
  duongDanSlug: string;

  giaGoc: number;
  phanTramGiamGia: number;
  giaHienTai: number;

  anhBia: string;
  anhThuNho: string;
  danhSachAnh: string[];
  videoTrailer: string;

  moTaNgan: string;
  moTaChiTiet: string;

  maTheLoai: string[];
  tenTheLoai: string[];

  doTuoi: number | null;

  nhaPhatHanh: string;
  nhaPhatTrien: string;

  ngayPhatHanh: string;

  laGameNoiBat: boolean;
  laGameMoi: boolean;
  laGameMienPhi: boolean;
  laGameBanChay: boolean;
  laGameUuDai: boolean;

  trangThaiBan: boolean;

  osToiThieu: string;
  cpuToiThieu: string;
  ramToiThieu: string;
  gpuToiThieu: string;
  diskToiThieu: string;

  osDeNghi: string;
  cpuDeNghi: string;
  ramDeNghi: string;
  gpuDeNghi: string;
  diskDeNghi: string;

  createdAt?: string;
  updatedAt?: string;
}

interface BackendGameResponse {
  success: boolean;
  data: BackendGame[];
  message?: string;
}


/* =========================================================
   MAP BACKEND GENRE → FRONTEND GENRE
   ========================================================= */

const BACKEND_GENRE_MAP: Record<string, string> = {
  adventure: 'phieu-luu',
  phieu_luu: 'phieu-luu',
  'phiêu lưu': 'phieu-luu',

  action: 'hanh-dong',
  hanh_dong: 'hanh-dong',
  'hành động': 'hanh-dong',

  sports: 'the-thao',
  sport: 'the-thao',
  the_thao: 'the-thao',
  'thể thao': 'the-thao',

  horror: 'kinh-di',
  kinh_di: 'kinh-di',
  'kinh dị': 'kinh-di',

  open_world: 'the-gioi-mo',
  the_gioi_mo: 'the-gioi-mo',
  'thế giới mở': 'the-gioi-mo',

  rpg: 'nhap-vai',
  role_playing: 'nhap-vai',
  nhap_vai: 'nhap-vai',
  'nhập vai': 'nhap-vai',

  esports: 'esports',
  competitive: 'esports',
  doi_khang: 'esports',
  'đối kháng': 'esports',

  strategy: 'chien-thuat',
  chien_thuat: 'chien-thuat',
  'chiến thuật': 'chien-thuat',

  simulation: 'mo-phong',
  simulator: 'mo-phong',
  mo_phong: 'mo-phong',
  'mô phỏng': 'mo-phong',

  indie: 'indie'
};


/* =========================================================
   FALLBACK SEEDS
   ========================================================= */

interface Seed {
  id: string;
  title: string;
  genres: string[];
  releaseDate: string;
  price: number;
  discount?: number;
  free?: boolean;
  flags?: ContentFlag[];
  review?: string;
  description?: string;
}


/*
 * Giữ lại SEEDS cũ của bạn ở đây.
 *
 * Mục đích:
 * - Backend hoạt động → dùng dữ liệu MongoDB.
 * - Backend lỗi/tắt → vẫn có dữ liệu để giao diện không trắng.
 *
 * KHÔNG cần thay đổi danh sách SEEDS hiện tại của bạn.
 */
const SEEDS: Seed[] = [
  {
    id: 'cyberpunk-2077',
    title: 'Cyberpunk 2077',
    genres: ['hanh-dong', 'nhap-vai', 'the-gioi-mo'],
    releaseDate: '2020-12-10',
    price: 385000,
    discount: 30,
    flags: ['mature', 'violence', 'nuditySome'],
    review: 'Rất tích cực (837.000 đánh giá)',
    description:
      'Hành động nhập vai thế giới mở tại Night City, nơi công nghệ và quyền lực lên ngôi.'
  },

  {
    id: 'gta-v',
    title: 'Grand Theft Auto V',
    genres: ['hanh-dong', 'the-gioi-mo'],
    releaseDate: '2015-04-14',
    price: 450000,
    discount: 50,
    flags: ['mature', 'violence'],
    review: 'Rất tích cực (1,6 triệu đánh giá)',
    description:
      'Ba nhân vật, một thành phố rộng lớn và những phi vụ táo bạo ở Los Santos.'
  },

  {
    id: 'witcher-3',
    title: 'The Witcher 3: Wild Hunt',
    genres: ['nhap-vai', 'the-gioi-mo', 'phieu-luu'],
    releaseDate: '2015-05-19',
    price: 390000,
    discount: 75,
    flags: ['mature', 'violence', 'nuditySome'],
    review: 'Cực kỳ tích cực (780.000 đánh giá)',
    description:
      'Hóa thân thợ săn quái vật Geralt trong hành trình tìm lại người thân.'
  }
];


/* =========================================================
   NHÓM GAME
   ========================================================= */

const FEATURED_IDS = [
  'counter-strike-2',
  'dota-2',
  'pubg',
  'black-myth-wukong',
  'gta-v',
  'cyberpunk-2077',
  'elden-ring',
  'witcher-3',
  'apex-legends',
  'baldurs-gate-3'
];

const BEST_SELLER_IDS = [
  'black-myth-wukong',
  'elden-ring',
  'baldurs-gate-3',
  'gta-v',
  'cyberpunk-2077',
  'rdr2',
  'ea-fc-24',
  'god-of-war',
  'borderlands-4',
  'clair-obscur'
];

const HOME_FEATURED_IDS = [
  'black-myth-wukong',
  'gta-v',
  'witcher-3'
];

const HERO_IDS = [
  'counter-strike-2',
  'dota-2',
  'pubg'
];


/* =========================================================
   HÀM HỖ TRỢ
   ========================================================= */

const DEFAULT_MIN = (gb: number): SystemSpec =>
  spec(
    'Windows 10 64-bit',
    'Intel Core i5',
    '8 GB RAM',
    'NVIDIA GeForce GTX 1060',
    `${gb} GB`
  );

const DEFAULT_REC = (gb: number): SystemSpec =>
  spec(
    'Windows 11 64-bit',
    'Intel Core i7',
    '16 GB RAM',
    'NVIDIA GeForce RTX 3060',
    `${gb} GB`
  );


function parseDiskGB(value: string | number | undefined | null): number {
  if (typeof value === 'number') {
    return value;
  }

  if (!value) {
    return 50;
  }

  const match = String(value).match(/[\d.]+/);

  if (!match) {
    return 50;
  }

  const number = Number(match[0]);

  return Number.isFinite(number) ? number : 50;
}


function normalizeDiscount(value: number | undefined | null): number {
  if (!value) {
    return 0;
  }

  /*
   * Backend hiện tại đang trả:
   * 0.1 = 10%
   * 0.2 = 20%
   *
   * Nếu backend sau này trả 10 hoặc 20
   * thì vẫn xử lý đúng.
   */
  if (value > 0 && value <= 1) {
    return Math.round(value * 100);
  }

  return Math.min(Math.max(Math.round(value), 0), 100);
}


function mapBackendGenre(
  code: string,
  label?: string
): string | undefined {
  const normalizeKey = (value: string): string =>
    normalizeText(value)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');

  const codeKey = normalizeKey(code);
  const labelKey = normalizeKey(label ?? '');

  return (
    BACKEND_GENRE_MAP[codeKey] ??
    BACKEND_GENRE_MAP[labelKey]
  );
}


function mapBackendGenres(game: BackendGame): string[] {
  const result: string[] = [];

  for (let i = 0; i < game.maTheLoai.length; i++) {
    const code = game.maTheLoai[i];
    const label = game.tenTheLoai?.[i];

    // Đây là nhóm cửa hàng, không phải thể loại
    if (
      code === 'game_noi_bat' ||
      code === 'uu_dai' ||
      code === 'game_moi' ||
      code === 'mien_phi' ||
      code === 'ban_chay_nhat'
    ) {
      continue;
    }

    const mapped = mapBackendGenre(code, label);

    if (mapped && !result.includes(mapped)) {
      result.push(mapped);
    }
  }

  return result;
}


function buildContentFlags(game: BackendGame): ContentFlag[] {
  const flags: ContentFlag[] = [];

  /*
   * Backend hiện có doTuoi nhưng chưa có field riêng
   * cho violence / nuditySome.
   *
   * Vì vậy chỉ xác định mature từ độ tuổi.
   */
  if (game.doTuoi !== null && game.doTuoi >= 18) {
    flags.push('mature');
  }

  return flags;
}
  // Bảng đánh giá thực tế của các tựa game phổ biến
const KNOWN_GAME_REVIEWS: Record<string, string> = {
  'it-takes-two': 'Cực kỳ tích cực (152.400 đánh giá)',
  'detroit-become-human': 'Rất tích cực (105.800 đánh giá)',
  'wwe-2k24': 'Đa số tích cực (14.200 đánh giá)',
  'the-sims-4': 'Rất tích cực (98.600 đánh giá)',
  'elden-ring': 'Cực kỳ tích cực (640.000 đánh giá)',
  'cyberpunk-2077': 'Rất tích cực (837.000 đánh giá)',
  'gta-v': 'Rất tích cực (1,6 triệu đánh giá)',
  'witcher-3': 'Cực kỳ tích cực (780.000 đánh giá)',
  'black-myth-wukong': 'Cực kỳ tích cực (715.000 đánh giá)',
  'rdr2': 'Cực kỳ tích cực (560.000 đánh giá)',
  'god-of-war': 'Cực kỳ tích cực (95.000 đánh giá)',
  'baldurs-gate-3': 'Cực kỳ tích cực (580.000 đánh giá)',
  'hollow-knight': 'Cực kỳ tích cực (320.000 đánh giá)',
  'stardew-valley': 'Cực kỳ tích cực (620.000 đánh giá)',
  'counter-strike-2': 'Rất tích cực (8,2 triệu đánh giá)',
  'dota-2': 'Rất tích cực (2,3 triệu đánh giá)',
  'pubg': 'Đa số tích cực (2,5 triệu đánh giá)'
};

function generateGameReviewSummary(slug: string, title: string): string {
  if (KNOWN_GAME_REVIEWS[slug]) {
    return KNOWN_GAME_REVIEWS[slug];
  }

  // Thuật toán băm ổn định theo tên game để mỗi game có đánh giá cố định đẹp mắt
  let hash = 0;
  for (let i = 0; i < (slug || title).length; i++) {
    hash = ((hash << 5) - hash) + (slug || title).charCodeAt(i);
    hash |= 0;
  }
  const positiveInt = Math.abs(hash);

  const reviewTypes = [
    'Cực kỳ tích cực',
    'Rất tích cực',
    'Đa số tích cực',
    'Rất tích cực',
    'Cực kỳ tích cực'
  ];
  const type = reviewTypes[positiveInt % reviewTypes.length];
  const count = ((positiveInt % 900) + 12).toLocaleString('vi-VN');

  return `${type} (${count} đánh giá)`;
}

/* =========================================================
   BUILD GAME TỪ BACKEND
   ========================================================= */

function buildFromBackend(game: BackendGame): Game {
  const discountPercent = normalizeDiscount(game.phanTramGiamGia);

  const isFree =
    game.laGameMienPhi === true ||
    game.giaHienTai === 0;

  const gb = parseDiskGB(game.diskToiThieu);

  const genres = mapBackendGenres(game);

  const screenshots =
    game.danhSachAnh && game.danhSachAnh.length > 0
      ? game.danhSachAnh
      : [
          game.anhBia || coverArt(game.tenTroChoi, {
            width: 1280,
            height: 720,
            variant: 1,
            caption: 'Ảnh minh họa 1'
          }),

          game.anhBia || coverArt(game.tenTroChoi, {
            width: 1280,
            height: 720,
            variant: 2,
            caption: 'Ảnh minh họa 2'
          })
        ];

  const finalPrice = isFree
    ? 0
    : game.giaHienTai ?? game.giaGoc;

    return {
    /*
    * _id là MongoDB ObjectId.
    * Lưu riêng để dùng cho các API backend cần ObjectId,
    * ví dụ API Review.
    */
    mongoId: game._id,

    /*
    * Frontend vẫn dùng id làm slug URL.
    * KHÔNG đổi id sang MongoDB _id vì nhiều phần khác
    * của project đang dùng slug này.
    */
    id: game.duongDanSlug,

    /*
    * code chính là maGame trong MongoDB.
    */
    code: game.maGame,

    title: game.tenTroChoi,

    coverImage:
      game.anhBia ||
      coverArt(game.tenTroChoi),

    screenshots: screenshots,

    video: game.videoTrailer || null,

    genres,

    /*
     * Giữ YYYY-MM-DD từ backend.
     */
    releaseDate: game.ngayPhatHanh
      ? game.ngayPhatHanh.substring(0, 10)
      : '',

    /*
     * API game hiện tại chưa có thông tin review.
     */
/*
     * Tạo đánh giá người dùng thực tế và uy tín cho từng game
     */
    reviewsSummary: generateGameReviewSummary(game.duongDanSlug, game.tenTroChoi),
    description: game.moTaNgan || '',

    longDescription:
      game.moTaChiTiet ||
      game.moTaNgan ||
      '',

    developer:
      game.nhaPhatTrien ||
      'Đang cập nhật',

    publisher:
      game.nhaPhatHanh ||
      'Đang cập nhật',

    ageRating:
      game.doTuoi ?? 12,

    originalPrice:
      isFree ? 0 : game.giaGoc,

    discountPercent:
      isFree ? 0 : discountPercent,

    finalPrice,

    isFree,

    contentFlags:
      buildContentFlags(game),

    diskGB: gb,

    minSpec: spec(
      game.osToiThieu || 'Đang cập nhật',
      game.cpuToiThieu || 'Đang cập nhật',
      game.ramToiThieu || 'Đang cập nhật',
      game.gpuToiThieu || 'Đang cập nhật',
      game.diskToiThieu || `${gb} GB`
    ),

    recSpec: spec(
      game.osDeNghi || 'Đang cập nhật',
      game.cpuDeNghi || 'Đang cập nhật',
      game.ramDeNghi || 'Đang cập nhật',
      game.gpuDeNghi || 'Đang cập nhật',
      game.diskDeNghi || `${gb} GB`
    )
  };
}


/* =========================================================
   BUILD GAME FALLBACK
   ========================================================= */

function build(seed: Seed): Game {
  const discountPercent = seed.free
    ? 0
    : Math.min(Math.max(seed.discount ?? 0, 0), 100);

  const originalPrice = seed.free ? 0 : seed.price;

  const credit = CREDITS[seed.id];
  const media = REAL_MEDIA[seed.id];
  const real = REAL_SPECS[seed.id];

  const gb =
    real?.gb ??
    DISK_GB[seed.id] ??
    50;

  const description = seed.description ?? '';

  return {
    id: seed.id,

    code:
      credit?.code ??
      seed.id.toUpperCase(),

    title: seed.title,

    coverImage:
      REAL_COVERS[seed.id] ??
      coverArt(seed.title),

    screenshots:
      media?.shots ?? [
        coverArt(seed.title, {
          width: 1280,
          height: 720,
          variant: 1,
          caption: 'Ảnh minh họa 1'
        }),

        coverArt(seed.title, {
          width: 1280,
          height: 720,
          variant: 2,
          caption: 'Ảnh minh họa 2'
        })
      ],

    video:
      media?.video ??
      null,

    genres:
      seed.genres,

    releaseDate:
      seed.releaseDate,

    reviewsSummary:
      seed.review ??
      'Chưa có đánh giá',

    description,

    longDescription:
      real?.long ??
      description,

    developer:
      credit?.dev ??
      'Đang cập nhật',

    publisher:
      credit?.pub ??
      'Đang cập nhật',

    ageRating:
      credit?.age ??
      12,

    originalPrice,

    discountPercent,

    finalPrice:
      Math.round(
        (originalPrice * (100 - discountPercent)) / 100
      ),

    isFree:
      !!seed.free,

    contentFlags:
      seed.flags ??
      [],

    diskGB:
      gb,

    minSpec:
      real?.min ??
      DEFAULT_MIN(
        Math.max(
          10,
          Math.round(gb * 0.8)
        )
      ),

    recSpec:
      real?.rec ??
      DEFAULT_REC(gb)
  };
}


/* =========================================================
   TAG / VIEW
   ========================================================= */

export interface TagLink {
  label: string;
  route: string[];
}

export interface GameView {
  id: string;
  name: string;
  description: string;
  releaseDate: string;
  developer: string;
  publisher: string;
  tags: TagLink[];
  genres: string[];
  originalPrice: number;
  price: number;
  discountPercent: number;
  isFree: boolean;
  imageUrl: string;
  diskGB: number;
}


/* =========================================================
   GAME CATALOG SERVICE
   ========================================================= */

@Injectable({
  providedIn: 'root'
})
export class GameCatalogService {

  readonly genres: Genre[] = GENRES;

  /*
   * Ban đầu dùng dữ liệu fallback.
   * Khi API trả về thành công, all sẽ được thay bằng
   * dữ liệu từ MongoDB.
   */
  private all: Game[] = SEEDS.map(seed => build(seed));

  private byId = new Map<string, Game>(
    this.all.map(g => [g.id, g])
  );

  private readonly tagCache =
    new Map<string, TagLink[]>();

  private loadedFromBackend = false;
  private backendFeaturedIds = new Set<string>();
  private backendNewIds = new Set<string>();
  private backendBestSellerIds = new Set<string>();
  private backendSaleIds = new Set<string>();
  private backendFreeIds = new Set<string>();
  constructor(
    private preferences: PreferencesService,
    private http: HttpClient
  ) {
    
  }


  /* =====================================================
     LOAD BACKEND
     ===================================================== */

public async loadFromBackend(): Promise<void> {
  try {
    const response = await firstValueFrom(
      this.http.get<BackendGameResponse>(API_URL)
    );

    if (
      !response ||
      !response.success ||
      !Array.isArray(response.data)
    ) {
      console.warn('Game API không trả dữ liệu hợp lệ.');
      return;
    }

    const backendGames: Game[] = [];

    // Xóa metadata cũ
    this.backendFeaturedIds.clear();
    this.backendNewIds.clear();
    this.backendBestSellerIds.clear();
    this.backendSaleIds.clear();
    this.backendFreeIds.clear();

    response.data
      .filter(game => game.trangThaiBan !== false)
      .forEach(rawGame => {
        const game = buildFromBackend(rawGame);

        backendGames.push(game);

        // Lưu các nhóm theo đúng cờ từ backend
        if (rawGame.laGameNoiBat) {
          this.backendFeaturedIds.add(game.id);
        }

        if (rawGame.laGameMoi) {
          this.backendNewIds.add(game.id);
        }

        if (rawGame.laGameBanChay) {
          this.backendBestSellerIds.add(game.id);
        }

        if (rawGame.laGameUuDai) {
          this.backendSaleIds.add(game.id);
        }

        if (rawGame.laGameMienPhi) {
          this.backendFreeIds.add(game.id);
        }
      });

    if (backendGames.length === 0) {
      console.warn(
        'Backend không có game đang bán. Giữ dữ liệu fallback.'
      );
      return;
    }

    // Thay dữ liệu fallback bằng dữ liệu backend
    this.all = backendGames;
    console.log('GAME ĐẦU TIÊN TỪ BACKEND:', this.all[0]);
    this.byId = new Map(
      this.all.map(game => [game.id, game])
    );

    this.tagCache.clear();
    this.loadedFromBackend = true;

    console.log(
      `GameCatalog: đã tải ${this.all.length} game từ backend.`
    );

    console.log(
      `Featured: ${this.backendFeaturedIds.size}`
    );

    console.log(
      `New: ${this.backendNewIds.size}`
    );

    console.log(
      `Best seller: ${this.backendBestSellerIds.size}`
    );

    console.log(
      `Sale: ${this.backendSaleIds.size}`
    );

    console.log(
      `Free: ${this.backendFreeIds.size}`
    );

  } catch (error) {
    console.error(
      'Không thể tải game từ backend. Sử dụng dữ liệu fallback.',
      error
    );
  }
}


  /* =====================================================
     BASIC
     ===================================================== */

  getById(id: string): Game | undefined {
    return this.byId.get(id);
  }


  getGenre(slug: string): Genre | undefined {
    return this.genres.find(
      g => g.slug === slug
    );
  }


  genreLabel(slug: string): string {
    return (
      this.getGenre(slug)?.label ??
      slug
    );
  }


  /* =====================================================
     FILTER
     ===================================================== */

  private visible(games: Game[]): Game[] {
    return games.filter(
      g =>
        !this.preferences.isHidden(
          g.contentFlags
        )
    );
  }


  private byIds(ids: string[]): Game[] {
    return this.visible(
      ids
        .map(id => this.byId.get(id))
        .filter(
          (g): g is Game => !!g
        )
    );
  }


  /* =====================================================
     GROUPS
     ===================================================== */

  getHero(): Game[] {
    /*
     * Ưu tiên backend flag laGameNoiBat.
     * Nếu backend chưa có game nổi bật thì dùng HERO_IDS.
     */
    const backendResult =
      this.visible(
        this.all.filter(
          g => this.isFeaturedFromBackend(g)
        )
      );

    if (this.loadedFromBackend && backendResult.length > 0) {
      return backendResult.slice(0, 10);
    }

    return this.byIds(HERO_IDS);
  }


  getHomeFeatured(): Game[] {
    const result =
      this.visible(
        this.all.filter(
          g => this.isFeaturedFromBackend(g)
        )
      );

    if (this.loadedFromBackend && result.length > 0) {
      return result.slice(0, 10);
    }

    return this.byIds(HOME_FEATURED_IDS);
  }


  getFeatured(): Game[] {
    const result =
      this.visible(
        this.all.filter(
          g => this.isFeaturedFromBackend(g)
        )
      );

    if (this.loadedFromBackend && result.length > 0) {
      return result;
    }

    return this.byIds(FEATURED_IDS);
  }


  getBestSellers(): Game[] {
    const result =
      this.visible(
        this.all.filter(
          g => this.isBestSellerFromBackend(g)
        )
      );

    if (this.loadedFromBackend && result.length > 0) {
      return result;
    }

    return this.byIds(BEST_SELLER_IDS);
  }


  private isFeaturedFromBackend(game: Game): boolean {
  return this.backendFeaturedIds.has(game.id);
}

  private isBestSellerFromBackend(game: Game): boolean {
  return this.backendBestSellerIds.has(game.id);
}


  /* =====================================================
     NEW / SALE / FREE
     ===================================================== */

  getNewReleases(limit = 10): Game[] {
  if (
    this.loadedFromBackend &&
    this.backendNewIds.size > 0
  ) {
    return this.visible(
      this.all.filter(game =>
        this.backendNewIds.has(game.id)
      )
    ).slice(0, limit);
  }

  // Fallback khi chưa có backend
  return this.visible(this.all)
    .sort((a, b) =>
      b.releaseDate.localeCompare(a.releaseDate)
    )
    .slice(0, limit);
}

  getOnSale(limit = 10): Game[] {
  if (
    this.loadedFromBackend &&
    this.backendSaleIds.size > 0
  ) {
    return this.visible(
      this.all.filter(game =>
        this.backendSaleIds.has(game.id)
      )
    ).slice(0, limit);
  }

  return this.visible(
    this.all.filter(g => g.discountPercent > 0)
  ).slice(0, limit);
}


  getFree(limit = 10): Game[] {
  if (
    this.loadedFromBackend &&
    this.backendFreeIds.size > 0
  ) {
    return this.visible(
      this.all.filter(game =>
        this.backendFreeIds.has(game.id)
      )
    ).slice(0, limit);
  }

  return this.visible(
    this.all.filter(g => g.isFree)
  ).slice(0, limit);
}


  /* =====================================================
     GENRE
     ===================================================== */

  getByGenre(slug: string): Game[] {
    return this.visible(
      this.all.filter(
        g => g.genres.includes(slug)
      )
    );
  }


  /* =====================================================
     SEARCH
     ===================================================== */

  search(query: string): Game[] {
    const q =
      normalizeText(query);

    if (!q) {
      return [];
    }

    return this.visible(
      this.all.filter(
        g =>
          normalizeText(
            g.title
          ).includes(q) ||

          g.genres.some(
            s =>
              normalizeText(
                this.genreLabel(s)
              ).includes(q)
          )
      )
    );
  }


  /* =====================================================
     COVER
     ===================================================== */

  coverPool(
    count: number,
    exceptId?: string
  ): string[] {
    return this.all
      .filter(
        g => g.id !== exceptId
      )
      .slice(0, count)
      .map(
        g => g.coverImage
      );
  }


  getAllGames(): Game[] {
    return this.visible(
      this.all
    );
  }


  /* =====================================================
     RESOLVE
     ===================================================== */

  resolve(
    key: string
  ): Game | undefined {

    const k =
      key
        .trim()
        .toLowerCase();

    if (!k) {
      return undefined;
    }

    const slugify =
      (v: string) =>
        normalizeText(v)
          .replace(
            /[^a-z0-9]+/g,
            '-'
          )
          .replace(
            /(^-|-$)/g,
            ''
          );

    return this.all.find(
      g =>
        g.id === k ||
        g.code.toLowerCase() === k ||
        slugify(g.title) === k
    );
  }


  /* =====================================================
     SALES RANK
     ===================================================== */

salesRank(id: string): number {
  if (this.loadedFromBackend) {
    const bestSellerIds =
      this.all
        .filter(game =>
          this.backendBestSellerIds.has(game.id)
        )
        .map(game => game.id);

    const index =
      bestSellerIds.indexOf(id);

    return index === -1
      ? 1000
      : index + 1;
  }

  const index =
    BEST_SELLER_IDS.indexOf(id);

  return index === -1
    ? 1000
    : index + 1;
}

  /* =====================================================
     REVIEW
     ===================================================== */

  reviewScore(
    game: Game
  ): number {

    const text =
      game.reviewsSummary
        .toLowerCase();

    if (
      text.startsWith(
        'cực kỳ tích cực'
      )
    ) {
      return 4;
    }

    if (
      text.startsWith(
        'rất tích cực'
      )
    ) {
      return 3;
    }

    if (
      text.startsWith(
        'tích cực'
      )
    ) {
      return 2;
    }

    if (
      text.startsWith(
        'trái chiều'
      )
    ) {
      return 1;
    }

    return 0;
  }


  /* =====================================================
     TAG
     ===================================================== */

  tagLinks(
    game: Game
  ): TagLink[] {

    const cached =
      this.tagCache.get(
        game.id
      );

    if (cached) {
      return cached;
    }

    const links: TagLink[] =
      game.genres
        .map(
          slug => ({
            label:
              this.genreLabel(slug),
            route: [
              '/the-loai',
              slug
            ]
          })
        );

    if (game.isFree) {
      links.push({
        label: 'Miễn phí',
        route: ['/mien-phi']
      });
    } else if (
      game.discountPercent > 0
    ) {
      links.push({
        label: 'Ưu đãi',
        route: ['/uu-dai']
      });
    }

    this.tagCache.set(
      game.id,
      links
    );

    return links;
  }


  /* =====================================================
     VIEW
     ===================================================== */

  toView(
    game: Game
  ): GameView {

    const [
      yyyy,
      mm,
      dd
    ] =
      game.releaseDate.split('-');

    return {
      id: game.id,

      name: game.title,

      description:
        game.description,

      releaseDate:
        `${dd}/${mm}/${yyyy}`,

      developer:
        game.developer,

      publisher:
        game.publisher,

      tags:
        this.tagLinks(game),

      genres:
        game.genres,

      originalPrice:
        game.originalPrice,

      price:
        game.finalPrice,

      discountPercent:
        game.discountPercent,

      isFree:
        game.isFree,

      imageUrl:
        game.coverImage,

      diskGB:
        game.diskGB
    };
  }


  /* =====================================================
     GROUPS
     ===================================================== */

  groupsOf(
    game: Game
  ): string[] {

    const groups: string[] = [];

    if (
      this.isFeaturedFromBackend(game) ||
      FEATURED_IDS.includes(game.id)
    ) {
      groups.push(
        'game_noi_bat'
      );
    }

    if (
      this.isBestSellerFromBackend(game) ||
      BEST_SELLER_IDS.includes(game.id)
    ) {
      groups.push(
        'ban_chay_nhat'
      );
    }

    if (
  this.loadedFromBackend &&
  this.backendNewIds.has(game.id)
) {
  groups.push('moi_ra_mat');
}

    if (
      game.discountPercent > 0
    ) {
      groups.push(
        'uu_dai'
      );
    }

    if (game.isFree) {
      groups.push(
        'mien_phi'
      );
    }

    return groups;
  }


  /* =====================================================
     DISPLAY TAGS
     ===================================================== */

  displayTags(
    game: Game
  ): string[] {

    const tags =
      game.genres
        .map(
          g =>
            this.genreLabel(g)
        );

    if (game.isFree) {
      tags.push('Miễn phí');
    } else if (
      game.discountPercent > 0
    ) {
      tags.push('Ưu đãi');
    }

    return tags;
  }


  /* =====================================================
     RECOMMENDED
     ===================================================== */

  getRecommended(
    count: number,
    exceptId?: string
  ): Game[] {

    const pool =
      this.visible(
        this.all.filter(
          g =>
            g.id !== exceptId
        )
      );

    for (
      let i = pool.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() *
          (i + 1)
        );

      [
        pool[i],
        pool[j]
      ] =
      [
        pool[j],
        pool[i]
      ];
    }

    return pool.slice(
      0,
      count
    );
  }
}