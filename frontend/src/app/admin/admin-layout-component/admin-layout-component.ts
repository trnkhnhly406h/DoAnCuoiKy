import { Router, RouterOutlet } from '@angular/router';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ThanhBenAdminComponent } from '../components/thanh-ben-admin-component/thanh-ben-admin-component';
import { ThanhTrenAdminComponent } from '../components/thanh-tren-admin-component/thanh-tren-admin-component';

import {
  Component,
  Inject,
  PLATFORM_ID,
  OnInit,
  OnDestroy,
  HostListener
} from '@angular/core';

@Component({
  selector: 'app-admin-layout-component',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ThanhTrenAdminComponent,
    ThanhBenAdminComponent
  ],
  templateUrl: './admin-layout-component.html',
  styleUrl: './admin-layout-component.css',
})
export class AdminLayoutComponent implements OnInit , OnDestroy {
  adminEmail: string = 'admin@stealgame.vn';
  adminHoTen: string = 'Quản Trị Viên Trưởng';
  isSidebarCollapsed: boolean = false;

  constructor(
    public router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

// TỰ ĐĂNG XUẤT KHI RỜI KHỎI KHU VỰC ADMIN
ngOnDestroy(): void {
  if (!isPlatformBrowser(this.platformId)) {
    return;
  }

  // Xóa phiên đăng nhập Admin
  sessionStorage.removeItem('admin_token');
  sessionStorage.removeItem('adminUser');
  sessionStorage.removeItem('admin_gate_passed');
  sessionStorage.removeItem('isLoggedIn');

  // Không xóa admin_lock_until:
  // giữ nguyên thời gian khóa nếu đăng nhập sai nhiều lần.

  console.log(
    '[STEAL] Đã rời khu quản trị. Phiên Admin được đăng xuất.'
  );
}

  // KHẮC PHỤC LỖI TS2554: Khai báo tham số event?: Event
  @HostListener('window:resize', ['$event'])
  onResize(event?: Event): void {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  private checkScreenSize(): void {
    // Thu gọn Sidebar khi độ rộng màn hình < 1200px (khi tách đôi màn hình)
    if (window.innerWidth < 1200) {
      this.isSidebarCollapsed = true;
    } else {
      this.isSidebarCollapsed = false;
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  
dangXuat(): void {
  if (isPlatformBrowser(this.platformId)) {
    // Xóa token và thông tin đăng nhập Admin
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('isLoggedIn');

    // Xóa các cờ đăng nhập Admin cũ nếu còn tồn tại
    sessionStorage.removeItem('admin_gate_passed');
    sessionStorage.removeItem('admin_lock_until');
  }

  // Chuyển về trang đăng nhập Admin
  this.router.navigate(['/admin/login'], {
    replaceUrl: true
  });
}

}