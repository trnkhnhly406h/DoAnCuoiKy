import { registerLocaleData } from '@angular/common';
import localeVi from '@angular/common/locales/vi';
import { inject, LOCALE_ID, NgModule, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { ThanhToanComponent } from './pages/thanh-toan/thanh-toan';
import { App } from './app';
import { AdminStylesComponent } from './admin/admin-styles/admin-styles';
import { AiAssistantComponent } from './ai-assistant/ai-assistant';
import { AppRoutingModule } from './app-routing-module';

import { HeaderComponent } from './shared/header/header';
import { FooterComponent } from './shared/footer/footer';
import { GameHoverCardComponent } from './shared/game-hover-card/game-hover-card';
import { ToastComponent } from './shared/toast/toast';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog';
import { LoginRequiredComponent } from './shared/login-required/login-required';
import { ImgFallbackDirective } from './shared/directives/img-fallback';

import { HomePageComponent } from './pages/home-page/home-page';
import { StoreListComponent } from './pages/store-list/store-list';
import { CauChuyenStealComponent } from './pages/cau-chuyen-steal/cau-chuyen-steal';
import { HoTroComponent } from './pages/ho-tro/ho-tro';
import { HoSoComponent } from './pages/ho-so/ho-so';
import { SuaHoSoComponent } from './pages/sua-ho-so/sua-ho-so';
import { CaiDatTaiKhoanComponent } from './cai-dat-tai-khoan/cai-dat-tai-khoan';
import { TroChuyenComponent } from './tro-chuyen/tro-chuyen';
import { GlobalChatDockComponent } from './global-chat-dock/global-chat-dock';
import { ThuVienComponent } from './pages/thu-vien/thu-vien';
import { GameDetailComponent } from './pages/game-detail/game-detail';

import { DangNhapComponent } from './shared/dang-nhap/dang-nhap';
import { DangKyComponent } from './shared/dang-ky/dang-ky';
import { TheLoaiComponent } from './pages/the-loai/the-loai';
import { TimKiemTroChoiComponent } from './pages/tim-kiem-tro-choi/tim-kiem-tro-choi';
import { OtpInputComponent } from './shared/otp-input/otp-input';
import { GioHangComponent } from './pages/gio-hang/gio-hang';
import { DanhSachUocComponent } from './pages/danh-sach-uoc/danh-sach-uoc';
import { TangQuaComponent } from './pages/tang-qua/tang-qua';
import { TangQuaNhapTenComponent } from './pages/tang-qua-nhap-ten/tang-qua-nhap-ten';
import { PhuongThucThanhToanComponent } from './pages/phuong-thuc-thanh-toan/phuong-thuc-thanh-toan';
import { MaQrThanhToanComponent } from './pages/ma-qr-thanh-toan/ma-qr-thanh-toan';
import { KhoiPhucComponent } from './pages/khoi-phuc/khoi-phuc';
import { ChinhSachHoanTienComponent } from './pages/chinh-sach-hoan-tien/chinh-sach-hoan-tien';
import { QuyenRiengTuComponent } from './pages/quyen-rieng-tu/quyen-rieng-tu';
import { ThoaThuanDangKyComponent } from './pages/thoa-thuan-dang-ky/thoa-thuan-dang-ky';
import { CookieComponent } from './pages/cookie/cookie';
import { NguoiDungComponent } from './pages/nguoi-dung/nguoi-dung';
import { NotFoundComponent } from './pages/not-found/not-found';
import { GameReviewsComponent } from './shared/game-review/game-review';
import { GameCatalogService } from './services/game-catalog';

// Định dạng số/ngày theo kiểu Việt Nam (ví dụ 269.500đ, 29/10/2026).
registerLocaleData(localeVi, 'vi');

@NgModule({
  declarations: [
    App,
    HeaderComponent,
    FooterComponent,
    GameHoverCardComponent,
    ToastComponent,
    ConfirmDialogComponent,
    LoginRequiredComponent,
    ImgFallbackDirective,
    DangNhapComponent,
    DangKyComponent,

    HomePageComponent,
    StoreListComponent,
    CauChuyenStealComponent,
    HoTroComponent,
    HoSoComponent,
    SuaHoSoComponent,
    CaiDatTaiKhoanComponent,
    TroChuyenComponent,
    GlobalChatDockComponent,

    TheLoaiComponent,
    TimKiemTroChoiComponent,
    OtpInputComponent,
    GioHangComponent,
    DanhSachUocComponent,
    TangQuaComponent,
    TangQuaNhapTenComponent,
    ThanhToanComponent,
    PhuongThucThanhToanComponent,
    MaQrThanhToanComponent,
    KhoiPhucComponent,
    ChinhSachHoanTienComponent,
    QuyenRiengTuComponent,
    ThoaThuanDangKyComponent,
    CookieComponent,
    NotFoundComponent,
    NguoiDungComponent,
    ThuVienComponent,
    GameDetailComponent,
    GameReviewsComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, AdminStylesComponent, AiAssistantComponent],
  providers: [
  { provide: LOCALE_ID, useValue: 'vi' },

  provideHttpClient(
    withInterceptors([authInterceptor])
  ),

  provideAppInitializer(() => {
    const catalog = inject(GameCatalogService);
    return catalog.loadFromBackend();
  })
],
  bootstrap: [App],
})
export class AppModule {}
