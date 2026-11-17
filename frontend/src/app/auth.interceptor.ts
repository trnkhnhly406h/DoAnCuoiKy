import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  // Chỉ xử lý token trên môi trường trình duyệt
  if (!isPlatformBrowser(platformId)) {
    return next(req);
  }

  const urlLower = req.url.toLowerCase();

  // 1. Nhận diện các endpoint API dành riêng cho Quản trị viên
  const isAdminApiPath =
    urlLower.includes('/admin') ||
    urlLower.includes('/promotions');

  // Kiểm tra xem trang hiện tại trên trình duyệt có thuộc khu vực /admin hay không
  const isCurrentPageAdmin =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/admin');

  const isAdminRequest = isAdminApiPath || isCurrentPageAdmin;

  // 2. Lấy token theo đúng vai trò
  const adminToken = sessionStorage.getItem('admin_token');
  const customerToken = localStorage.getItem('steal_token');

  let token: string | null = null;

  if (isAdminRequest) {
    // API Quản trị viên CHỈ ĐƯỢC PHÉP dùng token của Quản trị viên
    // TUYỆT ĐỐI KHÔNG fallback sang customerToken
    token = adminToken;
  } else {
    // API Khách hàng thông thường CHỈ dùng token Khách hàng
    token = customerToken;
  }

  // Nếu không có token tương ứng thì gửi request bình thường (không đính kèm token sai quyền)
  if (!token) {
    return next(req);
  }

  // 3. Đính kèm token hợp lệ vào Authorization header
  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authReq);
};