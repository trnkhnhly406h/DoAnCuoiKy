
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// ===============================
// IMPORT MODELS
// ===============================
const Game = require('./models/Game');
const Category = require('./models/Category');
const User = require('./models/User');
const Order = require('./models/Order');
const Review = require('./models/Review');
const RefundRequest = require('./models/RefundRequest');

// ===============================
// FILE DATA
// ===============================
const DATA_DIR = path.join(__dirname, 'data');

const GAME_FILE = path.join(DATA_DIR, 'data_game.xlsx');
const ADMIN_FILE = path.join(DATA_DIR, 'data_admin.xlsx');

// ===============================
// CONNECT DATABASE
// ===============================
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('======================================');
    console.log('MongoDB connected!');
    console.log('======================================');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// ===============================
// READ EXCEL
// ===============================
function readExcel(filePath) {
  console.log('\nĐang đọc file:');
  console.log(filePath);

  return XLSX.readFile(filePath);
}

// ===============================
// HELPER
// ===============================
function cleanString(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  return value.toString().trim();
}

function isEmpty(value) {
  return (
    value === null ||
    value === undefined ||
    value === ''
  );
}

function splitValues(value) {
  if (isEmpty(value)) {
    return [];
  }

  return value
    .toString()
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function toBoolean(value) {
  if (
    value === true ||
    value === 1 ||
    value === '1'
  ) {
    return true;
  }

  if (
    typeof value === 'string' &&
    value.toLowerCase() === 'true'
  ) {
    return true;
  }

  return false;
}

function parseDate(value) {
  if (isEmpty(value)) {
    return null;
  }

  // Excel lưu ngày dưới dạng số serial
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) {
      return null;
    }

    return new Date(
      parsed.y,
      parsed.m - 1,
      parsed.d,
      parsed.H || 0,
      parsed.M || 0,
      Math.floor(parsed.S || 0)
    );
  }

  // Trường hợp dữ liệu đã là Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Trường hợp dữ liệu là chuỗi
  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseMoney(value) {
  if (isEmpty(value)) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number(
    value
      .toString()
      .replace(/\./g, '')
      .replace(/,/g, '.')
      .replace(/[^\d.-]/g, '')
  ) || 0;
}

// ===============================
// CREATE SLUG
// ===============================
function createSlug(text) {
  return cleanString(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ===============================
// GET GAME CODES FROM SUB-SHEETS
// ===============================
function getGameCodes(sheet) {
  if (!sheet) {
    return new Set();
  }

  const data = XLSX.utils.sheet_to_json(sheet);

  return new Set(
    data
      .map(row => cleanString(row.maGame))
      .filter(Boolean)
  );
}

// ===============================
// TRANSFORM GAME
// ===============================
function transformGame(
  row,
  featuredCodes,
  newCodes,
  freeCodes,
  bestsellerCodes,
  dealCodes
) {
  const maGame = cleanString(row.maGame);
  const tenGame = cleanString(row.tenGame);

  const giaGoc = parseMoney(row.giaGoc);

  // 0.2 = giảm 20%, 0.1 = giảm 10%
  const phanTramGiamGia =
    Number(row.phanTramGiamGia) || 0;

  // Dùng giáSauGiam trong Excel
  const giaHienTai = parseMoney(row.giaSauGiam);

  return {
    maGame,

    tenTroChoi: tenGame,

    duongDanSlug:
      cleanString(row.duongDanSlug) ||
      createSlug(tenGame),

    giaGoc,

    phanTramGiamGia,

    giaHienTai,

    anhBia: cleanString(row.anhBia),

    anhThuNho: cleanString(row.anhBia),

    danhSachAnh: [
      cleanString(row.anhMota1),
      cleanString(row.anhMota2)
    ].filter(Boolean),

    videoTrailer: cleanString(row.videoTrailer),

    moTaNgan: cleanString(row.moTaNgan),

    moTaChiTiet: cleanString(row.moTaChiTiet),

    maTheLoai: splitValues(row.maTheLoai),

    tenTheLoai: splitValues(row.tenTheLoai),

    doTuoi:
      isEmpty(row.doTuoi)
        ? null
        : Number(row.doTuoi),

    nhaPhatHanh: cleanString(row.nhaPhatHanh),

    nhaPhatTrien: cleanString(row.nhaPhatTrien),

    ngayPhatHanh: parseDate(row.ngayPhatHanh),

    laGameNoiBat: featuredCodes.has(maGame),

    laGameMoi: newCodes.has(maGame),

    laGameMienPhi: freeCodes.has(maGame),

    laGameBanChay: bestsellerCodes.has(maGame),

    laGameUuDai: dealCodes.has(maGame),

    trangThaiBan: true,

    osToiThieu: cleanString(row.osToiThieu),

    cpuToiThieu: cleanString(row.cpuToiThieu),

    ramToiThieu: cleanString(row.ramToiThieu),

    gpuToiThieu: cleanString(row.gpuToiThieu),

    diskToiThieu: cleanString(row.diskToiThieu),

    osDeNghi: cleanString(row.osDeNghi),

    cpuDeNghi: cleanString(row.cpuDeNghi),

    ramDeNghi: cleanString(row.ramDeNghi),

    gpuDeNghi: cleanString(row.gpuDeNghi),

    diskDeNghi: cleanString(row.diskDeNghi)
  };
}

// ===============================
// TRANSFORM CATEGORY
// ===============================
function transformCategory(row) {
  return {
    maTheLoai: cleanString(row.maTheLoai),

    tenTheLoai: cleanString(row.tenTheLoai),

    moTa: cleanString(row.moTa)
  };
}

// ===============================
// TRANSFORM USER
// ===============================
async function transformUser(row) {
  const maTaiKhoan =
    cleanString(row.maTaiKhoanNguoiDung);

  const passwordHash =
    await bcrypt.hash('Steal@123', 10);

  let rawPhone = cleanString(row.soDienThoai);
  if (rawPhone && rawPhone !== 'null' && !rawPhone.startsWith('0') && /^\d{9}$/.test(rawPhone)) {
    rawPhone = '0' + rawPhone;
  }

  const rawLyDoKhoa = cleanString(row.lyDoKhoa);
  const lyDoKhoa = rawLyDoKhoa === 'null' ? '' : rawLyDoKhoa;

  const rawNgayKhoa = cleanString(row.ngayKhoa);
  const ngayKhoa = rawNgayKhoa === 'null' ? null : parseDate(row.ngayKhoa);

  return {
    maTaiKhoan,

    tenDangNhap:
      cleanString(row.tenTaiKhoanNguoiDung),

    email:
      cleanString(row.email),

    soDienThoai:
      rawPhone === 'null' ? '' : rawPhone,

    hoTen:
      cleanString(row.hoTen),

    matKhau: passwordHash,

    anhDaiDien:
      cleanString(row.anhDaiDien),

    vaiTro: 'customer',

    quyen: [],

    viTien: 0,

    biKhoa:
      toBoolean(row.trangThaiKhoa),

    lyDoKhoa,

    ngayKhoa,

    ngayDangKy:
      parseDate(row.ngayDangKy),

    xacThuc2FA: false,

    quocTich:
      cleanString(row.quocTich),

    danhSachGameDaMua: [],

    danhSachGameYeuThich: []
  };
}

// ===============================
// TRANSFORM ADMIN
// ===============================
async function transformAdmin(row) {
  const passwordHash =
    await bcrypt.hash('Steal@123', 10);

  let quyen = [];

  return {
    maTaiKhoan:
      cleanString(row.maTaiKhoanAdmin),

    tenDangNhap:
      cleanString(row.tenTaiKhoanAdmin),

    email:
      cleanString(row.email),

    hoTen:
      cleanString(row.hoTen),

    matKhau: passwordHash,

    anhDaiDien:
      cleanString(row.anhDaiDien),

    vaiTro: 'admin',

    quyen,

    viTien: 0,

    biKhoa:
      toBoolean(row.trangThaiKhoa),

    lyDoKhoa:
      cleanString(row.lyDoKhoa),

    ngayDangKy:
      parseDate(row.ngayTao),

    xacThuc2FA:
      toBoolean(row.bat2FA),

    quocTich: '',

    danhSachGameDaMua: [],

    danhSachGameYeuThich: []
  };
}

// ===============================
// MAP ORDER GAME
// ===============================
function parseGameNames(value) {
  if (isEmpty(value)) {
    return [];
  }

  return value
    .toString()
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);
}

// ===============================
// NORMALIZE ORDER STATUS
// ===============================
function normalizeOrderStatus(value) {
  const status = cleanString(value).toLowerCase();

  const statusMap = {
    thanh_cong: 'completed',
    hoan_tien: 'completed',
    tu_choi: 'completed',
    da_huy: 'cancelled',
    pending: 'pending',
    completed: 'completed',
    cancelled: 'cancelled'
  };

  const result = statusMap[status];

  if (!result) {
    throw new Error(
      `Trạng thái đơn hàng không hợp lệ: ${value}`
    );
  }

  return result;
}

// ===============================
// NORMALIZE REFUND STATUS
// ===============================
function normalizeRefundStatus(value) {
  const status = cleanString(value).toLowerCase();

  const statusMap = {
    hoan_tien: 'approved',
    approved: 'approved',
    tu_choi: 'rejected',
    rejected: 'rejected',
    cho_xu_ly: 'pending',
    pending: 'pending'
  };

  const result = statusMap[status];

  if (!result) {
    throw new Error(
      `Trạng thái hoàn tiền không hợp lệ: ${value}`
    );
  }

  return result;
}

// ===============================
// MAIN SEED
// ===============================
async function seed() {
  try {
    await connectDB();

    // ==================================
    // CHECK FILE
    // ==================================
    if (!require('fs').existsSync(GAME_FILE)) {
      throw new Error(
        `Không tìm thấy file:\n${GAME_FILE}`
      );
    }

    if (!require('fs').existsSync(ADMIN_FILE)) {
      throw new Error(
        `Không tìm thấy file:\n${ADMIN_FILE}`
      );
    }

    const gameWorkbook = readExcel(GAME_FILE);

    const adminWorkbook = readExcel(ADMIN_FILE);

    console.log('\n======================================');
    console.log('BẮT ĐẦU SEED DATABASE');
    console.log('======================================');

    // ==================================
    // 1. GAME
    // ==================================
    console.log('\n[1] SEED GAME');

    const gamesSheet =
      gameWorkbook.Sheets['Games'];

    if (!gamesSheet) {
      throw new Error(
        'Không tìm thấy sheet Games!'
      );
    }

    const gamesData =
      XLSX.utils.sheet_to_json(gamesSheet);

    const featuredCodes =
      getGameCodes(
        gameWorkbook.Sheets['Game nổi bật']
      );

    const newCodes =
      getGameCodes(
        gameWorkbook.Sheets['Game mới ra mắt']
      );

    const freeCodes =
      getGameCodes(
        gameWorkbook.Sheets['Miễn phí']
      );

    const bestsellerCodes =
      getGameCodes(
        gameWorkbook.Sheets['Bán chạy nhất']
      );

    const dealCodes =
      getGameCodes(
        gameWorkbook.Sheets['Ưu đãi']
      );

    const games =
      gamesData.map(row =>
        transformGame(
          row,
          featuredCodes,
          newCodes,
          freeCodes,
          bestsellerCodes,
          dealCodes
        )
      );

    await Game.deleteMany({});

    const insertedGames =
      await Game.insertMany(games);

    console.log(
      `✓ Game: ${insertedGames.length}`
    );

    // ==================================
    // GAME MAP
    // ==================================
    const gameMap = new Map();

    insertedGames.forEach(game => {
      gameMap.set(game.maGame, game);

      gameMap.set(
        `NAME:${game.tenTroChoi}`,
        game
      );
    });

    // ==================================
    // 2. CATEGORY
    // ==================================
    console.log('\n[2] SEED CATEGORY');

    const categoriesSheet =
      gameWorkbook.Sheets['Categories'];

    const categoriesData =
      XLSX.utils.sheet_to_json(categoriesSheet);

    const categories =
      categoriesData.map(transformCategory);

    await Category.deleteMany({});

    const insertedCategories =
      await Category.insertMany(categories);

    console.log(
      `✓ Category: ${insertedCategories.length}`
    );

    // ==================================
    // 3. USER
    // ==================================
    console.log('\n[3] SEED USER');

    const usersSheet =
      adminWorkbook.Sheets['users_test.json'];

    const usersData =
      XLSX.utils.sheet_to_json(usersSheet);

    const users = [];

    for (const row of usersData) {
      users.push(await transformUser(row));
    }

    // ==================================
    // 4. ADMIN
    // ==================================
    console.log('\n[4] SEED ADMIN');

    const adminsSheet =
      adminWorkbook.Sheets['admin_test.json'];

    const adminsData =
      XLSX.utils.sheet_to_json(adminsSheet);

    const admins = [];

    for (const row of adminsData) {
      admins.push(await transformAdmin(row));
    }

    const allUsers = [
      ...users,
      ...admins
    ];

    await User.deleteMany({});

    const insertedUsers =
      await User.insertMany(allUsers);

    console.log(
      `✓ Customer: ${users.length}`
    );

    console.log(
      `✓ Admin: ${admins.length}`
    );

    console.log(
      `✓ Tổng User: ${insertedUsers.length}`
    );

    // ==================================
    // USER MAP
    // ==================================
    const userMap = new Map();

    insertedUsers.forEach(user => {
      userMap.set(user.maTaiKhoan, user);
    });

    // ==================================
    // 5. ORDER
    // ==================================
    console.log('\n[5] SEED ORDER');

    const ordersSheet =
      adminWorkbook.Sheets['orders_sample.json'];

    const ordersData =
      XLSX.utils.sheet_to_json(ordersSheet);

    const orders = [];

    let orderWarningCount = 0;

    for (const row of ordersData) {
      const maTaiKhoan =
        cleanString(row.maTaiKhoanNguoiMua);

      const user =
        userMap.get(maTaiKhoan);

      if (!user) {
        console.warn(
          `⚠ Không tìm thấy User: ${maTaiKhoan}`
        );

        orderWarningCount++;
        continue;
      }

      const gameNames =
        parseGameNames(row.danhsachGame);

      const sanPham = [];

      for (const gameName of gameNames) {
        const game =
          gameMap.get(`NAME:${gameName}`);

        if (!game) {
          throw new Error(
            `Không tìm thấy Game "${gameName}" trong Order ${row.maDonHang}`
          );
        }

        sanPham.push({
          maGame: game.maGame,

          tenGame: game.tenTroChoi,

          donGia: game.giaHienTai
        });
      }

      if (sanPham.length === 0) {
        console.warn(
          `⚠ Order không có sản phẩm: ${row.maDonHang}`
        );

        orderWarningCount++;
        continue;
      }

      orders.push({
        maDonHang:
          cleanString(row.maDonHang),

        maTaiKhoan:
          user.maTaiKhoan,

        sanPham,

        tongTien:
          parseMoney(row.tongTien),

        phuongThucThanhToan:
          cleanString(row.phuongThucThanhToan),

        trangThai:
          normalizeOrderStatus(row.trangThaiDonHang),

        createdAt:
          parseDate(row.ngayTao) || new Date()
      });
    }

    await Order.deleteMany({});

    const insertedOrders =
      await Order.insertMany(orders);

    console.log(
      `✓ Order: ${insertedOrders.length}`
    );

    if (orderWarningCount > 0) {
      console.log(
        `⚠ Order warnings: ${orderWarningCount}`
      );
    }

    // ==================================
    // ORDER MAP
    // ==================================
    const orderMap = new Map();

    insertedOrders.forEach(order => {
      orderMap.set(order.maDonHang, order);
    });

    // ==================================
    // 6. LIBRARY
    // ==================================
    console.log('\n[6] XỬ LÝ LIBRARY');

    const librariesSheet =
      adminWorkbook.Sheets['libraries'];

    const librariesData =
      XLSX.utils.sheet_to_json(librariesSheet);

    const libraryValid = [];

    let librarySkipped = 0;

    for (const row of librariesData) {
      const maTaiKhoan =
        cleanString(row.maTaiKhoanNguoiDung);

      const maGame =
        cleanString(row.maGame);

      const maDonHang =
        cleanString(row.maDonHang);

      const user =
        userMap.get(maTaiKhoan);

      const game =
        gameMap.get(maGame);

      const order =
        orderMap.get(maDonHang);

      if (!user || !game || !order) {
        console.warn(
          '\n⚠ Bỏ qua Library không hợp lệ:'
        );

        console.warn(`  User: ${maTaiKhoan}`);
        console.warn(`  Game: ${maGame}`);
        console.warn(`  Order: ${maDonHang}`);

        librarySkipped++;
        continue;
      }

      libraryValid.push({
        user,
        game,
        order,
        ngaySoHuu: parseDate(row.ngaySoHuu)
      });
    }

    // Cập nhật danhSachGameDaMua cho User
    const purchasedMap = new Map();

    libraryValid.forEach(item => {
      const userId = item.user._id.toString();

      if (!purchasedMap.has(userId)) {
        purchasedMap.set(userId, []);
      }

      purchasedMap
        .get(userId)
        .push(item.game._id);
    });

    for (const [userId, gameIds] of purchasedMap) {
      await User.findByIdAndUpdate(
        userId,
        {
          danhSachGameDaMua: [
            ...new Map(
              gameIds.map(id => [
                id.toString(),
                id
              ])
            ).values()
          ]
        }
      );
    }

    console.log(
      `✓ Library hợp lệ: ${libraryValid.length}`
    );

    console.log(
      `⚠ Library bỏ qua: ${librarySkipped}`
    );

    // ==================================
    // 7. REVIEW
    // ==================================
    console.log('\n[7] SEED REVIEW');

    const reviewsSheet =
      gameWorkbook.Sheets['Reviews(1)'];

    const reviewsData =
      XLSX.utils.sheet_to_json(
        reviewsSheet,
        {
          defval: null
        }
      );

    const reviews = [];

    let reviewSkipped = 0;

    for (const row of reviewsData) {
      const maTaiKhoan =
        cleanString(row.maTaiKhoanNguoiDung);

      const maGame =
        cleanString(row.maGame);

      const user =
        userMap.get(maTaiKhoan);

      const game =
        gameMap.get(maGame);

      if (
        !user ||
        !game ||
        isEmpty(row.noiDung)
      ) {
        reviewSkipped++;
        continue;
      }

      reviews.push({
        maGame: game._id,

        maTaiKhoan: user._id,

        khuyenNghi:
          cleanString(row.danhGia) === 'khuyen_dung',

        noiDung:
          cleanString(row.noiDung),

        ngayDanhGia:
          parseDate(row.ngayDanhGia),

        an:
          cleanString(row.trangThai) === 'an'
      });
    }

    await Review.deleteMany({});

    const insertedReviews =
      await Review.insertMany(reviews);

    console.log(
      `✓ Review hợp lệ: ${insertedReviews.length}`
    );

    console.log(
      `⚠ Review bỏ qua: ${reviewSkipped}`
    );

    // ==================================
    // 8. REFUND REQUEST
    // ==================================
    console.log('\n[8] SEED REFUND REQUEST');

    // Đọc 25 yêu cầu hoàn tiền thành công
    const acceptedRefunds =
      XLSX.utils.sheet_to_json(
        adminWorkbook.Sheets['refund_request'],
        {
          defval: null
        }
      );

    // Đọc 5 yêu cầu bị từ chối
    const rejectedRefunds =
      XLSX.utils.sheet_to_json(
        adminWorkbook.Sheets['refect_orders'],
        {
          defval: null
        }
      );

    // Gộp thành 30 yêu cầu
    const refundRows = [
      ...acceptedRefunds,
      ...rejectedRefunds
    ];

    const refunds = [];

    let refundSkipped = 0;

    let refundIndex = 1;

    for (const row of refundRows) {
      const maDonHang =
        cleanString(row.maDonHang);

      const maTaiKhoan =
        cleanString(row.maTaiKhoan);

      const maGame =
        cleanString(row.maGame);

      const maAdmin =
        cleanString(row.adminXuLy);

      // Tìm đơn hàng
      const order =
        orderMap.get(maDonHang);

      // Tìm khách hàng
      const user =
        userMap.get(maTaiKhoan);

      // Tìm Admin
      const admin =
        userMap.get(maAdmin);

      // Kiểm tra dữ liệu liên kết
      if (!order || !user || !admin) {
        console.warn(
          `⚠ Bỏ qua Refund: ${maDonHang}`
        );

        refundSkipped++;
        continue;
      }

      // Kiểm tra tài khoản sở hữu đơn hàng
      if (order.maTaiKhoan !== user.maTaiKhoan) {
        throw new Error(
          `Tài khoản không khớp với đơn hàng ${maDonHang}`
        );
      }

      // Kiểm tra người xử lý phải là Admin
      if (admin.vaiTro !== 'admin') {
        throw new Error(
          `Tài khoản ${maAdmin} không phải Admin`
        );
      }

      // Tìm game được yêu cầu hoàn tiền trong đơn hàng
      const sanPhamHoanTien =
        order.sanPham.find(
          item => item.maGame === maGame
        );

      if (!sanPhamHoanTien) {
        throw new Error(
          `Game ${maGame} không tồn tại trong đơn hàng ${maDonHang}`
        );
      }

      // Chuyển trạng thái Excel sang enum RefundRequest
      const trangThaiHoanTien =
        normalizeRefundStatus(row.trangThaiDonHang);

      // Nếu đã duyệt thì lấy giá game trong đơn hàng
      const soTienHoan =
        trangThaiHoanTien === 'approved'
          ? sanPhamHoanTien.donGia
          : 0;

      refunds.push({
        maYeuCau:
          `REF-${String(refundIndex).padStart(3, '0')}`,

        maDonHang: order._id,

        maTaiKhoan: user.maTaiKhoan,

        maGame,

        lyDoKhachHang:
          cleanString(row.lyDoKhachHang),

        trangThaiHoanTien,

        lyDoTuChoi:
          trangThaiHoanTien === 'rejected'
            ? cleanString(row.lyDoTuChoi)
            : '',

        soTienHoan,

        adminXuLy: admin._id,

        ngayYeuCau:
          parseDate(row.ngayYeuCau) || new Date(),

        ngayXuLy:
          parseDate(row.ngayXuLy),

        ngayHoanTien:
          parseDate(row.ngayHoanTien)
      });

      refundIndex++;
    }

    // Cập nhật hoặc thêm 30 yêu cầu hoàn tiền mẫu.
    // Không xóa các yêu cầu hoàn tiền do Customer gửi.
    const refundOperations = refunds.map(refund => ({
      updateOne: {
        filter: {
          maYeuCau: refund.maYeuCau
        },
        update: {
          $set: refund
        },
        upsert: true
      }
    }));

    if (refundOperations.length > 0) {
      await RefundRequest.bulkWrite(refundOperations);
    }

    // Giữ biến này để sử dụng trong phần FINAL SUMMARY
    const insertedRefunds = refunds;

    console.log(
      `✓ Refund mẫu: ${insertedRefunds.length}`
    );

    console.log(
      `✓ Refund approved: ${
        refunds.filter(
          item => item.trangThaiHoanTien === 'approved'
        ).length
      }`
    );

    console.log(
      `✓ Refund rejected: ${
        refunds.filter(
          item => item.trangThaiHoanTien === 'rejected'
        ).length
      }`
    );

    console.log(
      `⚠ Refund bỏ qua: ${refundSkipped}`
    );

    // ==================================
    // FINAL SUMMARY
    // ==================================
    console.log(
      '\n======================================'
    );

    console.log(
      'SEED DATABASE HOÀN TẤT!'
    );

    console.log(
      '======================================'
    );

    console.log(
      `Game:       ${insertedGames.length}`
    );

    console.log(
      `Category:   ${insertedCategories.length}`
    );

    console.log(
      `Customer:   ${users.length}`
    );

    console.log(
      `Admin:      ${admins.length}`
    );

    console.log(
      `Order:      ${insertedOrders.length}`
    );

    console.log(
      `Library:    ${libraryValid.length}`
    );

    console.log(
      `Review:     ${insertedReviews.length}`
    );

    console.log(
      `Refund mẫu: ${insertedRefunds.length}`
    );

    console.log(
      '======================================'
    );

    console.log(
      '\nThông tin đăng nhập Admin:'
    );

    console.log(
      'Password mặc định: Steal@123'
    );

    console.log(
      '======================================'
    );

  } catch (error) {
    console.error(
      '\n======================================'
    );

    console.error(
      'SEED ERROR'
    );

    console.error(
      '======================================'
    );

    console.error(error);

  } finally {
    await mongoose.connection.close();

    console.log(
      '\nĐã đóng kết nối MongoDB.'
    );
  }
}

// ===============================
// RUN
// ===============================
seed();
