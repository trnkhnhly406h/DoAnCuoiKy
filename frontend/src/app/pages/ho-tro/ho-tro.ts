import { Component, OnInit } from '@angular/core';
import { EMAIL_REGEX } from '../../services/auth';
import { normalizeText } from '../../services/storage';
import { ToastService } from '../../services/toast';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    id: 'tai-khoan',
    title: '🔑 Tài Khoản & Bảo Mật',
    items: [
      { question: 'Làm sao để đổi mật khẩu?', answer: 'Vào Cài đặt tài khoản → Bảo mật và thiết bị → Đổi mật khẩu, nhập mật khẩu hiện tại và mật khẩu mới (ít nhất 8 ký tự, gồm cả chữ và số).' },
      { question: 'Làm cách nào để đổi Email hoặc số điện thoại?', answer: 'Vào Cài đặt tài khoản → Thông tin tài khoản → chọn thay đổi và xác minh bằng mã OTP gửi về Email/số điện thoại.' },
      { question: 'Dữ liệu cá nhân của tôi được bảo vệ thế nào?', answer: 'STEAL chỉ lưu thông tin cần thiết cho tài khoản. Bạn có thể bật STEAL Guard (xác thực 2 yếu tố) và đăng xuất các thiết bị lạ trong phần Bảo mật.' }
    ]
  },
  {
    id: 'thanh-toan',
    title: '💳 Thanh Toán & Đơn Hàng',
    items: [
      { question: 'STEAL hỗ trợ những phương thức thanh toán nào?', answer: 'Hiện STEAL hỗ trợ thanh toán bằng mã QR qua Momo, VNPay và PayPal.' },
      { question: 'Tôi đã thanh toán nhưng chưa nhận được game trong thư viện?', answer: 'Vui lòng chờ từ 1 – 5 phút để hệ thống xác nhận giao dịch. Nếu quá 15 phút vẫn chưa thấy game, hãy gửi mã giao dịch cho bộ phận Hỗ trợ qua biểu mẫu ở cuối trang.' }
    ]
  },
  {
    id: 'ky-thuat',
    title: '💻 Tải Game & Lỗi Kỹ Thuật',
    items: [
      { question: 'Game không tải được hoặc báo lỗi kết nối?', answer: 'Kiểm tra lại đường truyền Internet, đảm bảo ổ đĩa lưu trữ còn đủ dung lượng trống và tắt tạm thời phần mềm diệt virus nếu bị chặn tải file.' },
      { question: 'Video trailer hoặc hình ảnh game không hiển thị?', answer: 'Hãy thử xóa cache trình duyệt hoặc cập nhật trình duyệt lên phiên bản mới nhất để trải nghiệm giao diện chuẩn nhất.' }
    ]
  },
  {
    id: 'hoan-tien',
    title: '📑 Chính Sách Hoàn Tiền',
    items: [
      { question: 'Điều kiện để được hoàn tiền mua game?', answer: 'Bạn có thể yêu cầu hoàn tiền trong vòng 14 ngày kể từ ngày mua, với điều kiện thời lượng trải nghiệm game chưa vượt quá 2 giờ chơi. Vào Thư viện, chọn game và bấm "Yêu cầu hoàn tiền". Chi tiết xem tại trang Chính sách hoàn tiền.' }
    ]
  }
];

const TOPICS = ['Tài khoản & Bảo mật', 'Thanh toán & Đơn hàng', 'Tải game & Lỗi kỹ thuật', 'Hoàn tiền', 'Khác'];

@Component({
  selector: 'app-ho-tro',
  templateUrl: './ho-tro.html',
  styleUrls: ['./ho-tro.css'],
  standalone: false
})
export class HoTroComponent implements OnInit {
  readonly topics = TOPICS;
  searchQuery = '';
  filteredGroups: FaqGroup[] = FAQ_GROUPS;

  ticket = { name: '', email: '', topic: TOPICS[0], message: '' };
  ticketErrors: Partial<Record<'name' | 'email' | 'message', string>> = {};

  constructor(private toast: ToastService) {}

  ngOnInit(): void {
    this.onSearch();
  }

  get isSearching(): boolean {
    return this.searchQuery.trim().length > 0;
  }

  onSearch(): void {
    const q = normalizeText(this.searchQuery);
    if (!q) {
      this.filteredGroups = FAQ_GROUPS;
      return;
    }
    this.filteredGroups = FAQ_GROUPS
      .map(group => ({
        ...group,
        items: group.items.filter(i => normalizeText(i.question).includes(q) || normalizeText(i.answer).includes(q) || normalizeText(group.title).includes(q))
      }))
      .filter(group => group.items.length > 0);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.onSearch();
  }

  submitTicket(): void {
    this.ticketErrors = {};
    const name = this.ticket.name.trim();
    const email = this.ticket.email.trim();
    const message = this.ticket.message.trim();

    if (name.length < 2) this.ticketErrors.name = 'Vui lòng nhập họ tên (ít nhất 2 ký tự).';
    if (!EMAIL_REGEX.test(email)) this.ticketErrors.email = 'Email không đúng định dạng.';
    if (message.length < 10) this.ticketErrors.message = 'Nội dung cần ít nhất 10 ký tự để chúng tôi hỗ trợ tốt hơn.';
    if (message.length > 1000) this.ticketErrors.message = 'Nội dung tối đa 1000 ký tự.';
    if (Object.keys(this.ticketErrors).length > 0) return;

    const code = `TK${Math.floor(10000 + Math.random() * 90000)}`;
    this.toast.success(`Đã gửi yêu cầu hỗ trợ #${code}. Chúng tôi sẽ phản hồi qua email trong 2-4 giờ.`);
    this.ticket = { name: '', email: '', topic: TOPICS[0], message: '' };
  }
}
