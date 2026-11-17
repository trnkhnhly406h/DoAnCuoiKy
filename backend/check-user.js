const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(
  __dirname,
  'data',
  'user_admin.xlsx'
);

const workbook = XLSX.readFile(filePath);

console.log('Các sheet:');
console.log(workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet);

  console.log('\n==============================');
  console.log('SHEET:', sheetName);
  console.log('Số dòng:', data.length);

  if (data.length > 0) {
    console.log('Dòng đầu tiên:');
    console.log(data[0]);
  }
}