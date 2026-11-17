import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import {
  map,
  Observable
} from 'rxjs';
import {
  KhachHang,
  RefundRequestEntity
} from '../models/tai-khoan';

@Injectable({
  providedIn: 'root'
})
export class QuanTri {

// API Backend quản lý khách hàng dành cho Admin
  private customerApiUrl = 'http://localhost:3000/api/store/admin/customers';
  private adminReviewApiUrl = 'http://localhost:3000/api/store/admin/reviews';
  private adminOrderApiUrl = 'http://localhost:3000/api/store/admin/orders';
  private categoryApiUrl = 'http://localhost:3000/api/store/categories';
  // API Backend thực tế dành cho chức năng hoàn tiền
  private refundApiUrl = 'http://localhost:3000/api/store/refunds';
  // API Backend quản lý trò chơi
  private gameApiUrl = 'http://localhost:3000/api/store/admin/games';
  private gameDetailApiUrl = 'http://localhost:3000/api/store/games';
  private isBrowser: boolean;

layThongBaoXoaTaiKhoan(): Observable<any[]> {
  return this.http.get<{
    success: boolean;
    data: any[];
  }>(
    'http://localhost:3000/api/store/notifications/admin/account-deletions'
  ).pipe(
    map(res => res.success ? (res.data || []) : [])
  );
}

docThongBaoXoaTaiKhoan(id: string): Observable<any> {
  return this.http.patch<any>(
    `http://localhost:3000/api/store/notifications/admin/account-deletions/${id}/read`,
    {}
  );
}

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ========================================
  // 1. LẤY DANH SÁCH KHÁCH HÀNG
  // GET /api/store/admin/customers
  // ========================================

  layDanhSachKhachHang(): Observable<KhachHang[]> {
    return this.http.get<{
      success: boolean;
      total: number;
      data: KhachHang[];
    }>(this.customerApiUrl).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy danh sách khách hàng');
        }
        return response.data || [];
      })
    );
  }

  // ========================================
  // 2. LẤY CHI TIẾT KHÁCH HÀNG
  // GET /api/store/admin/customers/:id
  // ========================================

  layChiTietKhachHang(id: string): Observable<any> {
    return this.http.get<{
      success: boolean;
      data: any;
    }>(`${this.customerApiUrl}/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy chi tiết khách hàng');
        }
        return response.data;
      })
    );
  }

  // ========================================
  // 3. CẬP NHẬT TRẠNG THÁI KHÓA TÀI KHOẢN
  // PATCH /api/store/admin/customers/:id/lock-status
  // ========================================

  capNhatTrangThaiKhoa(
    id: string,
    isKhoa: boolean,
    lyDo: string = '',
    ngayKhoa: string = ''
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.customerApiUrl}/${id}/lock-status`,
      {
        trangThaiKhoa: isKhoa,
        lyDoKhoa: lyDo,
        ngayKhoa
      }
    );
  }

  // ========================================
  // 4. CẬP NHẬT TRẠNG THÁI HIỂN THỊ ĐÁNH GIÁ
  // PATCH /api/store/admin/reviews/:reviewId/visibility
  // ========================================

  // ========================================
  // 4. QUẢN LÝ ĐÁNH GIÁ (ADMIN)
  // GET /api/store/admin/reviews
  // PATCH /api/store/admin/reviews/:reviewId/visibility
  // ========================================

  layDanhSachDanhGiaAdmin(): Observable<any[]> {
    return this.http.get<{
      success: boolean;
      total: number;
      data: any[];
    }>(this.adminReviewApiUrl).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy danh sách đánh giá');
        }
        return response.data || [];
      })
    );
  }

  capNhatHienThiDanhGia(
    idDanhGia: string | number,
    isHienThi: boolean
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.adminReviewApiUrl}/${idDanhGia}/visibility`,
      { isHienThi }
    );
  }

  // ========================================
  // 5. LẤY DANH SÁCH YÊU CẦU HOÀN TIỀN
  // GET /refunds/admin/all
  // ========================================

  layDanhSachRefund(): Observable<RefundRequestEntity[]> {

    return this.http.get<{
      success: boolean;
      total: number;
      data: RefundRequestEntity[];
    }>(`${this.refundApiUrl}/admin/all`).pipe(

      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy danh sách yêu cầu hoàn tiền');
        }

        return response.data || [];
      })

    );
  }

  // ========================================
  // 6. ADMIN PHÊ DUYỆT HOÀN TIỀN
  // PATCH /refunds/admin/:id/approve
  // ========================================

  pheDuyetRefund(id: string): Observable<any> {

    return this.http.patch<any>(
      `${this.refundApiUrl}/admin/${id}/approve`,
      {}
    );
  }

  // ========================================
  // 7. ADMIN TỪ CHỐI HOÀN TIỀN
  // PATCH /refunds/admin/:id/reject
  // ========================================

  tuChoiRefund(
    id: string,
    lyDoTuChoi: string
  ): Observable<any> {

    return this.http.patch<any>(
      `${this.refundApiUrl}/admin/${id}/reject`,
      {
        lyDoTuChoi
      }
    );
  }
// ========================================
  // 7.1. ADMIN LẤY CHI TIẾT ĐƠN HÀNG
  // GET /api/store/admin/orders/:id
  // ========================================

layDanhSachDonHangAdmin(): Observable<any[]> {
  return this.http.get<{
    success: boolean;
    total: number;
    data: any[];
  }>(this.adminOrderApiUrl).pipe(
    map(response => {
      if (!response.success) {
        throw new Error(
          'Không thể tải danh sách đơn hàng'
        );
      }

      return response.data || [];
    })
  );
}

  layChiTietDonHangAdmin(id: string): Observable<any> {
    return this.http.get<{
      success: boolean;
      data: any;
    }>(`${this.adminOrderApiUrl}/${id}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy chi tiết đơn hàng');
        }
        return response.data;
      })
    );
  }
  // ========================================
  // 7.2. ADMIN LẤY DỮ LIỆU TỔNG QUAN DASHBOARD
  // GET /api/store/admin/dashboard
  // ========================================

  layDuLieuDashboardAdmin(): Observable<any> {
    return this.http.get<{
      success: boolean;
      data: any;
    }>('http://localhost:3000/api/store/admin/dashboard').pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy dữ liệu Dashboard');
        }
        return response.data;
      })
    );
  }
  // ========================================
  // 7.3. ADMIN LẤY DỮ LIỆU BÁO CÁO THỐNG KÊ (ANALYTICS)
  // GET /api/store/admin/analytics
  // ========================================

  layDuLieuAnalyticsAdmin(): Observable<any> {
    return this.http.get<{
      success: boolean;
      data: any;
    }>('http://localhost:3000/api/store/admin/analytics').pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy dữ liệu thống kê');
        }
        return response.data;
      })
    );
  }
  // ========================================
  // 8. QUẢN LÝ TRÒ CHƠI
  // ========================================

  // LẤY DANH SÁCH TRÒ CHƠI
  layDanhSachTroChoi(): Observable<any[]> {
    return this.http.get<any>(this.gameApiUrl).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy danh sách trò chơi');
        }

        return response.data || [];
      })
    );
  }

  // LẤY CHI TIẾT TRÒ CHƠI
  layChiTietTroChoi(id: string): Observable<any> {
    return this.http.get<any>(
      `${this.gameApiUrl.replace('/admin/games', '/games')}/${id}`
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error('Không thể lấy thông tin trò chơi');
        }

        return response.data;
      })
    );
  }

  layDanhSachTheLoai(): Observable<any[]> {
    return this.http.get<any>(this.categoryApiUrl).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Không thể lấy danh sách thể loại');
        }

        return response.data || [];
      })
    );
  }

  // ========================================
  // 9. QUẢN LÝ NHÓM SẢN PHẨM
  // ========================================

  // THÊM NHÓM
  themNhomTheLoai(data: {
    maTheLoai: string;
    tenTheLoai: string;
    moTa: string;
  }): Observable<any> {
    const adminCategoryUrl = this.categoryApiUrl.replace(
      '/categories',
      '/admin/categories'
    );

    return this.http.post<any>(adminCategoryUrl, data);
  }

  // CẬP NHẬT TÊN VÀ MÔ TẢ NHÓM
  capNhatNhomTheLoai(
    id: string,
    data: {
      tenTheLoai: string;
      moTa: string;
    }
  ): Observable<any> {
    const adminCategoryUrl = this.categoryApiUrl.replace(
      '/categories',
      '/admin/categories'
    );

    return this.http.put<any>(
      `${adminCategoryUrl}/${id}`,
      data
    );
  }

  // XÓA NHÓM
  xoaNhomTheLoai(id: string): Observable<any> {
    const adminCategoryUrl = this.categoryApiUrl.replace(
      '/categories',
      '/admin/categories'
    );

    return this.http.delete<any>(
      `${adminCategoryUrl}/${id}`
    );
  }

  // THÊM TRÒ CHƠI
  themTroChoi(data: any): Observable<any> {
    return this.http.post<any>(this.gameApiUrl, data);
  }

  // CẬP NHẬT TRÒ CHƠI
  capNhatTroChoi(id: string, data: any): Observable<any> {
    return this.http.put<any>(
      `${this.gameApiUrl}/${id}`,
      data
    );
  }

  // ẨN / HIỆN TRÒ CHƠI
  capNhatTrangThaiTroChoi(
    id: string,
    trangThaiBan: boolean
  ): Observable<any> {
    return this.http.patch<any>(
      `${this.gameApiUrl}/${id}/status`,
      { trangThaiBan }
    );
  }

  // XÓA TRÒ CHƠI (THỰC CHẤT LÀ ẨN GAME)
  xoaTroChoi(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.gameApiUrl}/${id}`
    );
  }
// ========================================
  // 10. QUẢN LÝ TÀI KHOẢN ADMIN (PHÂN QUYỀN)
  // ========================================

  layDanhSachAdmin(): Observable<any[]> {
    return this.http.get<{
      success: boolean;
      data: any[];
    }>('http://localhost:3000/api/store/admin/staff').pipe(
      map(res => res.data || [])
    );
  }

  themTaiKhoanAdmin(data: any): Observable<any> {
    return this.http.post<any>('http://localhost:3000/api/store/admin/staff', data);
  }

  capNhatTaiKhoanAdmin(id: string, data: any): Observable<any> {
    return this.http.put<any>(`http://localhost:3000/api/store/admin/staff/${id}`, data);
  }

  xoaTaiKhoanAdmin(id: string): Observable<any> {
    return this.http.delete<any>(`http://localhost:3000/api/store/admin/staff/${id}`);
  }
// ==========================================
  // API QUẢN LÝ THÔNG BÁO HỆ THỐNG (ADMIN)
  // ==========================================
  
  // ==========================================
  // API QUẢN LÝ THÔNG BÁO (ADMIN)
  // ==========================================

  getAdminNotifications(): Observable<any> {
    return this.http.get<any>(
      'http://localhost:3000/api/store/notifications/admin/all'
    );
  }

  sendAdminNotification(payload: {
    tieuDe: string;
    noiDung: string;
    loai: string;
    nguon: 'admin' | 'system';
    doiTuong: 'all' | 'specific';
    nguoiNhanCuThe: string;
    mode: 'draft' | 'scheduled' | 'now';
    ngayHenGio: string;
    requestId: string;
  }): Observable<any> {

    return this.http.post<any>(
      'http://localhost:3000/api/store/notifications/admin/send',
      payload
    );
  }

  updateAdminNotification(
    id: string,
    payload: any
  ): Observable<any> {

    return this.http.put<any>(
      `http://localhost:3000/api/store/notifications/admin/${id}`,
      payload
    );
  }

  cancelAdminNotification(
    id: string
  ): Observable<any> {

    return this.http.post<any>(
      `http://localhost:3000/api/store/notifications/admin/${id}/cancel`,
      {}
    );
  }

  sendNowAdminNotification(
    id: string
  ): Observable<any> {

    return this.http.post<any>(
      `http://localhost:3000/api/store/notifications/admin/${id}/send-now`,
      {}
    );
  }

  deleteAdminNotification(
    id: string
  ): Observable<any> {

    return this.http.delete<any>(
      `http://localhost:3000/api/store/notifications/admin/${id}`
    );
  }

  deleteLegacyNotifications(
    ids: string[]
  ): Observable<any> {

    return this.http.post<any>(
      'http://localhost:3000/api/store/notifications/admin/legacy/delete',
      { ids }
    );
  }

  // ==========================================
  // GHI NHẬT KÝ KIỂM VẾT THAO TÁC ADMIN
  // ==========================================
  ghiAuditLog(hanhDong: string, chiTiet: string): Observable<any> {
    return this.http.post<any>('http://localhost:3000/api/store/admin/audit-logs', {
      hanhDong,
      chiTiet
    });
  }
}