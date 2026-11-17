import { Component, ElementRef, EventEmitter, Input, OnInit, Output, QueryList, ViewChildren } from '@angular/core';

/**
 * Ô nhập mã OTP dùng chung (đăng ký, khôi phục mật khẩu, đăng nhập 2 bước, cài đặt tài khoản).
 * - Gõ đè được ô đã có số (chọn sẵn khi focus), không bị chặn bởi maxlength.
 * - Dán cả mã, phím Backspace/mũi tên, tự chuyển ô, Enter để gửi.
 */
@Component({
  selector: 'app-otp-input',
  templateUrl: './otp-input.html',
  styleUrls: ['./otp-input.css'],
  standalone: false
})
export class OtpInputComponent implements OnInit {
  @Input() length = 6;
  @Input() disabled = false;
  @Input() variant: 'underline' | 'box' = 'box';
  @Input() autofocus = true;
  @Output() codeChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<string>();

  @ViewChildren('box') private boxes!: QueryList<ElementRef<HTMLInputElement>>;

  digits: string[] = [];

  ngOnInit(): void {
    this.digits = Array.from({ length: this.length }, () => '');
    if (this.autofocus) setTimeout(() => this.focusAt(0));
  }

  get code(): string {
    return this.digits.join('');
  }

  /** Xóa toàn bộ ô và đưa con trỏ về ô đầu (gọi khi nhập sai / gửi lại mã). */
  clear(): void {
    this.digits = Array.from({ length: this.length }, () => '');
    this.codeChange.emit('');
    setTimeout(() => this.focusAt(0));
  }

  trackByIndex(index: number): number {
    return index;
  }

  onFocus(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const typed = input.value.replace(/\D/g, '');
    if (typed.length > 1) {
      // Trình duyệt tự điền / dán nhiều số vào một ô
      this.fillFrom(index, typed);
      return;
    }
    this.digits[index] = typed;
    input.value = typed;
    this.emit();
    if (typed && index < this.length - 1) this.focusAt(index + 1);
  }

  onKeydown(event: KeyboardEvent, index: number): void {
    if (/^\d$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    this.digits[index] = event.key;
    (event.target as HTMLInputElement).value = event.key;
    this.emit();
    if (index < this.length - 1) this.focusAt(index + 1);
    return;
  }
    switch (event.key) {
      case 'Backspace':
        if (!this.digits[index] && index > 0) {
          event.preventDefault();
          this.digits[index - 1] = '';
          this.emit();
          this.focusAt(index - 1);
        }
        break;
      case 'ArrowLeft':
        if (index > 0) { event.preventDefault(); this.focusAt(index - 1); }
        break;
      case 'ArrowRight':
        if (index < this.length - 1) { event.preventDefault(); this.focusAt(index + 1); }
        break;
      case 'Enter':
        this.submitted.emit(this.code);
        break;
      default:
        break;
    }
  }

  onPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    this.fillFrom(index, (event.clipboardData?.getData('text') ?? '').replace(/\D/g, ''));
  }

  private fillFrom(start: number, text: string): void {
    const chars = text.slice(0, this.length - start).split('');
    chars.forEach((c, i) => (this.digits[start + i] = c));
    this.emit();
    this.focusAt(Math.min(start + chars.length, this.length - 1));
  }

  private emit(): void {
    this.codeChange.emit(this.code);
  }

  private focusAt(index: number): void {
    const el = this.boxes?.get(index)?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }
}
