import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { ThongTinChungComponent } from './thong-tin-chung-component/thong-tin-chung-component';
import { ThanhToanComponent } from './thanh-toan-component/thanh-toan-component';
import { BaoTriComponent } from './bao-tri-component/bao-tri-component';
import { PhanQuyenAdminComponent } from './phan-quyen-admin-component/phan-quyen-admin-component';
import { ThongBaoComponent } from './thong-bao-component/thong-bao-component';
import { ChinhSachComponent } from './chinh-sach-component/chinh-sach-component';
import { HoaDonComponent } from './hoa-don-component/hoa-don-component';

@Component({
  selector: 'app-cai-dat-he-thong',
  standalone: true,
  imports: [
    CommonModule,
    ThongTinChungComponent,
    ThanhToanComponent,
    BaoTriComponent,
    PhanQuyenAdminComponent,
    ThongBaoComponent,
    ChinhSachComponent,
    HoaDonComponent
  ],
  templateUrl: './cai-dat-he-thong-component.html',
  styleUrl: './cai-dat-he-thong-component.css'
})
export class CaiDatHeThongComponent implements OnInit {
  activeTab: string = 'thong-tin-chung';
  auditLogs: any[] = [];

  // Vai trò của Admin đang đăng nhập: 'SUPER_ADMIN' | 'EDITOR' | 'STAFF'
  currentRole: 'SUPER_ADMIN' | 'EDITOR' | 'STAFF' = 'SUPER_ADMIN';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.layVaiTroAdmin();
    this.thietLapTabMacDinh();
    this.taiAuditLogs();
  }

  // Nhận diện vai trò của tài khoản Admin hiện tại
  private layVaiTroAdmin(): void {
    try {
      const rawUser = sessionStorage.getItem('adminUser');
      if (rawUser) {
        const user = JSON.parse(rawUser);
        const username = String(user.tenDangNhap || user.username || '').toLowerCase();
        const email = String(user.email || '').toLowerCase();
        const role = String(user.quyen || user.vaiTroAdmin || user.role || '').toUpperCase();

        if (
          role.includes('EDITOR') || 
          role.includes('BIÊN TẬP') || 
          username === 'adminphu' || 
          username.includes('editor') || 
          email.includes('editor')
        ) {
          this.currentRole = 'EDITOR';
        } else if (
          role.includes('STAFF') || 
          role.includes('NHÂN VIÊN') || 
          username === 'staffadmin' || 
          username.includes('staff') || 
          email.includes('staff')
        ) {
          this.currentRole = 'STAFF';
        } else {
          this.currentRole = 'SUPER_ADMIN';
        }
      }
    } catch {
      this.currentRole = 'SUPER_ADMIN';
    }
  }

  // Tự động chọn tab đầu tiên mà role này có quyền xem
  private thietLapTabMacDinh(): void {
    if (this.currentRole === 'EDITOR') {
      this.activeTab = 'thong-tin-chung';
    } else if (this.currentRole === 'STAFF') {
      this.activeTab = 'hoa-don';
    } else {
      this.activeTab = 'thong-tin-chung';
    }
  }

  // Hàm kiểm tra quyền truy cập của từng Tab trong Cấu hình
  hasSettingAccess(tab: 'thong-tin-chung' | 'thanh-toan' | 'bao-tri' | 'phan-quyen' | 'thong-bao' | 'chinh-sach' | 'hoa-don' | 'audit-log'): boolean {
    if (this.currentRole === 'SUPER_ADMIN') {
      return true;
    }

    if (this.currentRole === 'EDITOR') {
      // Editor chỉ quản lý: Thông tin chung, Thông báo, Chính sách
      return ['thong-tin-chung', 'thong-bao', 'chinh-sach'].includes(tab);
    }

    if (this.currentRole === 'STAFF') {
      // Staff chỉ xem mẫu Hóa đơn (CSKH/Đơn hàng)
      return ['hoa-don'].includes(tab);
    }

    return true;
  }

  selectTab(tabId: string): void {
    this.activeTab = tabId;
    if (tabId === 'audit-log') {
      this.taiAuditLogs();
    }
  }

  taiAuditLogs(): void {
    this.http.get<any>('http://localhost:3000/api/store/admin/audit-logs').subscribe({
      next: (res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          this.auditLogs = res.data;
          this.cdr.detectChanges();
        } else {
          this.dungDuLieuMauAuditLogs();
        }
      },
      error: () => {
        this.dungDuLieuMauAuditLogs();
      }
    });
  }

  private dungDuLieuMauAuditLogs(): void {
    this.auditLogs = [
      {
        id: '1',
        thoiGian: new Date().toLocaleString('vi-VN'),
        tenTaiKhoan: 'Admin01',
        vaiTro: 'Super Admin',
        hanhDong: 'ĐĂNG NHẬP ADMIN',
        chiTiet: 'Xác thực 2FA OTP thành công vào hệ thống Quản trị',
        diaChiIp: '127.0.0.1'
      },
      {
        id: '2',
        thoiGian: '03/10/2026 15:45:00',
        tenTaiKhoan: 'Staffadmin',
        vaiTro: 'Staff',
        hanhDong: 'DUYỆT HOÀN TIỀN',
        chiTiet: 'Chấp thuận yêu cầu hoàn tiền cho đơn hàng #ORD-20261014-089',
        diaChiIp: '127.0.0.1'
      },
      {
        id: '3',
        thoiGian: '02/10/2026 10:15:00',
        tenTaiKhoan: 'Staffadmin',
        vaiTro: 'Staff',
        hanhDong: 'KHÓA TÀI KHOẢN',
        chiTiet: 'Khóa tài khoản khách hàng [nguyen.van.a] - Lý do: Vi phạm chính sách',
        diaChiIp: '127.0.0.1'
      },
      {
        id: '4',
        thoiGian: '01/10/2026 09:30:00',
        tenTaiKhoan: 'Adminphu',
        vaiTro: 'Editor',
        hanhDong: 'CẬP NHẬT CHÍNH SÁCH',
        chiTiet: 'Chỉnh sửa nội dung Chính sách hoàn tiền 14 ngày của cửa hàng',
        diaChiIp: '127.0.0.1'
      }
    ];
    this.cdr.detectChanges();
  }
}