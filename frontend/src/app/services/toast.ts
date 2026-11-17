import { ApplicationRef, inject, Injectable } from '@angular/core';

export type ToastType = 'success' | 'warning';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

/** Thông báo nổi toàn ứng dụng (hiển thị bởi <app-toast> đặt ở app.html). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private appRef = inject(ApplicationRef);
  private static readonly MAX_VISIBLE = 3;
  private seq = 0;
  messages: ToastMessage[] = [];

  show(text: string, type: ToastType = 'success', durationMs = 3500): void {
    const id = ++this.seq;
    this.messages = [...this.messages, { id, text, type }].slice(-ToastService.MAX_VISIBLE);
    setTimeout(() => this.dismiss(id), durationMs);
    queueMicrotask(() => this.appRef.tick());
  }

  success(text: string): void {
    this.show(text, 'success');
  }

  warning(text: string): void {
    this.show(text, 'warning');
  }

  dismiss(id: number): void {
    this.messages = this.messages.filter(m => m.id !== id);
    queueMicrotask(() => this.appRef.tick());
  }
}
