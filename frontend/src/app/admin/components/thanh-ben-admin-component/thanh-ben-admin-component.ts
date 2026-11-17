import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-thanh-ben-admin-component',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styleUrl: './thanh-ben-admin-component.css',
  templateUrl: './thanh-ben-admin-component.html',
})
export class ThanhBenAdminComponent implements OnInit, OnDestroy {
  @Input() isCollapsed: boolean = false;
  @Output() toggleCollapse = new EventEmitter<void>();

  onToggle(): void {
    this.toggleCollapse.emit();
  }

  private navSub?: Subscription;
  isProductMenuOpen: boolean = false;
  isProductRouteActive: boolean = false;

  // Vai trò của Admin đang đăng nhập: 'SUPER_ADMIN' | 'EDITOR' | 'STAFF'
  currentRole: string = 'SUPER_ADMIN';

  constructor(
    private router: Router,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.layVaiTroHienTai();
    this.checkActiveRoute(this.router.url);

    this.navSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(event => {
        this.checkActiveRoute(event.urlAfterRedirects || event.url);
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private layVaiTroHienTai(): void {
    try {
      const rawUser = sessionStorage.getItem('adminUser');
      if (rawUser) {
        const user = JSON.parse(rawUser);
        const username = String(user.tenDangNhap || user.username || '').toLowerCase();
        const email = String(user.email || '').toLowerCase();
        const role = String(user.quyen || user.vaiTroAdmin || user.role || '').toUpperCase();

        // 1. Nhận diện Biên Tập Viên (EDITOR)
        if (
          role.includes('EDITOR') || 
          role.includes('BIÊN TẬP') || 
          username === 'adminphu' || 
          username.includes('editor') || 
          email.includes('editor')
        ) {
          this.currentRole = 'EDITOR';
        } 
        // 2. Nhận diện Nhân Viên Vận Hành (STAFF)
        else if (
          role.includes('STAFF') || 
          role.includes('NHÂN VIÊN') || 
          username === 'staffadmin' || 
          username.includes('staff') || 
          email.includes('staff')
        ) {
          this.currentRole = 'STAFF';
        } 
        // 3. Mặc định là Quản Trị Viên Trưởng (SUPER_ADMIN)
        else {
          this.currentRole = 'SUPER_ADMIN';
        }

        console.log(`[Phân quyền Admin] Tài khoản: ${username} => Vai trò: ${this.currentRole}`);
      }
    } catch {
      this.currentRole = 'SUPER_ADMIN';
    }
  }

  // Hàm kiểm tra quyền hiển thị menu
  hasAccess(menu: 'dashboard' | 'orders' | 'products' | 'customers' | 'reviews' | 'analytics' | 'settings'): boolean {
    if (this.currentRole === 'SUPER_ADMIN') {
      return true;
    }

    if (this.currentRole === 'EDITOR') {
      // Editor: Đánh giá, Cấu hình (Thông báo, Chính sách), Tổng quan
      return ['dashboard', 'reviews', 'settings'].includes(menu);
    }

    if (this.currentRole === 'STAFF') {
      // Staff: Đơn hàng, Sản phẩm/Game Key, Khách hàng, Tổng quan
      return ['dashboard', 'orders', 'products', 'customers'].includes(menu);
    }

    return true;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const productMenuElement = this.elementRef.nativeElement.querySelector('#product-menu-item');
    if (this.isProductMenuOpen && productMenuElement && !productMenuElement.contains(event.target as Node)) {
      if (!this.isProductRouteActive) {
        this.isProductMenuOpen = false;
      }
    }
  }

  private checkActiveRoute(url: string): void {
    if (
      url.includes('/admin/games') ||
      url.includes('/admin/categories') ||
      url.includes('/admin/promotions')
    ) {
      this.isProductMenuOpen = true;
      this.isProductRouteActive = true;
    } else {
      this.isProductRouteActive = false;
    }
  }

  toggleProductMenu(): void {
    this.isProductMenuOpen = !this.isProductMenuOpen;
  }
}