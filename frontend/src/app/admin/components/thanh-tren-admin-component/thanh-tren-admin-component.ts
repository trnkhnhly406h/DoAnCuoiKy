import { isPlatformBrowser, CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  Output,
  EventEmitter,
  PLATFORM_ID,
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { QuanTri } from '../../../services/quan-tri';

import { forkJoin, Subscription, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AdminHeaderNotification {
  id: string;
  icon: string;
  tieuDe: string;
  noiDung: string;
  thoiGian: string;
  badgeText: string;
  badgeClass: string;
  targetRoute: string;
  targetTab?: string;
  chuaXuLy: boolean;
}

@Component({
  standalone: true,
  imports: [RouterLink, CommonModule],
  selector: 'app-thanh-tren-admin-component',
  styleUrl: './thanh-tren-admin-component.css',
  templateUrl: './thanh-tren-admin-component.html',
})
export class ThanhTrenAdminComponent implements OnInit, OnDestroy {
  logoUrl: string = 'assets/logo.svg';
  hasLogoError: boolean = false;
  brandName: string = 'STEAL';

  isUserMenuOpen: boolean = false;
  isNotificationMenuOpen: boolean = false;

  canViewOrderNotifications: boolean = false;

  currentRole: 'SUPER_ADMIN' | 'STAFF' | 'EDITOR' | 'UNKNOWN'
    = 'UNKNOWN';

  danhSachThongBao: AdminHeaderNotification[] = [];
  soLuongChuaXuLy: number = 0;

  private sub?: Subscription;
  private autoRefreshTimer?: any;

  @Input() adminEmail: string = 'admin@stealgame.vn';
  @Input() adminHoTen: string = 'Quản Trị Viên Trưởng';

  @Output() toggleSidebarEvent = new EventEmitter<void>();
  @Output() dangXuatEvent = new EventEmitter<void>();

  constructor(
    private router: Router,
    private quanTri: QuanTri,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}


private kiemTraQuyenThongBao(): void {

  this.canViewOrderNotifications = false;
  this.currentRole = 'UNKNOWN';

  if (!isPlatformBrowser(this.platformId)) return;

  try {
    const rawUser = sessionStorage.getItem('adminUser');

    if (!rawUser) return;

    const user = JSON.parse(rawUser);

    // Chỉ xét tài khoản đã đăng nhập Admin
    if (String(user.vaiTro || '').toLowerCase() !== 'admin') {
      return;
    }

    const username = String(
      user.tenDangNhap || user.username || ''
    ).trim().toLowerCase();

    const email = String(
      user.email || ''
    ).trim().toLowerCase();

    // Đọc quyền từ các trường hiện có
    const quyen = [
      ...(Array.isArray(user.quyen)
        ? user.quyen
        : user.quyen ? [user.quyen] : []),
      user.vaiTroAdmin,
      user.role
    ]
      .filter(Boolean)
      .map(q => String(q).trim().toUpperCase());

    const role = quyen.join(' ');

    // 1. EDITOR
    if (
      role.includes('EDITOR') ||
      role.includes('BIÊN TẬP') ||
      username === 'adminphu' ||
      username.includes('editor') ||
      email.includes('editor')
    ) {
      this.currentRole = 'EDITOR';
    }

    // 2. STAFF
    else if (
      role.includes('STAFF') ||
      role.includes('NHÂN VIÊN') ||
      username === 'staffadmin' ||
      username.includes('staff') ||
      email.includes('staff')
    ) {
      this.currentRole = 'STAFF';
    }

    // 3. SUPER ADMIN
    // Bao gồm tài khoản Super Admin trong dữ liệu gốc
    else if (
      role.includes('SUPER ADMIN') ||
      role.includes('SUPER_ADMIN') ||
      role.includes('SUPERADMIN') ||
      role.includes('QUẢN TRỊ VIÊN TRƯỞNG') ||
      [
        'admin_master',
        'admin01',
        'backup_admin'
      ].includes(username)
    ) {
      this.currentRole = 'SUPER_ADMIN';
    }

    // Chỉ Staff và Super Admin có chuông
    this.canViewOrderNotifications =
      this.currentRole === 'STAFF' ||
      this.currentRole === 'SUPER_ADMIN';

    console.log(
      '[HEADER ADMIN]',
      'Tài khoản:', username,
      '| Vai trò:', this.currentRole,
      '| Hiện chuông:', this.canViewOrderNotifications
    );

  } catch (error) {
    console.error('Lỗi xác định quyền Header:', error);

    this.currentRole = 'UNKNOWN';
    this.canViewOrderNotifications = false;
  }
}


  
ngOnInit(): void {
  if (!isPlatformBrowser(this.platformId)) return;

  // Kiểm tra quyền trước khi gọi API
  this.kiemTraQuyenThongBao();

  // Editor không tải thông báo nghiệp vụ
  if (!this.canViewOrderNotifications) {
    this.danhSachThongBao = [];
    this.soLuongChuaXuLy = 0;
    this.isNotificationMenuOpen = false;
    return;
  }

  // Staff / Super Admin tải bình thường
  this.taiThongBaoHoatDong();

  // Tự động cập nhật mỗi 30 giây
  this.autoRefreshTimer = setInterval(() => {
    this.taiThongBaoHoatDong();
  }, 30000);
}


  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
  }

  // TẢI HOẠT ĐỘNG TỪ PHÍA CUSTOMER (HOÀN TIỀN & ĐƠN HÀNG MỚI)

taiThongBaoHoatDong(): void {

  // Không cho Editor gọi API thông báo nghiệp vụ
  if (!this.canViewOrderNotifications) {
    return;
  }

  this.sub?.unsubscribe();


    this.sub = forkJoin({
  refunds: this.quanTri.layDanhSachRefund(),
  dashboard: this.quanTri.layDuLieuDashboardAdmin(),

  accountEvents: this.quanTri
    .layThongBaoXoaTaiKhoan()
    .pipe(catchError(() => of([])))
}).subscribe({
  next: ({ refunds, dashboard, accountEvents }) => {
    const list: AdminHeaderNotification[] = [];


        // 1. Lọc các yêu cầu hoàn tiền đang CHỜ XỬ LÝ (SỬA ĐOẠN NÀY ĐỂ HẾT LỖI TS2367)
        if (Array.isArray(refunds)) {
          const pendingRefunds = refunds.filter(
            r => r.trangThaiHoanTien === 'pending'
          );

          pendingRefunds.forEach(rf => {
            const tenKhach = rf.khachHang?.tenDangNhap || rf.khachHang?.hoTen || rf.maTaiKhoan || 'Khách hàng';
            const tenGame = rf.sanPham?.tenGame || rf.game?.tenTroChoi || rf.maGame || 'Trò chơi';
            const soTien = Number(rf.soTienHoan || rf.sanPham?.donGia || 0);

            list.push({
              id: `refund-${rf._id || rf.maYeuCau}`,
              icon: '↩️',
              tieuDe: 'Yêu cầu hoàn tiền mới',
              noiDung: `${tenKhach} yêu cầu hoàn tiền game "${tenGame}" (${soTien.toLocaleString('vi-VN')}đ)`,
              thoiGian: 'Chờ duyệt ngay',
              badgeText: 'Chờ xử lý',
              badgeClass: 'bg-warning text-dark',
              targetRoute: '/admin/orders',
              targetTab: 'cho_xu_ly',
              chuaXuLy: true
            });
          });
        }

        // 2. Lấy các đơn hàng mua game mới thanh toán thành công
        if (dashboard && Array.isArray(dashboard.donHang)) {
          const recentOrders = dashboard.donHang.slice(0, 4);

          recentOrders.forEach((ord: any) => {
            const isCompleted = ord.trangThai === 'Đã thanh toán' || ord.trangThai === 'completed';

            list.push({
              id: `order-${ord.maDonHang}`,
              icon: '🛍️',
              tieuDe: `Đơn hàng #${ord.maDonHang}`,
              noiDung: `${ord.tenGame} - ${Number(ord.tongTien).toLocaleString('vi-VN')}đ`,
              thoiGian: new Date(ord.ngayTao || Date.now()).toLocaleDateString('vi-VN'),
              badgeText: isCompleted ? 'Đã thanh toán' : ord.trangThai,
              badgeClass: isCompleted ? 'bg-success' : 'bg-info text-dark',
              targetRoute: '/admin/orders',
              targetTab: 'tat_ca',
              chuaXuLy: false
            });
          });
        }
         accountEvents.forEach((event: any) => {
      list.push({
        id: `account-delete-${event._id}`,
        icon: '👤',
        tieuDe: event.title || 'Khách hàng xóa tài khoản',
        noiDung:
          event.desc || 'Một khách hàng đã xóa tài khoản.',

        thoiGian:
          new Date(event.createdAt).toLocaleString('vi-VN'),

        badgeText: event.isRead ? 'Đã xem' : 'Mới',

        badgeClass:
          event.isRead ? 'bg-secondary' : 'bg-danger',

        targetRoute: '/admin/customers',
        chuaXuLy: !event.isRead
      });
    });

    this.danhSachThongBao = list;

    this.soLuongChuaXuLy = list.filter(
      item => item.chuaXuLy
    ).length;

    this.cdr.detectChanges();
  },

  error: err => {
    console.warn('Lỗi tải thông báo chuông Admin:', err);
  }
});
        
       
  }

  toggleNotificationMenu(event: Event): void {
    if (!this.canViewOrderNotifications) return;
    event.stopPropagation();
    this.isNotificationMenuOpen = !this.isNotificationMenuOpen;
    if (this.isNotificationMenuOpen) {
      this.isUserMenuOpen = false;
      this.taiThongBaoHoatDong();
    }
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    if (this.isUserMenuOpen) {
      this.isNotificationMenuOpen = false;
    }
  }

  // BẤM VÀO THÔNG BÁO HOÀN TIỀN -> NHẢY SANG TAB CHỜ XỬ LÝ TRANG ĐƠN HÀNG
  bamThongBao(item: AdminHeaderNotification): void {
    if (!this.canViewOrderNotifications) return;
    this.isNotificationMenuOpen = false;

    if (item.targetTab) {
      this.router.navigate([item.targetRoute], {
        queryParams: { tab: item.targetTab }
      });
    } else {
      this.router.navigate([item.targetRoute]);
    }

if (
  item.id.startsWith('account-delete-') &&
  item.chuaXuLy
) {
  const id = item.id.slice('account-delete-'.length);

  this.quanTri.docThongBaoXoaTaiKhoan(id)
    .subscribe({
      next: () => {
        item.chuaXuLy = false;
        item.badgeText = 'Đã xem';
        item.badgeClass = 'bg-secondary';

        this.soLuongChuaXuLy =
          this.danhSachThongBao.filter(
            x => x.chuaXuLy
          ).length;

        this.cdr.detectChanges();
      },

      error: err => {
        console.warn(
          'Không đánh dấu được thông báo đã xem',
          err
        );
      }
    });
}

  }

  chuyenDenTrangDonHang(): void {
    if (!this.canViewOrderNotifications) return;
    this.isNotificationMenuOpen = false;
    this.router.navigate(['/admin/orders'], {
      queryParams: { tab: 'cho_xu_ly' }
    });
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as Node;

    const userDropdown = this.elementRef.nativeElement.querySelector('#admin-user-dropdown');
    if (this.isUserMenuOpen && userDropdown && !userDropdown.contains(target)) {
      this.isUserMenuOpen = false;
    }

    const notiDropdown = this.elementRef.nativeElement.querySelector('#admin-notification-dropdown');
    if (this.isNotificationMenuOpen && notiDropdown && !notiDropdown.contains(target)) {
      this.isNotificationMenuOpen = false;
    }
  }

  onLogoError(): void { this.hasLogoError = true; }
  onToggleSidebar(): void { this.toggleSidebarEvent.emit(); }

  dangXuat(): void {
    this.isUserMenuOpen = false;
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem('isLoggedIn');
      sessionStorage.removeItem('adminUser');
      sessionStorage.removeItem('admin_token');
    }
    this.dangXuatEvent.emit();
    this.router.navigate(['/']);
  }
}