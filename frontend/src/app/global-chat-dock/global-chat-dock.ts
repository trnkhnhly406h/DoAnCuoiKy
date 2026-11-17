import { AfterViewChecked, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth';
import { ChatMessage, ChatService, ChatSession, MAX_ATTACHMENT_BYTES, MAX_MESSAGE_LENGTH } from '../services/chat';
import { ConfirmService } from '../services/confirm';
import { ToastService } from '../services/toast';

const TEXT_EMOJIS: string[] = [
  '(•_•)', '(≧▽≦)', '( ͡° ͜ʖ ͡°)', '(╯°□°)╯︵ ┻━┻', '(•̀ᴗ•́)و',
  '(┬─┬ノ( º _ ºノ)', '(o^▽^o)', '(><)', '(;_;)', '(-_-;)',
  '(ʘヮʘ)', '(⌐■_■)', '(^_^)', '(*_*)', '(ಠ_ಠ)',
  '(ಥ_ಥ)', '(◍•ᴗ•◍)', '(°o°)', '(^u^)', '(≡^∇^≡)',
  '(っ˘з(˘⌣˘ )', '(~￣³￣)~', '(っ╹◡╹)っ', '(☉_☉)', '(>_<)',
  '(/( ◕‿◕ )/)', '(•̀ω•́)✧', '(-.-Zzz)', '(⏍‿⏍)', '(🔥_🔥)'
];

@Component({
  selector: 'app-global-chat-dock',
  templateUrl: './global-chat-dock.html',
  styleUrls: ['./global-chat-dock.css'],
  standalone: false
})
export class GlobalChatDockComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLElement>;
  @ViewChild('dockFileInput') dockFileInput?: ElementRef<HTMLInputElement>;

  readonly textEmojis = TEXT_EMOJIS;
  readonly maxMessageLength = MAX_MESSAGE_LENGTH;

  isDockOpen = false;
  isFullChatOpen = false;
  isMaximized = false;
  newMessageInput = '';
  showEmojiPicker = false;
  showChatHeaderMenu = false;
  showMuteSubMenu = false;

  private shouldScrollToBottom = false;
  private lastSeenSessionId = '';
  private lastSeenCount = 0;
  private subscriptions = new Subscription();

  constructor(
    public chatService: ChatService,
    public authService: AuthService,
    private confirm: ConfirmService,
    private toast: ToastService,
    private router: Router
  ) {}

  /** Bấm vào tên/ảnh người gửi để xem hồ sơ của họ. */
  openProfile(msg: ChatMessage): void {
    if (msg.isSelf || msg.isSystem || !msg.senderId || msg.senderId === 'system') return;
    this.router.navigate(['/nguoi-dung', msg.senderId]);
  }

  ngOnInit(): void {
    this.subscriptions.add(this.chatService.isDockOpenSubject.subscribe(state => (this.isDockOpen = state)));
    this.subscriptions.add(
      this.chatService.isFullChatOpenSubject.subscribe(state => {
        this.isFullChatOpen = state;
        if (state) this.shouldScrollToBottom = true;
        else this.closeHeaderMenu();
      })
    );
  }

  ngAfterViewChecked(): void {
    // Tự cuộn xuống cuối khi có tin nhắn mới (kể cả tin phản hồi đến sau) hoặc đổi cuộc trò chuyện.
    const session = this.currentSession;
    const count = session?.messages.length ?? 0;
    if (session && (session.id !== this.lastSeenSessionId || count !== this.lastSeenCount)) {
      this.lastSeenSessionId = session.id;
      this.lastSeenCount = count;
      this.shouldScrollToBottom = true;
    }
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Click ra ngoài sẽ đóng menu bánh răng và bảng emoji. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.header-gear-wrapper')) this.closeHeaderMenu();
    if (!target.closest('.emoji-picker-popup') && !target.closest('.btn-emoji-trigger')) this.showEmojiPicker = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeHeaderMenu();
    this.showEmojiPicker = false;
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  loginNow(): void {
    this.authService.requestLogin();
  }

  /* ---------- Cửa sổ ---------- */

  toggleDock(): void {
    this.chatService.toggleDock();
  }

  toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;
  }

  /** "—": thu nhỏ về danh sách dock. */
  minimizeChat(): void {
    this.chatService.closeFullChat();
  }

  /** "✕": đóng hẳn cả cửa sổ chat lẫn dock. */
  closeChat(): void {
    this.chatService.closeAll();
  }

  openChatSession(session: ChatSession): void {
    this.chatService.openFullChat(session.id);
    this.shouldScrollToBottom = true;
  }

  selectTab(sessionId: string): void {
    this.chatService.openFullChat(sessionId);
    this.closeHeaderMenu();
    this.shouldScrollToBottom = true;
  }

  /* ---------- Trạng thái phiên hiện tại ---------- */

  get currentSession(): ChatSession | undefined {
    return this.chatService.getSelectedSession();
  }

  get isCurrentPartnerBlocked(): boolean {
    const session = this.currentSession;
    return !!session && !session.isGroup && !!session.peerId && this.chatService.isBlocked(session.peerId);
  }

  get pinnedMessages(): ChatMessage[] {
    const session = this.currentSession;
    return session ? this.chatService.getPinnedMessages(session.id) : [];
  }

  get hasBlockedUserInCurrentSession(): boolean {
    const session = this.currentSession;
    return !!session && session.isGroup && session.messages.some(m => this.chatService.isBlockedSender(m.senderId));
  }

  get isShowBlockedMessages(): boolean {
    const session = this.currentSession;
    return !!session && !!this.chatService.showBlockedMessagesMap[session.id];
  }

  toggleShowBlockedMessages(): void {
    const session = this.currentSession;
    if (session) {
      this.chatService.showBlockedMessagesMap[session.id] = !this.chatService.showBlockedMessagesMap[session.id];
    }
  }

  isMasked(msg: ChatMessage): boolean {
    return this.chatService.isBlockedSender(msg.senderId) && !this.isShowBlockedMessages;
  }

  /* ---------- Gửi tin ---------- */

  sendMessage(): void {
    const session = this.currentSession;
    if (!session || !this.newMessageInput.trim()) return;
    const result = this.chatService.sendMessage(session.id, this.newMessageInput);
    if (!result.ok) {
      this.toast.warning(`⚠️ ${result.message}`);
      return;
    }
    this.newMessageInput = '';
    this.showEmojiPicker = false;
    this.shouldScrollToBottom = true;
  }

  togglePin(msgId: string): void {
    const session = this.currentSession;
    if (!session) return;
    const pinned = this.chatService.togglePinMessage(session.id, msgId);
    this.toast.success(pinned ? '📌 Đã ghim tin nhắn!' : '📌 Đã bỏ ghim tin nhắn.');
  }

  toggleEmojiPicker(event: Event): void {
    event.stopPropagation();
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  insertEmoji(emoji: string): void {
    this.newMessageInput = `${this.newMessageInput}${this.newMessageInput && !this.newMessageInput.endsWith(' ') ? ' ' : ''}${emoji} `;
  }

  triggerFileInput(): void {
    if (this.isCurrentPartnerBlocked) {
      this.toast.warning('⚠️ Bạn đã chặn người dùng này!');
      return;
    }
    this.dockFileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const sessionId = this.currentSession?.id;
    input.value = '';
    if (!file || !sessionId) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      this.toast.warning('Tệp quá lớn. Vui lòng chọn tệp nhỏ hơn 2MB.');
      return;
    }
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onerror = () => this.toast.warning('Không thể đọc tệp. Vui lòng thử lại.');
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const result = this.chatService.sendMessage(sessionId, '', {
        name: file.name,
        url: reader.result,
        type: isImage ? 'image' : 'file',
        size: `${(file.size / 1024).toFixed(1)} KB`
      });
      if (!result.ok) {
        this.toast.warning(result.message);
        return;
      }
      this.toast.success(`📎 Đã gửi tệp ${file.name}!`);
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Menu bánh răng ---------- */

  toggleHeaderMenu(event: Event): void {
    event.stopPropagation();
    this.showChatHeaderMenu = !this.showChatHeaderMenu;
    this.showMuteSubMenu = false;
  }

  closeHeaderMenu(): void {
    this.showChatHeaderMenu = false;
    this.showMuteSubMenu = false;
  }

  async toggleBlockCurrentPartner(): Promise<void> {
    this.closeHeaderMenu();
    const session = this.currentSession;
    if (!session || session.isGroup || !session.peerId) return;

    if (this.isCurrentPartnerBlocked) {
      const result = this.chatService.unblockUser(session.peerId);
      this.toast.show(result.message, result.ok ? 'success' : 'warning');
      return;
    }
    const user = this.chatService.findUser(session.peerId);
    if (!user) return;
    const ok = await this.confirm.ask({
      title: `Chặn ${user.username}?`,
      message: 'Người này sẽ bị xóa khỏi danh sách bạn bè và cuộc trò chuyện sẽ bị xóa.',
      confirmText: 'Chặn',
      danger: true
    });
    if (!ok) return;
    const result = this.chatService.blockUser(user);
    this.toast.show(result.message, result.ok ? 'warning' : 'warning');
  }

  muteCurrentSession(duration: '15m' | '1h' | 'forever'): void {
    this.closeHeaderMenu();
    const session = this.currentSession;
    if (!session) return;
    const label = this.chatService.muteSession(session.id, duration);
    this.toast.success(`🔇 Đã tắt thông báo cuộc trò chuyện${label ? ` (${label})` : ''}.`);
  }

  unmuteCurrentSession(): void {
    this.closeHeaderMenu();
    const session = this.currentSession;
    if (!session) return;
    this.chatService.unmuteSession(session.id);
    this.toast.success('🔔 Đã bật lại thông báo cuộc trò chuyện.');
  }

  async deleteCurrentSession(): Promise<void> {
    this.closeHeaderMenu();
    const session = this.currentSession;
    if (!session) return;
    const ok = await this.confirm.ask({
      title: 'Xóa cuộc trò chuyện?',
      message: `Toàn bộ tin nhắn với ${session.name} sẽ bị xóa khỏi thiết bị này.`,
      confirmText: 'Xóa',
      danger: true
    });
    if (!ok) return;
    this.chatService.deleteSession(session.id);
    this.toast.warning('🗑️ Đã xóa cuộc trò chuyện.');
  }

  async leaveCurrentGroup(): Promise<void> {
    this.closeHeaderMenu();
    const session = this.currentSession;
    if (!session) return;
    const ok = await this.confirm.ask({
      title: 'Rời nhóm trò chuyện?',
      message: `Bạn có chắc chắn muốn rời nhóm "${session.name}"?`,
      confirmText: 'Rời nhóm',
      danger: true
    });
    if (!ok) return;
    this.chatService.leaveGroup(session.id);
    this.toast.warning('Đã rời khỏi nhóm trò chuyện.');
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
