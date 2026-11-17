import { ApplicationRef, Injectable, inject } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** Hộp thoại xác nhận dùng chung, thay cho window.confirm(). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private appRef = inject(ApplicationRef);
  options: ConfirmOptions | null = null;
  private resolver: ((value: boolean) => void) | null = null;

  ask(options: ConfirmOptions): Promise<boolean> {
    // Nếu đang có hộp thoại khác, coi như hủy hộp cũ.
    this.resolver?.(false);
    this.options = {
      confirmText: 'Xác nhận',
      cancelText: 'Hủy bỏ',
      danger: false,
      ...options
    };
    this.refresh();
    return new Promise<boolean>(resolve => (this.resolver = resolve));
  }

  answer(value: boolean): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.options = null;
    resolve?.(value);
    this.refresh();
  }
  private refresh(): void { queueMicrotask(() => this.appRef.tick()); }
}
