
import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { QuanTri } from '../../../../services/quan-tri';

type Tab = 'all' | 'admin' | 'system';

type Status =
  | 'Đã gửi'
  | 'Đã lên lịch'
  | 'Nháp'
  | 'Tự động'
  | 'Đang gửi'
  | 'Gửi lỗi';

export interface NotificationItem {
  id: string;

  tieuDe: string;
  noiDungNgan: string;

  loaiNotification: 'admin' | 'system';
  loai: 'Hệ thống' | 'Khuyến mãi' | 'Đơn hàng';

  trangThai: Status;

  ngayGui: string;
  createdAt: string;

  doiTuong: 'all' | 'specific';
  nguoiNhanCuThe: string;
  soNguoiNhan: number;

  isCampaign: boolean;
  legacyIds: string[];
  ngayHenGio: string;

  selected: boolean;

  maSuKien: string;
  loaiSuKien: string;
  thoiGianPhatSinh: string;
  noiDungChiTietSystem: string;
}

export interface NotificationForm {
  tieuDe: string;
  noiDung: string;

  loai: 'Hệ thống' | 'Khuyến mãi' | 'Đơn hàng';

  doiTuong: 'all' | 'specific';
  nguoiNhanCuThe: string;

  lichGuiType: 'now' | 'schedule';
  ngayHenGio: string;
}

@Component({
  selector: 'app-thong-bao',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './thong-bao-component.html',
  styleUrl: './thong-bao-component.css'
})

export class ThongBaoComponent implements OnInit {

  activeCategory: Tab = 'all';

  danhSachThongBao: NotificationItem[] = [];

  searchKey = '';
  filterTrangThai = 'all';

  sortOrder: 'newest' | 'oldest' = 'newest';

  selectAll = false;

  loading = false;
  submitting = false;

  errorMessage = '';
  feedbackMessage = '';

  showCreateModal = false;
  showDetailModal = false;
  showEditModal = false;
  showDeleteModal = false;
  showCancelScheduleModal = false;
  showSendNowModal = false;

  selectedItem: NotificationItem | null = null;

  private formNguon: 'admin' | 'system' = 'admin';
  private createRequestId = '';

  formData: NotificationForm = this.emptyForm();

  constructor(
    private quanTriService: QuanTri,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.taiDanhSachThongBao();
  }

  private success(message: string): void {
    this.feedbackMessage = message;
    this.cdr.detectChanges();
  }

  // =====================================
  // 1. KHỞI TẠO FORM
  // =====================================

  private emptyForm(): NotificationForm {
    return {
      tieuDe: '',
      noiDung: '',
      loai: 'Hệ thống',

      doiTuong: 'all',
      nguoiNhanCuThe: '',

      lichGuiType: 'now',
      ngayHenGio: ''
    };
  }

  private toLocalInput(raw: string): string {
    const d = new Date(raw);

    if (isNaN(d.getTime())) return '';

    const p = (v: number) =>
      String(v).padStart(2, '0');

    return (
      `${d.getFullYear()}-` +
      `${p(d.getMonth() + 1)}-` +
      `${p(d.getDate())}T` +
      `${p(d.getHours())}:` +
      `${p(d.getMinutes())}`
    );
  }

  private formatDate(raw: string): string {
    const d = new Date(raw);

    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('vi-VN');
  }

  // =====================================
  // 2. TẢI THÔNG BÁO TỪ DATABASE
  // =====================================

  taiDanhSachThongBao(): void {

    this.loading = true;
    this.errorMessage = '';

    this.quanTriService.getAdminNotifications()
      .subscribe({

        next: (res: any) => {

          if (
            !res?.success ||
            !Array.isArray(res.data)
          ) {
            this.errorMessage =
              'Dữ liệu thông báo không hợp lệ.';

            this.loading = false;
            this.cdr.detectChanges();
            return;
          }

          this.danhSachThongBao =
            res.data.map((n: any): NotificationItem => {

              const isSystem =
                n.loaiNotification === 'system';

              const createdAt = String(
                n.createdAt || n.ngayGui || ''
              );

              const ngayGui = String(
                n.ngayGui || createdAt
              );

              const type =
                ['Đơn hàng', 'Khuyến mãi'].includes(n.loai)
                  ? n.loai
                  : 'Hệ thống';

              return {
                id: String(n.id),

                tieuDe:
                  String(n.tieuDe || 'Thông báo'),

                noiDungNgan:
                  String(n.noiDung || ''),

                loaiNotification:
                  isSystem ? 'system' : 'admin',

                loai: type,

                trangThai:
                  n.trangThai || 'Đã gửi',

                ngayGui:
                  this.formatDate(ngayGui),

                createdAt,

                doiTuong:
                  n.doiTuong === 'specific'
                    ? 'specific'
                    : 'all',

                nguoiNhanCuThe:
                  String(n.nguoiNhanCuThe || ''),

                soNguoiNhan:
                  Number(n.soNguoiNhan || 0),

                isCampaign:
                  Boolean(n.isCampaign),

                legacyIds:
                  Array.isArray(n.legacyIds)
                    ? n.legacyIds
                    : [],

                ngayHenGio:
                  String(n.ngayHenGio || ''),

                selected: false,

                maSuKien:
                  `#NOTI-${String(n.id)
                    .slice(-8)
                    .toUpperCase()}`,

                loaiSuKien: type,

                thoiGianPhatSinh:
                  this.formatDate(createdAt),

                noiDungChiTietSystem:
                  String(n.noiDung || '')
              };
            });

          this.selectAll = false;
          this.loading = false;

          this.cdr.detectChanges();
        },

        error: (e: any) => {

          this.errorMessage =
            e?.error?.message ||
            'Không thể tải thông báo. Kiểm tra API và đăng nhập Admin.';

          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  // =====================================
  // 3. LỌC, TÌM KIẾM, SẮP XẾP
  // =====================================

  get filteredNotifications(): NotificationItem[] {

    const search = this.searchKey
      .trim()
      .toLocaleLowerCase('vi');

    return this.danhSachThongBao
      .filter(n =>

        (
          this.activeCategory === 'all' ||
          n.loaiNotification === this.activeCategory
        ) &&

        (
          !search ||
          `${n.tieuDe} ${n.noiDungNgan}`
            .toLocaleLowerCase('vi')
            .includes(search)
        ) &&

        (
          this.activeCategory === 'system' ||
          this.filterTrangThai === 'all' ||
          n.trangThai === this.filterTrangThai
        )

      )
      .sort((a, b) => {

        const diff =
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime();

        return this.sortOrder === 'newest'
          ? diff
          : -diff;
      });
  }

  selectCategory(cat: Tab): void {
    this.activeCategory = cat;

    this.filterTrangThai = 'all';
    this.selectAll = false;

    this.danhSachThongBao.forEach(
      n => n.selected = false
    );
  }

  

get selectedCount(): number {
  return this.filteredNotifications.filter(
    item => item.selected === true
  ).length;
}

toggleSelectAll(): void {
  const list = this.filteredNotifications;

  const allSelected =
    list.length > 0 &&
    list.every(item => item.selected);

  list.forEach(item => {
    item.selected = !allSelected;
  });
}



  // =====================================
  // 4. XÓA NHIỀU THÔNG BÁO
  // =====================================


async xoaDaChon(): Promise<void> {

  // Không cho thao tác xóa chồng nhau
  if (this.submitting) return;

  // Chụp lại danh sách đã tick trước khi xóa
  const danhSachDaChon = this.filteredNotifications.filter(
    item => item.selected === true
  );

  if (danhSachDaChon.length === 0) return;

  const dongY = window.confirm(
    `Bạn có chắc muốn xóa ${danhSachDaChon.length} thông báo đã chọn không?`
  );

  if (!dongY) return;

  this.submitting = true;
  this.errorMessage = '';
  this.feedbackMessage = '';

  let soLuongDaXoa = 0;
  const danhSachLoi: string[] = [];

  try {

    // Xử lý từng thông báo đã chọn
    for (const item of danhSachDaChon) {

      try {

        // Gửi yêu cầu xóa đến backend
        const response: any = await firstValueFrom(
          this.deleteRequest(item)
        );

        if (response?.success !== true) {
          throw new Error(
            response?.message || 'API không xác nhận xóa thành công'
          );
        }

        // Backend xác nhận thành công:
        // Xóa ngay khỏi danh sách trên giao diện
        this.danhSachThongBao =
          this.danhSachThongBao.filter(
            n => n.id !== item.id
          );

        soLuongDaXoa++;

        // Cập nhật giao diện ngay, không cần F5
        this.cdr.detectChanges();

      } catch (error: any) {

        // Ghi rõ thông báo nào xóa thất bại
        const lyDo =
          error?.error?.message ||
          error?.message ||
          'Lỗi không xác định';

        danhSachLoi.push(
          `${item.tieuDe}: ${lyDo}`
        );

      }
    }

    // Bỏ toàn bộ dấu tick sau khi xử lý
    this.danhSachThongBao.forEach(item => {
      item.selected = false;
    });

    this.selectAll = false;

    // Hiển thị kết quả thực tế
    if (soLuongDaXoa > 0) {
      this.feedbackMessage =
        `Đã xóa thành công ${soLuongDaXoa} thông báo.`;
    }

    if (danhSachLoi.length > 0) {
      this.errorMessage =
        `Có ${danhSachLoi.length} thông báo chưa xóa được:\n` +
        danhSachLoi.join('\n');
    }

  } finally {

    this.submitting = false;
    this.cdr.detectChanges();

  }
}


  // =====================================
  // 5. XEM CHI TIẾT
  // =====================================

  xemThongBao(item: NotificationItem): void {
    this.selectedItem = item;
    this.showDetailModal = true;
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedItem = null;
  }

  denTrangDonHang(): void {
    this.closeDetailModal();
    this.router.navigate(['/admin/orders']);
  }

  // =====================================
  // 6. TẠO THÔNG BÁO MỚI
  // =====================================

  taoThongBaoMoi(): void {

    this.formData = this.emptyForm();

    this.formNguon =
      this.activeCategory === 'system'
        ? 'system'
        : 'admin';

    this.createRequestId =
      `noti-${Date.now()}-` +
      Math.random().toString(36).slice(2);

    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    if (!this.submitting) {
      this.showCreateModal = false;
    }
  }

  // =====================================
  // 7. KIỂM TRA FORM
  // =====================================

  private validateForm(
    requireDate: boolean
  ): boolean {

    if (
      !this.formData.tieuDe.trim() ||
      !this.formData.noiDung.trim()
    ) {
      alert(
        'Vui lòng nhập đầy đủ tiêu đề và nội dung.'
      );
      return false;
    }

    if (
      this.formData.doiTuong === 'specific' &&
      !this.formData.nguoiNhanCuThe.trim()
    ) {
      alert(
        'Vui lòng nhập mã tài khoản, username hoặc email người nhận.'
      );
      return false;
    }

    if (requireDate) {

      const d = new Date(
        this.formData.ngayHenGio
      );

      if (
        !this.formData.ngayHenGio ||
        isNaN(d.getTime()) ||
        d <= new Date()
      ) {
        alert(
          'Thời gian hẹn gửi phải ở tương lai.'
        );
        return false;
      }
    }

    return true;
  }

  // =====================================
  // 8. TẠO PAYLOAD GỬI API
  // =====================================

  private payload(
    mode: 'draft' | 'scheduled' | 'now'
  ) {
    return {
      tieuDe:
        this.formData.tieuDe.trim(),

      noiDung:
        this.formData.noiDung.trim(),

      loai:
        this.formData.loai,

      nguon:
        this.formNguon,

      doiTuong:
        this.formData.doiTuong,

      nguoiNhanCuThe:
        this.formData.nguoiNhanCuThe.trim(),

      ngayHenGio:
        mode === 'scheduled'
          ? new Date(
              this.formData.ngayHenGio
            ).toISOString()
          : '',

      mode
    };
  }

  // =====================================
  // 9. LƯU NHÁP / GỬI / HẸN GIỜ
  // =====================================

  saveDraft(): void {
    this.createNew('draft');
  }

  sendNotification(): void {

    this.createNew(
      this.formData.lichGuiType === 'schedule'
        ? 'scheduled'
        : 'now'
    );
  }

  private createNew(
    mode: 'draft' | 'scheduled' | 'now'
  ): void {

    if (
      this.submitting ||
      !this.validateForm(mode === 'scheduled')
    ) {
      return;
    }

    this.submitting = true;

    this.quanTriService.sendAdminNotification({
      ...this.payload(mode),

      requestId:
        this.createRequestId
    })
      .subscribe({

        next: (res: any) => {

          this.submitting = false;

          if (!res?.success) {
            alert(
              res?.message || 'Thao tác thất bại'
            );
            return;
          }

          this.showCreateModal = false;

          this.activeCategory =
            this.formNguon;

          this.filterTrangThai = 'all';

          this.taiDanhSachThongBao();

          this.success(
            res?.message || 'Đã lưu thông báo'
          );
        },

        error: (e: any) => {

          this.submitting = false;

          this.taiDanhSachThongBao();

          alert(
            e?.error?.message ||
            'Không thực hiện được yêu cầu.'
          );
        }
      });
  }

  // =====================================
  // 10. CHỈNH SỬA NHÁP / LỊCH GỬI
  // =====================================

  suaThongBao(
    item: NotificationItem
  ): void {

    if (
      !item.isCampaign ||
      !['Nháp', 'Đã lên lịch'].includes(
        item.trangThai
      )
    ) {
      return;
    }

    this.selectedItem = item;
    this.formNguon = item.loaiNotification;

    this.formData = {
      tieuDe: item.tieuDe,
      noiDung: item.noiDungNgan,
      loai: item.loai,

      doiTuong: item.doiTuong,
      nguoiNhanCuThe:
        item.nguoiNhanCuThe,

      lichGuiType:
        item.trangThai === 'Đã lên lịch'
          ? 'schedule'
          : 'now',

      ngayHenGio:
        this.toLocalInput(item.ngayHenGio)
    };

    this.showEditModal = true;
  }

  closeEditModal(): void {

    if (!this.submitting) {
      this.showEditModal = false;
      this.selectedItem = null;
    }
  }

  updateNotification(): void {

    if (
      !this.selectedItem ||
      this.submitting
    ) {
      return;
    }

    const mode =
      this.formData.lichGuiType === 'schedule'
        ? 'scheduled'
        : 'draft';

    if (
      !this.validateForm(mode === 'scheduled')
    ) {
      return;
    }

    this.submitting = true;

    this.quanTriService.updateAdminNotification(
      this.selectedItem.id,
      this.payload(mode)
    )
      .subscribe({

        next: (res: any) => {

          this.submitting = false;

          this.showEditModal = false;
          this.selectedItem = null;

          this.taiDanhSachThongBao();

          this.success(
            res?.message || 'Đã cập nhật'
          );
        },

        error: (e: any) => {

          this.submitting = false;

          alert(
            e?.error?.message ||
            'Không cập nhật được'
          );
        }
      });
  }

  // =====================================
  // 11. XÓA THÔNG BÁO
  // =====================================

  xoaThongBao(
    item: NotificationItem
  ): void {

    this.selectedItem = item;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {

    if (!this.submitting) {
      this.showDeleteModal = false;
      this.selectedItem = null;
    }
  }

  
private deleteRequest(n: NotificationItem) {

  // Thông báo tạo theo chiến dịch mới
  if (n.isCampaign) {
    return this.quanTriService.deleteAdminNotification(
      n.id
    );
  }

  // Thông báo lịch sử cũ
  // Có thể gồm nhiều bản ghi của nhiều khách hàng
  const ids = Array.from(
    new Set(
      n.legacyIds && n.legacyIds.length > 0
        ? n.legacyIds
        : [n.id]
    )
  ).filter(id => !!id);

  return this.quanTriService.deleteLegacyNotifications(
    ids
  );
}


  
async confirmDelete(): Promise<void> {

  if (!this.selectedItem || this.submitting) return;

  const itemCanXoa = this.selectedItem;

  this.submitting = true;
  this.errorMessage = '';

  try {

    const response: any = await firstValueFrom(
      this.deleteRequest(itemCanXoa)
    );

    if (response?.success !== true) {
      throw new Error(
        response?.message || 'Xóa thông báo thất bại'
      );
    }

    // Xóa trực tiếp khỏi danh sách giao diện
    this.danhSachThongBao =
      this.danhSachThongBao.filter(
        item => item.id !== itemCanXoa.id
      );

    // Xóa trạng thái tick còn sót
    this.danhSachThongBao.forEach(item => {
      item.selected = false;
    });

    this.selectAll = false;

    // Đóng popup xác nhận
    this.showDeleteModal = false;
    this.selectedItem = null;

    this.feedbackMessage = 'Đã xóa thông báo thành công.';

  } catch (error: any) {

    const message =
      error?.error?.message ||
      error?.message ||
      'Không thể xóa thông báo.';

    this.errorMessage = message;
    alert(message);

  } finally {

    this.submitting = false;
    this.cdr.detectChanges();

  }
}


  // =====================================
  // 12. HỦY LỊCH GỬI
  // =====================================

  huyLichGui(
    item: NotificationItem
  ): void {

    this.selectedItem = item;
    this.showCancelScheduleModal = true;
  }

  closeCancelScheduleModal(): void {

    if (!this.submitting) {
      this.showCancelScheduleModal = false;
      this.selectedItem = null;
    }
  }

  confirmCancelSchedule(): void {

    if (
      !this.selectedItem ||
      this.submitting
    ) {
      return;
    }

    this.submitting = true;

    this.quanTriService.cancelAdminNotification(
      this.selectedItem.id
    )
      .subscribe({

        next: () => {

          this.submitting = false;

          this.showCancelScheduleModal = false;
          this.selectedItem = null;

          this.taiDanhSachThongBao();

          this.success(
            'Đã hủy lịch gửi, thông báo chuyển về bản nháp.'
          );
        },

        error: (e: any) => {

          this.submitting = false;

          alert(
            e?.error?.message ||
            'Không hủy được lịch gửi'
          );
        }
      });
  }

  // =====================================
  // 13. GỬI NGAY THÔNG BÁO
  // =====================================

  guiNgayThongBao(
    item: NotificationItem
  ): void {

    this.selectedItem = item;
    this.showSendNowModal = true;
  }

  closeSendNowModal(): void {

    if (!this.submitting) {
      this.showSendNowModal = false;
      this.selectedItem = null;
    }
  }

  confirmSendNow(): void {

    if (
      !this.selectedItem ||
      this.submitting
    ) {
      return;
    }

    this.submitting = true;

    this.quanTriService.sendNowAdminNotification(
      this.selectedItem.id
    )
      .subscribe({

        next: (res: any) => {

          this.submitting = false;

          this.showSendNowModal = false;
          this.selectedItem = null;

          this.taiDanhSachThongBao();

          this.success(
            res?.message || 'Đã gửi'
          );
        },

        error: (e: any) => {

          this.submitting = false;
          this.taiDanhSachThongBao();

          alert(
            e?.error?.message ||
            'Không gửi được thông báo'
          );
        }
      });
  }
}
