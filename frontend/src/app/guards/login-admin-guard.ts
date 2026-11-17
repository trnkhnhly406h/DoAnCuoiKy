
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export const LoginAdminGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    const adminToken = sessionStorage.getItem('admin_token');

    // Đã đăng nhập Admin thì không cần quay lại trang login
    if (adminToken) {
      return router.parseUrl('/admin/dashboard');
    }

    // Chưa đăng nhập thì được phép vào trang login
    return true;
  }

  return true;
};
