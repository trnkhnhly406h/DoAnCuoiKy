const XLSX = require('xlsx');

const filePath = './data/data_game.xlsx';

// Đọc file Excel
const workbook = XLSX.readFile(filePath);

console.log('========== DANH SÁCH SHEET ==========');
console.log(workbook.SheetNames);

console.log('\n========== THÔNG TIN TỪNG SHEET ==========');

workbook.SheetNames.forEach((sheetName, index) => {
  const worksheet = workbook.Sheets[sheetName];

  // Chuyển sheet thành mảng object
  const data = XLSX.utils.sheet_to_json(worksheet, {
    defval: null
  });

  console.log(`\n--- Sheet ${index + 1}: ${sheetName} ---`);
  console.log(`Số dòng: ${data.length}`);

  if (data.length > 0) {
    console.log(`Số cột: ${Object.keys(data[0]).length}`);
    console.log('Tên cột:');
    console.log(Object.keys(data[0]));

    console.log('\n3 dòng đầu tiên:');
    console.log(data.slice(0, 3));
  } else {
    console.log('Sheet này đang trống.');
  }
});