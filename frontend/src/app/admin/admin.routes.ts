import { Routes } from '@angular/router';
import { quanTriGuard } from '../guards/quan-tri-guard';

import { AdminLayoutComponent } from './admin-layout-component/admin-layout-component';
import { DangNhapAdminComponent } from './pages/dang-nhap-admin-component/dang-nhap-admin-component';
import { TongQuanAdminComponent } from './pages/tong-quan-admin-component/tong-quan-admin-component';
import { QuanLyNguoiDungComponent } from './pages/quan-ly-nguoi-dung-component/quan-ly-nguoi-dung-component';
import { ChiTietNguoiDungComponent } from './pages/quan-ly-nguoi-dung-component/chi-tiet-nguoi-dung-component/chi-tiet-nguoi-dung-component';
import { QuanLyDanhGiaComponent } from './pages/quan-ly-danh-gia-component/quan-ly-danh-gia-component';
import { CaiDatHeThongComponent } from './pages/cai-dat-he-thong-component/cai-dat-he-thong-component';
import { QuanLyTroChoiComponent } from './pages/san-pham/quan-ly-tro-choi-component/quan-ly-tro-choi-component';
import { ChiTietTroChoiComponent } from './pages/san-pham/quan-ly-tro-choi-component/chi-tiet-tro-choi-component/chi-tiet-tro-choi-component';
import { QuanLyDanhMucComponent } from './pages/san-pham/quan-ly-danh-muc-component/quan-ly-danh-muc-component';
import { ChiTietDanhMucComponent } from './pages/san-pham/quan-ly-danh-muc-component/chi-tiet-danh-muc-component/chi-tiet-danh-muc-component';
import { QuanLyKhuyenMaiComponent } from './pages/san-pham/quan-ly-khuyen-mai-component/quan-ly-khuyen-mai-component';
import { ChiTietKhuyenMaiComponent } from './pages/san-pham/quan-ly-khuyen-mai-component/chi-tiet-khuyen-mai-component/chi-tiet-khuyen-mai-component';
import { QuanLyDonHangComponent } from './pages/quan-ly-don-hang-component/quan-ly-don-hang-component';
import { ChiTietDonHangComponent } from './pages/quan-ly-don-hang-component/chi-tiet-don-hang-component/chi-tiet-don-hang-component';
import { ThongKeDoanhThuComponent } from './pages/thong-ke-doanh-thu-component/thong-ke-doanh-thu-component';
import { NotFoundComponent as AdminNotFoundComponent } from './pages/not-found-component/not-found-component';
import { LoginAdminGuard } from '../guards/login-admin-guard';

/** Khu quản trị: nạp lười tại /admin (chỉ tải khi cần). */
export const ADMIN_ROUTES: Routes = [
  // Màn hình đăng nhập quản trị (đã đổi đường dẫn thành dang-nhap)
  
  { 
    path: 'login', // Thay bằng path thực tế của bạn
    component: DangNhapAdminComponent, 
    canActivate: [LoginAdminGuard], 
    title: 'Đăng nhập quản trị - STEAL'
  },
  // Các trang quản trị: cần đăng nhập admin (guard sẽ đưa về /admin/login)
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [quanTriGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: TongQuanAdminComponent },
      { path: 'users', component: QuanLyNguoiDungComponent },
      { path: 'users/:id', component: ChiTietNguoiDungComponent },
      { path: 'reviews', component: QuanLyDanhGiaComponent },
      { path: 'settings', component: CaiDatHeThongComponent },
      { path: 'games', component: QuanLyTroChoiComponent },
      { path: 'games/:id', component: ChiTietTroChoiComponent },
      { path: 'categories', component: QuanLyDanhMucComponent },
      { path: 'categories/:id', component: ChiTietDanhMucComponent },
      { path: 'promotions', component: QuanLyKhuyenMaiComponent },
      { path: 'promotions/:id', component: ChiTietKhuyenMaiComponent },
      { path: 'orders', component: QuanLyDonHangComponent },
      { path: 'orders/:id', component: ChiTietDonHangComponent },
      { path: 'analytics', component: ThongKeDoanhThuComponent },
      { path: '**', component: AdminNotFoundComponent }
    ]
  }
];