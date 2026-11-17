import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomePageComponent } from './pages/home-page/home-page';
import { StoreListComponent } from './pages/store-list/store-list';
import { CauChuyenStealComponent } from './pages/cau-chuyen-steal/cau-chuyen-steal';
import { HoTroComponent } from './pages/ho-tro/ho-tro';
import { HoSoComponent } from './pages/ho-so/ho-so';
import { SuaHoSoComponent } from './pages/sua-ho-so/sua-ho-so';
import { CaiDatTaiKhoanComponent } from './cai-dat-tai-khoan/cai-dat-tai-khoan';
import { TroChuyenComponent } from './tro-chuyen/tro-chuyen';
import { ThuVienComponent } from './pages/thu-vien/thu-vien';
import { GameDetailComponent } from './pages/game-detail/game-detail';
import { TheLoaiComponent } from './pages/the-loai/the-loai';
import { TimKiemTroChoiComponent } from './pages/tim-kiem-tro-choi/tim-kiem-tro-choi';
import { GioHangComponent } from './pages/gio-hang/gio-hang';
import { DanhSachUocComponent } from './pages/danh-sach-uoc/danh-sach-uoc';
import { TangQuaComponent } from './pages/tang-qua/tang-qua';
import { TangQuaNhapTenComponent } from './pages/tang-qua-nhap-ten/tang-qua-nhap-ten';
import { ThanhToanComponent } from './pages/thanh-toan/thanh-toan';
import { PhuongThucThanhToanComponent } from './pages/phuong-thuc-thanh-toan/phuong-thuc-thanh-toan';
import { MaQrThanhToanComponent } from './pages/ma-qr-thanh-toan/ma-qr-thanh-toan';
import { KhoiPhucComponent } from './pages/khoi-phuc/khoi-phuc';
import { ChinhSachHoanTienComponent } from './pages/chinh-sach-hoan-tien/chinh-sach-hoan-tien';
import { QuyenRiengTuComponent } from './pages/quyen-rieng-tu/quyen-rieng-tu';
import { ThoaThuanDangKyComponent } from './pages/thoa-thuan-dang-ky/thoa-thuan-dang-ky';
import { CookieComponent } from './pages/cookie/cookie';
import { NguoiDungComponent } from './pages/nguoi-dung/nguoi-dung';
import { NotFoundComponent } from './pages/not-found/not-found';
import { customerAuthGuard } from './guards/customer-auth-guard';
const routes: Routes = [
  { path: '', component: HomePageComponent, title: 'STEAL - Cửa hàng game' },

  // Các trang danh sách game dùng chung một component, khác nhau ở data.type
  { path: 'game-noi-bat', component: StoreListComponent, data: { type: 'featured' }, title: 'Game nổi bật - STEAL' },
  { path: 'ban-chay-nhat', component: StoreListComponent, data: { type: 'best-seller' }, title: 'Game bán chạy - STEAL' },
  { path: 'moi-ra-mat', component: StoreListComponent, data: { type: 'new' }, title: 'Game mới ra mắt - STEAL' },
  { path: 'uu-dai', component: StoreListComponent, data: { type: 'sale' }, title: 'Ưu đãi - STEAL' },
  { path: 'mien-phi', component: StoreListComponent, data: { type: 'free' }, title: 'Game miễn phí - STEAL' },
  { path: 'the-loai/:slug', component: TheLoaiComponent, title: 'Thể loại - STEAL' },
  { path: 'tim-kiem', component: TimKiemTroChoiComponent, title: 'Tìm kiếm - STEAL' },
  { path: 'tim-kiem-tro-choi', component: TimKiemTroChoiComponent, title: 'Tìm kiếm - STEAL' },
  { path: 'thu-vien', component: ThuVienComponent, title: 'Thư viện - STEAL' },
  { path: 'thu-vien/:id', component: ThuVienComponent, title: 'Thư viện - STEAL' },

  { path: 'cau-chuyen-steal', component: CauChuyenStealComponent, title: 'Câu chuyện STEAL' },
  { path: 'ho-tro', component: HoTroComponent, title: 'Hỗ trợ - STEAL' },

{ path: 'ho-so', component: HoSoComponent, title: 'Hồ sơ - STEAL' },
  { path: 'sua-ho-so', component: SuaHoSoComponent, canActivate: [customerAuthGuard], title: 'Sửa hồ sơ - STEAL' },
  { path: 'cai-dat-tai-khoan', component: CaiDatTaiKhoanComponent, title: 'Cài đặt tài khoản - STEAL' },
  { path: 'nguoi-dung/:id', component: NguoiDungComponent, title: 'Hồ sơ người dùng - STEAL' },
  { path: 'tro-chuyen', component: TroChuyenComponent, title: 'Trò chuyện - STEAL' },
  { path: 'game/:slug', component: GameDetailComponent, title: 'Chi tiết game - STEAL' },

  // Mua hàng: giỏ hàng → (quà tặng) → thanh toán → phương thức → mã QR
  { path: 'danh-sach-uoc', component: DanhSachUocComponent, title: 'Danh sách ước - STEAL' },
  { path: 'gio-hang', component: GioHangComponent, title: 'Giỏ hàng - STEAL' },
  { path: 'tang-qua', component: TangQuaComponent, title: 'Tặng quà - STEAL' },
  { path: 'tang-qua-nhap-ten', component: TangQuaNhapTenComponent, title: 'Tặng quà - STEAL' },
  { path: 'thanh-toan', component: ThanhToanComponent, title: 'Thanh toán - STEAL' },
  { path: 'phuong-thuc-thanh-toan', component: PhuongThucThanhToanComponent, title: 'Phương thức thanh toán - STEAL' },
  { path: 'ma-qr-thanh-toan', component: MaQrThanhToanComponent, title: 'Thanh toán QR - STEAL' },

  // Tài khoản & pháp lý
  { path: 'khoi-phuc-tai-khoan', component: KhoiPhucComponent, title: 'Khôi phục tài khoản - STEAL' },
  { path: 'chinh-sach-hoan-tien', component: ChinhSachHoanTienComponent, title: 'Chính sách hoàn tiền - STEAL' },
  { path: 'quyen-rieng-tu', component: QuyenRiengTuComponent, title: 'Quyền riêng tư - STEAL' },
  { path: 'thoa-thuan-dang-ky', component: ThoaThuanDangKyComponent, title: 'Thỏa thuận đăng ký - STEAL' },
  { path: 'cookie', component: CookieComponent, title: 'Cookie - STEAL' },

  // Khu quản trị (gộp từ dự án admin): nạp lười, có màn hình đăng nhập riêng của admin
  { path: 'admin', loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES) },

  { path: '**', component: NotFoundComponent, title: 'Không tìm thấy trang - STEAL' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}
