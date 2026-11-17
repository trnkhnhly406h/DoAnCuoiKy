
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export const quanTriGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    const adminToken = sessionStorage.getItem('admin_token');

    // Chỉ cho phép truy cập khi có token Admin
    if (adminToken) {
      return true;
    }

    // Chưa có token Admin thì chuyển về trang đăng nhập
    return router.parseUrl('/admin/login');
  }

  return true;
};
