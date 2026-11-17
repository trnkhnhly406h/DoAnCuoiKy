import { Component, ElementRef, Input, inject, signal } from '@angular/core';

interface AiMessage { from: 'user' | 'ai'; text: string; time: string; image?: string; }

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
interface AiRule { keys: string[]; answer: string; }

const CUSTOMER_QUESTIONS = [
  'Cách mua game?',
  'Hoàn tiền thế nào?',
  'Tặng quà cho bạn bè?',
  'Bật STEAL Guard để làm gì?',
  'Danh sách ước là gì?'
];
const ADMIN_QUESTIONS = [
  'Xem doanh thu ở đâu?',
  'Thêm game mới thế nào?',
  'Tạo khuyến mãi?',
  'Khóa tài khoản khách hàng?',
  'Duyệt yêu cầu hoàn tiền?'
];

const CUSTOMER_RULES: AiRule[] = [
  { keys: ['mua', 'thanh toán', 'giỏ'], answer: 'Bấm biểu tượng giỏ hàng (⊕) trên thẻ game, vào Giỏ hàng → Thanh toán → chọn phương thức → quét mã QR để hoàn tất. Bạn cần đăng nhập trước khi mua.' },
  { keys: ['hoàn tiền', 'refund'], answer: 'Vào Thư viện, chọn game cần hoàn tiền rồi bấm "Yêu cầu hoàn tiền". Game đủ điều kiện khi mua gần đây và thời gian chơi còn ít. Chi tiết xem ở mục Chính sách → Hoàn tiền.' },
  { keys: ['tặng', 'quà', 'bạn bè'], answer: 'Trong Giỏ hàng, chọn "Tặng quà", nhập tên tài khoản hoặc email của bạn bè, thêm lời nhắn rồi thanh toán. Game sẽ vào thư viện của người nhận.' },
  { keys: ['guard', 'otp', 'bảo mật', '2fa'], answer: 'STEAL Guard là xác thực 2 lớp: mỗi lần đăng nhập bạn nhập thêm mã OTP 6 số gửi về email. Bật ở Cài đặt tài khoản → Bảo mật.' },
  { keys: ['ước', 'wishlist', 'yêu thích'], answer: 'Danh sách ước lưu các game bạn quan tâm. Bấm biểu tượng ngôi sao trên thẻ game để thêm; khi game giảm giá bạn sẽ nhận thông báo.' },
  { keys: ['mật khẩu', 'quên'], answer: 'Ở màn hình đăng nhập chọn "Khôi phục tài khoản", nhập email, xác minh mã OTP rồi đặt mật khẩu mới.' },
  { keys: ['xin chào', 'hello', 'chào', 'hi'], answer: 'Chào bạn! Mình là trợ lý STEAL. Bạn cần hỗ trợ gì về mua game, thanh toán hay tài khoản?' }
];
const ADMIN_RULES: AiRule[] = [
  { keys: ['doanh thu', 'thống kê', 'báo cáo', 'biểu đồ'], answer: 'Vào menu "Báo cáo" (hoặc Tổng quan) để xem doanh thu, đơn hàng, top game và top khách hàng. Có thể đổi khoảng thời gian bằng bộ lọc ngày.' },
  { keys: ['thêm game', 'sản phẩm', 'game mới'], answer: 'Menu Sản phẩm → Tất cả sản phẩm → "Tạo sản phẩm". Điền tên, giá, thể loại, ảnh/video và yêu cầu hệ thống rồi bấm Lưu.' },
  { keys: ['khuyến mãi', 'mã giảm', 'giảm giá'], answer: 'Menu Sản phẩm → Khuyến mãi → "Tạo khuyến mãi". Nhập mã, phần trăm giảm, thời gian bắt đầu/kết thúc rồi Lưu.' },
  { keys: ['khóa', 'khoá', 'tài khoản', 'khách hàng'], answer: 'Vào Khách hàng, mở chi tiết người dùng, bấm "Khóa tài khoản", chọn hoặc nhập lý do rồi xác nhận. Mở khóa cũng làm ở chính trang này.' },
  { keys: ['hoàn tiền', 'refund'], answer: 'Mở chi tiết khách hàng → tab Hoàn tiền, chọn yêu cầu để xem lý do và xử lý (duyệt hoặc từ chối).' },
  { keys: ['đơn hàng', 'đơn'], answer: 'Menu Đơn hàng cho phép lọc theo trạng thái, phương thức thanh toán, xuất CSV và mở chi tiết để duyệt hoặc từ chối đơn.' },
  { keys: ['xin chào', 'hello', 'chào', 'hi'], answer: 'Chào bạn! Mình là trợ lý quản trị STEAL. Bạn cần hướng dẫn thao tác nào?' }
];

/** Trợ lý AI giả lập (trả lời theo từ khóa, chưa nối AI thật), nổi ở góc phải mọi trang. */
@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.css'
})
export class AiAssistantComponent {
  @Input() mode: 'admin' | 'customer' = 'customer';

  private host = inject(ElementRef);
  readonly open = signal(false);
  readonly typing = signal(false);
  readonly input = signal('');
  readonly messages = signal<AiMessage[]>([]);
  /** Ảnh đã chọn, đang chờ gửi (data URL). */
  readonly pendingImage = signal<string | null>(null);
  readonly imageError = signal('');

  get questions(): string[] {
    return this.mode === 'admin' ? ADMIN_QUESTIONS : CUSTOMER_QUESTIONS;
  }

  toggle(): void {
    this.open.update(v => !v);
    if (this.open() && this.messages().length === 0) {
      this.push('ai', this.mode === 'admin'
        ? 'Xin chào! Mình là trợ lý quản trị STEAL (bản giả lập). Chọn câu hỏi bên dưới hoặc tự gõ nhé.'
        : 'Xin chào! Mình là trợ lý STEAL (bản giả lập). Chọn câu hỏi bên dưới hoặc tự gõ nhé.');
    }
    this.scroll();
  }

  onInput(event: Event): void {
    this.input.set((event.target as HTMLInputElement).value);
  }

  onFile(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    this.imageError.set('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.imageError.set('Chỉ gửi được file ảnh.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { this.imageError.set('Ảnh tối đa 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => this.pendingImage.set(String(reader.result));
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.pendingImage.set(null);
  }

  send(text?: string): void {
    const q = (text ?? this.input()).trim();
    const image = text === undefined ? this.pendingImage() : null;
    if ((!q && !image) || this.typing()) return;
    this.input.set('');
    this.pendingImage.set(null);
    this.push('user', q, image ?? undefined);
    this.typing.set(true);
    setTimeout(() => {
      this.typing.set(false);
      this.push('ai', image && !q
        ? 'Mình đã nhận được ảnh của bạn! (Bản giả lập chưa phân tích được nội dung ảnh, bạn mô tả thêm bằng chữ giúp mình nhé.)'
        : this.answer(q));
    }, 600);
  }

  clear(): void {
    this.messages.set([]);
    this.push('ai', 'Đã xóa cuộc trò chuyện. Bạn muốn hỏi gì tiếp?');
  }

  private answer(q: string): string {
    const text = q.toLowerCase();
    const rules = this.mode === 'admin' ? ADMIN_RULES : CUSTOMER_RULES;
    const hit = rules.find(r => r.keys.some(k => text.includes(k)));
    return hit ? hit.answer : 'Mình chưa hiểu rõ câu hỏi này (bản giả lập chỉ trả lời một số chủ đề). Bạn thử chọn một câu hỏi gợi ý bên dưới nhé.';
  }

  private push(from: 'user' | 'ai', text: string, image?: string): void {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    this.messages.update(list => [...list, { from, text, time, image }]);
    this.scroll();
  }

  private scroll(): void {
    setTimeout(() => {
      const el = (this.host.nativeElement as HTMLElement).querySelector('.ai-body');
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
