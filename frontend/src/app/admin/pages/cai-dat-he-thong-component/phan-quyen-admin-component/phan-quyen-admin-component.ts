import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface AdminUser {
  id?: string;
  stt: number;
  username: string;
  avatar: string;
  hoTen: string;
  email?: string;
  vaiTro: 'Super Admin' | 'Editor' | 'Staff';
  trangThai: 'Hoạt động' | 'Đã khóa';
  lanCuoiCapNhat: string;
}

export interface NewAdminForm {
  username: string;
  hoTen: string;
  email: string;
  matKhau: string;
  xacNhanMatKhau: string;
  vaiTro: 'Super Admin' | 'Editor' | 'Staff';
}

export interface EditAdminForm {
  id?: string;
  stt: number;
  username: string;
  hoTen: string;
  email: string;
  matKhauMoi: string;
  vaiTro: 'Super Admin' | 'Editor' | 'Staff';
}

@Component({
  selector: 'app-phan-quyen-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './phan-quyen-admin-component.html',
  styleUrl: './phan-quyen-admin-component.css'
})
export class PhanQuyenAdminComponent implements OnInit {
  private staffApiUrl = 'http://localhost:3000/api/store/admin/staff';

  danhSachAdmin: AdminUser[] = [];

  searchKey: string = '';
  filterTrangThai: string = 'all';
  filterVaiTro: string = 'all';

  showAddModal: boolean = false;
  showAddPassword1: boolean = false;
  showAddPassword2: boolean = false;
  newAdminData: NewAdminForm = {
    username: '',
    hoTen: '',
    email: '',
    matKhau: '',
    xacNhanMatKhau: '',
    vaiTro: 'Staff'
  };

  showEditModal: boolean = false;
  showEditPassword: boolean = false;
  selectedAdminToEdit: AdminUser | null = null;
  editAdminData: EditAdminForm = {
    stt: 0,
    username: '',
    hoTen: '',
    email: '',
    matKhauMoi: '',
    vaiTro: 'Staff'
  };

  showDeleteModal: boolean = false;
  selectedAdminToDelete: AdminUser | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadAdminStaff();
  }

  loadAdminStaff(): void {
    this.http.get<any>(this.staffApiUrl).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          this.danhSachAdmin = res.data.map((item: any, index: number) => ({
            id: item.id || item.maTaiKhoan,
            stt: index + 1,
            username: item.username || item.tenDangNhap,
            avatar:
              item.avatar ||
              'https://res.cloudinary.com/dhbnmxe6t/image/upload/v1791992540/6622870c-0de9-43b7-bacb-902a48cd55d9.png',
            hoTen: item.hoTen || item.username || 'Admin Steal',
            email: item.email || '',
            vaiTro: item.vaiTro || 'Staff',
            trangThai: item.trangThai || 'Hoạt động',
            lanCuoiCapNhat: item.lanCuoiCapNhat || ''
          }));
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => {
        console.error('Lỗi tải danh sách Admin:', err);
      }
    });
  }

  get filteredAdmins(): AdminUser[] {
    return this.danhSachAdmin.filter(item => {
      const matchKey =
        !this.searchKey.trim() ||
        item.username.toLowerCase().includes(this.searchKey.toLowerCase()) ||
        item.hoTen.toLowerCase().includes(this.searchKey.toLowerCase()) ||
        (item.email || '').toLowerCase().includes(this.searchKey.toLowerCase());

      const matchStatus = this.filterTrangThai === 'all' || item.trangThai === this.filterTrangThai;
      const matchRole = this.filterVaiTro === 'all' || item.vaiTro === this.filterVaiTro;

      return matchKey && matchStatus && matchRole;
    });
  }

  // --- LOGIC MODAL THÊM ADMIN ---
  openAddAdminModal(): void {
    this.newAdminData = {
      username: '',
      hoTen: '',
      email: '',
      matKhau: '',
      xacNhanMatKhau: '',
      vaiTro: 'Staff'
    };
    this.showAddPassword1 = false;
    this.showAddPassword2 = false;
    this.showAddModal = true;
  }

  closeAddAdminModal(): void {
    this.showAddModal = false;
  }

  createAdmin(): void {
    if (!this.newAdminData.username.trim() || !this.newAdminData.hoTen.trim() || !this.newAdminData.email.trim()) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc!');
      return;
    }

    if (!this.newAdminData.matKhau.trim()) {
      alert('Vui lòng nhập mật khẩu khởi tạo!');
      return;
    }

    if (this.newAdminData.matKhau !== this.newAdminData.xacNhanMatKhau) {
      alert('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    this.http
      .post<any>(this.staffApiUrl, {
        username: this.newAdminData.username.trim(),
        hoTen: this.newAdminData.hoTen.trim(),
        email: this.newAdminData.email.trim(),
        matKhau: this.newAdminData.matKhau,
        vaiTro: this.newAdminData.vaiTro
      })
      .subscribe({
        next: (res: any) => {
          alert(res?.message || `Thêm tài khoản admin ${this.newAdminData.username} thành công!`);
          this.closeAddAdminModal();
          this.loadAdminStaff();
        },
        error: (err: any) => {
          alert(err?.error?.message || 'Không thể tạo tài khoản Admin!');
        }
      });
  }

  // --- LOGIC MODAL CẬP NHẬT ADMIN ---
  editAdmin(item: AdminUser): void {
    this.selectedAdminToEdit = item;
    this.editAdminData = {
      id: item.id,
      stt: item.stt,
      username: item.username,
      hoTen: item.hoTen,
      email: item.email || `${item.username.toLowerCase()}@stealgame.vn`,
      matKhauMoi: '',
      vaiTro: item.vaiTro
    };
    this.showEditPassword = false;
    this.showEditModal = true;
  }

  closeEditAdminModal(): void {
    this.showEditModal = false;
    this.selectedAdminToEdit = null;
  }

  updateAdmin(): void {
    if (!this.editAdminData.hoTen.trim() || !this.editAdminData.email.trim()) {
      alert('Vui lòng nhập đầy đủ Họ tên và Email!');
      return;
    }

    if (!this.selectedAdminToEdit) return;

    const targetId = this.selectedAdminToEdit.id || this.selectedAdminToEdit.username;

    this.http
      .put<any>(`${this.staffApiUrl}/${targetId}`, {
        hoTen: this.editAdminData.hoTen.trim(),
        email: this.editAdminData.email.trim(),
        vaiTro: this.editAdminData.vaiTro,
        matKhauMoi: this.editAdminData.matKhauMoi
      })
      .subscribe({
        next: (res: any) => {
          alert(res?.message || `Đã cập nhật thông tin tài khoản ${this.editAdminData.username} thành công!`);
          this.closeEditAdminModal();
          this.loadAdminStaff();
        },
        error: (err: any) => {
          alert(err?.error?.message || 'Không thể cập nhật tài khoản Admin!');
        }
      });
  }

  // --- LOGIC MODAL XÓA ADMIN ---
  openDeleteModal(item: AdminUser): void {
    if (item.vaiTro === 'Super Admin') {
      alert('Không thể xóa tài khoản Super Admin!');
      return;
    }
    this.selectedAdminToDelete = item;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.selectedAdminToDelete = null;
  }

  confirmDeleteAdmin(): void {
    if (!this.selectedAdminToDelete) return;

    const targetId = this.selectedAdminToDelete.id || this.selectedAdminToDelete.username;
    const deletedUsername = this.selectedAdminToDelete.username;

    this.http.delete<any>(`${this.staffApiUrl}/${targetId}`).subscribe({
      next: (res: any) => {
        alert(res?.message || `Đã xóa vĩnh viễn tài khoản admin ${deletedUsername}!`);
        this.closeDeleteModal();
        this.loadAdminStaff();
      },
      error: (err: any) => {
        alert(err?.error?.message || 'Không thể xóa tài khoản Admin!');
      }
    });
  }

  // --- KHÓA / MỞ KHÓA ---
  toggleLockStatus(item: AdminUser): void {
    const newStatus = item.trangThai === 'Hoạt động' ? 'Đã khóa' : 'Hoạt động';
    const targetId = item.id || item.username;

    this.http
      .put<any>(`${this.staffApiUrl}/${targetId}`, {
        trangThai: newStatus
      })
      .subscribe({
        next: () => {
          item.trangThai = newStatus;
          alert(
            newStatus === 'Đã khóa'
              ? `Đã khóa tài khoản ${item.username}!`
              : `Đã mở khóa tài khoản ${item.username}!`
          );
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          alert(err?.error?.message || 'Không thể thay đổi trạng thái khóa!');
        }
      });
  }
}