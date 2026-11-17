import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PaymentMethod {
  maPhuongThuc: string;
  congTichHop: string;
  tenHienThi: string;
  moTaNgan: string;
  logo: string;
  moiTruong: 'Sandbox' | 'Production';
  tinhPhiCongThanhToan: boolean;
  mucPhiPhanTram: number;
  phiCoDinh: number;
  trangThaiKichHoat: boolean;
  ngayCapNhat?: string;
  capNhatBoiAdmin?: string;
}

export interface NewPaymentMethodForm {
  congTichHop: string;
  tenHienThi: string;
  moTaNgan: string;
  logo: string;
  trangThaiKichHoat: boolean;
}

export interface PaymentHistoryLog {
  id: string;
  thoiGian: string;
  nguoiThucHien: string;
  thaoTac: string;
  congTacDong: string;
  chiTiet: string;
  loaiThaoTac: 'kich-hoat' | 'cap-nhat' | 'tat';
}

@Component({
  selector: 'app-thanh-toan-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './thanh-toan-component.html',
  styleUrl: './thanh-toan-component.css'
})
export class ThanhToanComponent implements OnInit {
  currentView: 'list' | 'history' = 'list';

  danhSachThanhToan: PaymentMethod[] = [
    {
      maPhuongThuc: 'PAY-001',
      congTichHop: 'PAYPAL',
      tenHienThi: 'PayPal',
      moTaNgan: 'Thanh toán quốc tế qua tài khoản PayPal.',
      logo: 'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992488/54958031-c288-4926-acdc-9b0393091c1f.png',
      moiTruong: 'Production',
      tinhPhiCongThanhToan: false,
      mucPhiPhanTram: 0,
      phiCoDinh: 0,
      trangThaiKichHoat: true
    },
    {
      maPhuongThuc: 'PAY-002',
      congTichHop: 'MOMO',
      tenHienThi: 'Ví điện tử MoMo',
      moTaNgan: 'Thanh toán nhanh chóng, quét mã QR qua ứng dụng MoMo.',
      logo: 'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992513/8b70cd9c-6676-4dde-97de-801ad7b6f054.png',
      moiTruong: 'Sandbox',
      tinhPhiCongThanhToan: true,
      mucPhiPhanTram: 1.5,
      phiCoDinh: 2000,
      trangThaiKichHoat: true
    },
    {
      maPhuongThuc: 'PAY-003',
      congTichHop: 'VNPAY',
      tenHienThi: 'Cổng thanh toán VNPay',
      moTaNgan: 'VNPay - An toàn, ổn định đa dạng ngân hàng nội địa.',
      logo: 'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992540/6622870c-0de9-43b7-bacb-902a48cd55d9.png',
      moiTruong: 'Production',
      tinhPhiCongThanhToan: false,
      mucPhiPhanTram: 0,
      phiCoDinh: 0,
      trangThaiKichHoat: true
    }
  ];

  danhSachCongTichHop = [
    { code: 'VIETQR', label: 'VietQR (Chuyển khoản Ngân hàng tự động)' },
    { code: 'ZALOPAY', label: 'Ví điện tử ZaloPay' },
    { code: 'SHOPEEPAY', label: 'Ví điện tử ShopeePay' },
    { code: 'STRIPE', label: 'Cổng thanh toán quốc tế Stripe' }
  ];

  danhSachLichSu: PaymentHistoryLog[] = [
    {
      id: 'LOG-001',
      thoiGian: '03/10/2026 - 15:45',
      nguoiThucHien: 'Admin (admin01)',
      thaoTac: 'Kích hoạt cổng thanh toán',
      congTacDong: 'PayPal',
      chiTiet: 'Thay đổi trạng thái [kichHoat] từ false -> true',
      loaiThaoTac: 'kich-hoat'
    }
  ];

  searchHistoryKey: string = '';
  filterTimeRange: string = 'all';
  fromDate: string = '';
  toDate: string = '';

  showConfigModal: boolean = false;
  selectedMethod: PaymentMethod | null = null;
  editingData: PaymentMethod = {} as PaymentMethod;

  showAddModal: boolean = false;
  newMethodData: NewPaymentMethodForm = {
    congTichHop: 'VIETQR',
    tenHienThi: 'Chuyển khoản qua Mã QR Ngân hàng (VietQR)',
    moTaNgan: 'Quét mã QR bằng App ngân hàng, hệ thống tự động duyệt đơn trong 30s',
    logo: 'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992540/6622870c-0de9-43b7-bacb-902a48cd55d9.png',
    trangThaiKichHoat: true
  };

  ngOnInit(): void {
    const savedPayments = localStorage.getItem('steal_setting_thanh_toan');
    if (savedPayments) {
      try {
        this.danhSachThanhToan = JSON.parse(savedPayments);
      } catch {}
    } else {
      this.savePaymentState();
    }

    const savedLogs = localStorage.getItem('steal_setting_thanh_toan_logs');
    if (savedLogs) {
      try {
        this.danhSachLichSu = JSON.parse(savedLogs);
      } catch {}
    }
  }

  private savePaymentState(): void {
    localStorage.setItem('steal_setting_thanh_toan', JSON.stringify(this.danhSachThanhToan));
    localStorage.setItem('steal_setting_thanh_toan_logs', JSON.stringify(this.danhSachLichSu));
  }

  xemLichSu(): void { this.currentView = 'history'; }
  quayLaiDanhSach(): void { this.currentView = 'list'; }

  toggleTrangThai(item: PaymentMethod): void {
    item.trangThaiKichHoat = !item.trangThaiKichHoat;

    this.danhSachLichSu.unshift({
      id: 'LOG-' + Date.now().toString().slice(-4),
      thoiGian: new Date().toLocaleString('vi-VN'),
      nguoiThucHien: 'Admin',
      thaoTac: item.trangThaiKichHoat ? 'Kích hoạt cổng' : 'Tắt cổng',
      congTacDong: item.tenHienThi,
      chiTiet: `Chuyển trạng thái sang: ${item.trangThaiKichHoat ? 'Hoạt động' : 'Tạm tắt'}`,
      loaiThaoTac: item.trangThaiKichHoat ? 'kich-hoat' : 'tat'
    });

    this.savePaymentState();
  }

  openConfigModal(item: PaymentMethod): void {
    this.selectedMethod = item;
    this.editingData = JSON.parse(JSON.stringify(item));
    this.showConfigModal = true;
  }

  closeConfigModal(): void {
    this.showConfigModal = false;
    this.selectedMethod = null;
  }

  saveModalConfig(): void {
    if (this.selectedMethod) {
      Object.assign(this.selectedMethod, this.editingData);

      this.danhSachLichSu.unshift({
        id: 'LOG-' + Date.now().toString().slice(-4),
        thoiGian: new Date().toLocaleString('vi-VN'),
        nguoiThucHien: 'Admin',
        thaoTac: 'Cập nhật cấu hình cổng',
        congTacDong: this.selectedMethod.tenHienThi,
        chiTiet: `Môi trường: ${this.selectedMethod.moiTruong}, Phí cố định: ${this.selectedMethod.phiCoDinh}đ`,
        loaiThaoTac: 'cap-nhat'
      });

      this.savePaymentState();
      alert(`Đã lưu cấu hình cho ${this.selectedMethod.tenHienThi}!`);
    }
    this.closeConfigModal();
  }

  // HÀM XÓA PHƯƠNG THỨC THANH TOÁN (Giải quyết lỗi TS2339)
  xoaPhuongThuc(): void {
    if (this.selectedMethod) {
      const xacNhan = confirm(`Bạn có chắc chắn muốn xóa phương thức "${this.selectedMethod.tenHienThi}" không?`);
      if (xacNhan) {
        const deletedName = this.selectedMethod.tenHienThi;
        this.danhSachThanhToan = this.danhSachThanhToan.filter(
          p => p.maPhuongThuc !== this.selectedMethod?.maPhuongThuc
        );

        this.danhSachLichSu.unshift({
          id: 'LOG-' + Date.now().toString().slice(-4),
          thoiGian: new Date().toLocaleString('vi-VN'),
          nguoiThucHien: 'Admin',
          thaoTac: 'Xóa cổng thanh toán',
          congTacDong: deletedName,
          chiTiet: `Đã xóa phương thức thanh toán [${deletedName}] khỏi hệ thống`,
          loaiThaoTac: 'tat'
        });

        // Đồng bộ ngay sang Khách hàng sau khi xóa
        this.savePaymentState();
        alert(`Đã xóa phương thức thanh toán "${deletedName}" thành công!`);
        this.closeConfigModal();
      }
    }
  }

  onCheckboxChange(): void {
    if (!this.editingData.tinhPhiCongThanhToan) {
      this.editingData.mucPhiPhanTram = 0;
      this.editingData.phiCoDinh = 0;
    }
  }

  onFeeInput(): void {
    if ((this.editingData.mucPhiPhanTram && this.editingData.mucPhiPhanTram > 0) || 
        (this.editingData.phiCoDinh && this.editingData.phiCoDinh > 0)) {
      this.editingData.tinhPhiCongThanhToan = true;
    }
  }

  openAddModal(): void {
    this.newMethodData = {
      congTichHop: 'VIETQR',
      tenHienThi: 'Chuyển khoản qua Mã QR Ngân hàng (VietQR)',
      moTaNgan: 'Quét mã QR bằng App ngân hàng, hệ thống tự động duyệt đơn trong 30s',
      logo: 'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992540/6622870c-0de9-43b7-bacb-902a48cd55d9.png',
      trangThaiKichHoat: true
    };
    this.showAddModal = true;
  }

  closeAddModal(): void { this.showAddModal = false; }

  onAddLogoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.newMethodData.logo = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  addNewMethod(): void {
    if (!this.newMethodData.tenHienThi.trim()) {
      alert('Vui lòng nhập Tên phương thức hiển thị!');
      return;
    }

    const newId = `PAY-00${this.danhSachThanhToan.length + 1}`;
    const newItem: PaymentMethod = {
      maPhuongThuc: newId,
      congTichHop: this.newMethodData.congTichHop,
      tenHienThi: this.newMethodData.tenHienThi.trim(),
      moTaNgan: this.newMethodData.moTaNgan.trim(),
      logo: this.newMethodData.logo,
      moiTruong: 'Sandbox',
      tinhPhiCongThanhToan: false,
      mucPhiPhanTram: 0,
      phiCoDinh: 0,
      trangThaiKichHoat: this.newMethodData.trangThaiKichHoat
    };

    this.danhSachThanhToan.push(newItem);

    this.danhSachLichSu.unshift({
      id: 'LOG-' + Date.now().toString().slice(-4),
      thoiGian: new Date().toLocaleString('vi-VN'),
      nguoiThucHien: 'Admin',
      thaoTac: 'Thêm cổng thanh toán mới',
      congTacDong: newItem.tenHienThi,
      chiTiet: `Thêm mới cổng [${newItem.congTichHop}] - ${newItem.tenHienThi}`,
      loaiThaoTac: 'kich-hoat'
    });

    this.savePaymentState();
    alert(`Thêm phương thức thanh toán "${newItem.tenHienThi}" thành công!`);
    this.closeAddModal();
  }
}