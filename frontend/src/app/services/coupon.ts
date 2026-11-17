
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const CHECK_COUPON_API_URL =
  'http://localhost:3000/api/store/orders/check-coupon';

export interface Coupon {
  code: string;
  percent: number;
  description: string;
  active: boolean;
  start: string;
  end: string | null;
  firstPurchaseOnly?: boolean;
}

export interface CouponCheck {
  ok: boolean;
  message: string;
  coupon?: Coupon;
  discount: number;
  subtotal?: number;
  total?: number;
}

interface BackendCouponResponse {
  success: boolean;
  message?: string;

  data?: {
    maKhuyenMai: string;
    moTa: string;
    phanTramGiamGia: number;
    ngayBatDau: string;
    ngayKetThuc: string | null;
    chiApDungLanDau: boolean;
    tongTienGoc: number;
    soTienGiam: number;
    tongTien: number;
  };
}

export interface CouponCartItem {
  maGame: string;
  laQua: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CouponService {

  constructor(
    private http: HttpClient
  ) {}

  /**
   * Kiểm tra mã khuyến mãi bằng dữ liệu MongoDB.
   * Backend tự lấy giá game, không sử dụng giá frontend gửi lên.
   */
  async check(
    rawCode: string,
    items: CouponCartItem[]
  ): Promise<CouponCheck> {

    const code = rawCode.trim().toUpperCase();

    if (!code) {
      return {
        ok: false,
        message: 'Vui lòng nhập mã giảm giá!',
        discount: 0
      };
    }

    if (!items || items.length === 0) {
      return {
        ok: false,
        message: 'Giỏ hàng của bạn đang trống!',
        discount: 0
      };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<BackendCouponResponse>(
          CHECK_COUPON_API_URL,
          {
            maKhuyenMai: code,
            items
          }
        )
      );

      if (
        !response ||
        !response.success ||
        !response.data
      ) {
        return {
          ok: false,
          message:
            response?.message ||
            'Không thể kiểm tra mã khuyến mãi.',
          discount: 0
        };
      }

      const data = response.data;

      const coupon: Coupon = {
        code: data.maKhuyenMai,
        percent: Number(data.phanTramGiamGia),
        description: data.moTa || 'Áp dụng mã khuyến mãi thành công.',
        active: true,
        start: data.ngayBatDau,
        end: data.ngayKetThuc,
        firstPurchaseOnly: data.chiApDungLanDau
      };

      return {
        ok: true,
        message: coupon.description,
        coupon,
        discount: Number(data.soTienGiam),
        subtotal: Number(data.tongTienGoc),
        total: Number(data.tongTien)
      };

    } catch (error: any) {
      console.error(
        'Lỗi kiểm tra mã khuyến mãi:',
        error
      );

      return {
        ok: false,
        message:
          error?.error?.message ||
          'Không thể kết nối Backend để kiểm tra mã khuyến mãi.',
        discount: 0
      };
    }
  }
}
