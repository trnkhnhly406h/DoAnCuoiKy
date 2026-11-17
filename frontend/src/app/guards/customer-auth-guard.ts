import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../services/auth';

export const customerAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    // Nếu khách hàng đã đăng nhập thì cho phép truy cập
    if (auth.isLoggedIn) {
      return true;
    }

    // Chưa đăng nhập thì yêu cầu mở popup đăng nhập và chuyển về trang chủ
    auth.requestLogin();
    return router.parseUrl('/');
  }

  return true;
};