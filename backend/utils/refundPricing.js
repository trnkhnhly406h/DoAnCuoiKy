/**
 * Phân bổ số tiền THỰC TRẢ của một đơn hàng cho từng game.
 * Dùng đơn giá lưu trong Order, KHÔNG dùng giá hiện tại của Game.
 * Phân bổ theo tỷ lệ và làm tròn cộng dồn để tổng luôn đúng bằng order.tongTien.
 * Đơn vị: đồng Việt Nam (số nguyên).
 */
function phanBoTienThucTra(order) {
  const items = Array.isArray(order?.sanPham) ? order.sanPham : [];
  if (!items.length) return [];

  const prices = items.map(item => Math.round(Number(item.donGia)));
  const tongGoc = prices.reduce((total, price) => total + price, 0);
  const tongDaTra = Math.round(Number(order.tongTien));

  if (
    prices.some(price => !Number.isSafeInteger(price) || price < 0) ||
    !Number.isSafeInteger(tongGoc) ||
    !Number.isSafeInteger(tongDaTra) ||
    tongDaTra < 0 || tongDaTra > tongGoc
  ) {
    throw new Error('Số tiền trong đơn hàng không hợp lệ để tính hoàn tiền');
  }

  if (tongGoc === 0) {
    return items.map(item => ({
      maGame: String(item.maGame),
      soTienThucTra: 0
    }));
  }

  let tongGocCongDon = 0;
  let tienDaPhanBo = 0;

  return items.map((item, index) => {
    tongGocCongDon += prices[index];

    const mucCongDon = index === items.length - 1
      ? tongDaTra
      : Math.round(tongDaTra * tongGocCongDon / tongGoc);

    const soTienThucTra = mucCongDon - tienDaPhanBo;
    tienDaPhanBo = mucCongDon;

    return {
      maGame: String(item.maGame),
      soTienThucTra
    };
  });
}

function tienHoanTheoGame(order, maGame) {
  const item = phanBoTienThucTra(order).find(
    item => item.maGame === String(maGame)
  );
  if (!item) {
    throw new Error('Game yêu cầu hoàn tiền không thuộc đơn hàng');
  }
  return item.soTienThucTra;
}

module.exports = { phanBoTienThucTra, tienHoanTheoGame };
