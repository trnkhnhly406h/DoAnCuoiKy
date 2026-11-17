import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth';
import { NotificationService } from './notification';
import { PreferencesService } from './preferences';
import { loadJson, saveJson } from './storage';
import { ToastService } from './toast';
import { UserProfileService } from './user-profile';
import {
  avatarOf, buildHistory, DIRECTORY, directoryUser, FRIEND_SCRIPTS, GROUP_BANTER, INVITE_BOSS_SCRIPT, INVITE_CTRLC_SCRIPT,
  KEYWORD_REPLIES, OWN_GROUP_SCRIPT, PERSONALITY_REPLIES, STARTER_GROUP_SCRIPT
} from './social-data';

/* ===================== Kiểu dữ liệu ===================== */

export interface ChatAttachment {
  name: string;
  url: string;
  type: 'image' | 'file';
  size?: string;
}

export interface ChatMessage {
  id: string;
  /** 'me' cho tin nhắn của chính mình, còn lại là id người dùng. */
  senderId: string;
  sender: string;
  avatar: string;
  text: string;
  time: string;
  isSelf: boolean;
  isPinned?: boolean;
  /** Tin nhắn hệ thống (thêm/đá thành viên, chuyển quyền...). */
  isSystem?: boolean;
  attachment?: ChatAttachment;
}

export interface ChatSession {
  id: string;
  name: string;
  avatar: string;
  isGroup: boolean;
  /** Id người bạn đang chat cùng (chỉ có ở chat 1-1). */
  peerId?: string;
  isOnline?: boolean;
  unreadCount: number;
  messages: ChatMessage[];
  /** Mốc thời gian (ms) hết tắt thông báo; -1 = cho đến khi bật lại; null = không tắt. */
  mutedUntil: number | null;
}

/** Một người dùng trong "cơ sở dữ liệu" tìm kiếm / danh sách bạn bè / lời mời. */
export interface DatabaseUser {
  id: string;
  username: string;
  handle: string;
  avatar: string;
  accountCode: string;
  isOnline: boolean;
  lastOnlineText?: string;
  /** Dữ liệu demo: người này tự động chấp nhận lời mời sau ít giây. */
  autoAccept?: boolean;
  /** Tính cách (quyết định kiểu trả lời tự động). */
  personality?: string;
  bio?: string;
  country?: string;
  friendIds?: string[];
  wishlistIds?: string[];
  libraryIds?: string[];
  hideWishlist?: boolean;
  hideLibrary?: boolean;
}

/** Hồ sơ người khác nhìn thấy: bạn bè xem được đầy đủ, người lạ chỉ thấy thông tin cơ bản. */
export interface PublicProfile {
  user: DatabaseUser;
  relation: Relation;
  isFriend: boolean;
  bio: string;
  country: string;
  wishlistIds: string[];
  libraryIds: string[];
  wishlistHidden: boolean;
  libraryHidden: boolean;
  mutualFriends: DatabaseUser[];
  friendCount: number;
}

export interface JoinRequest {
  id: string;
  user: DatabaseUser;
  requestedById: string;
  requestedByName: string;
}

export type SearchDatabaseUser = DatabaseUser;
export type FriendUser = DatabaseUser;
export type FriendRequest = DatabaseUser;

export interface GroupInvite {
  id: string;
  groupName: string;
  inviterId: string;
  inviterName: string;
  avatar: string;
  members: DatabaseUser[];
  historyMessages: ChatMessage[];
}

export interface GroupChat {
  id: string;
  name: string;
  slogan: string;
  avatar: string;
  ownerId: string;
  ownerName: string;
  /** Thành viên (không gồm chính mình; gồm cả nhóm trưởng khi nhóm trưởng là người khác). */
  members: DatabaseUser[];
  /** Đề nghị thêm thành viên đang chờ nhóm trưởng duyệt. */
  joinRequests: JoinRequest[];
  /** Đã giả lập một đề nghị thêm thành viên (chỉ làm một lần). */
  proposalMade?: boolean;
}

export type Relation = 'self' | 'friend' | 'blocked' | 'sent' | 'incoming' | 'none';

export interface ActionResult {
  ok: boolean;
  message: string;
}

export const SELF_ID = 'me';
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_GROUP_NAME_LENGTH = 30;
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_GROUP_MEMBERS = 50;
export const SYSTEM_ID = 'system';

const STORAGE_KEY = 'steal_chat_v2';
const BLOCK_COOLDOWN_MS = 48 * 60 * 60 * 1000;
interface PersistedChat {
  friends: DatabaseUser[];
  pending: DatabaseUser[];
  sent: DatabaseUser[];
  blocked: DatabaseUser[];
  blockCooldown: Record<string, number>;
  invites: GroupInvite[];
  groups: GroupChat[];
  sessions: ChatSession[];
  openTabIds: string[];
  selectedSessionId: string;
  starterInviteSent: boolean;

knownUsers?: DatabaseUser[];

}

/**
 * Dịch vụ xã hội: bạn bè, lời mời, chặn, nhóm và các phiên chat.
 * Đây là nguồn dữ liệu duy nhất cho mọi màn hình chat/bạn bè.
 */
@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly isDockOpenSubject = new BehaviorSubject<boolean>(false);
  readonly isFullChatOpenSubject = new BehaviorSubject<boolean>(false);

  readonly databaseUsers: DatabaseUser[] = DIRECTORY;

  friendsList: FriendUser[] = [];
  pendingFriendRequests: FriendRequest[] = [];
  sentFriendRequests: DatabaseUser[] = [];
  blockedUsers: DatabaseUser[] = [];
  groupInvitations: GroupInvite[] = [];
  groups: GroupChat[] = [];

  activeSessions: ChatSession[] = [];
  openTabs: ChatSession[] = [];
  selectedSessionId = '';

private knownUsers: DatabaseUser[] = [];

private rememberUser(user: DatabaseUser): void {
  if (!this.knownUsers.some(x => x.id === user.id)) {
    this.knownUsers = [...this.knownUsers, user];
  }
}

  showBlockedMessagesMap: Record<string, boolean> = {};
  private blockCooldownMap: Record<string, number> = {};
  private starterInviteSent = false;
  private idSeq = 0;

  constructor(
    private auth: AuthService,
    private profile: UserProfileService,
    private preferences: PreferencesService,
    private notifications: NotificationService,
    private toast: ToastService
  ) {
    // Dữ liệu chat riêng cho từng tài khoản: tải lại mỗi khi đổi tài khoản / đăng xuất.
    this.auth.scope$.subscribe(() => this.reload());
  }

  /* ===================== Người dùng hiện tại ===================== */

  get currentUser(): { name: string; avatar: string; status: string } {
    return { name: this.profile.displayName, avatar: this.profile.avatar, status: 'Online' };
  }

  /* ===================== Cửa sổ chat ===================== */

  toggleDock(): void {
    // Đang mở cửa sổ chat lớn: bấm nút dock sẽ thu nhỏ về danh sách.
    if (this.isFullChatOpenSubject.value) {
      this.closeFullChat();
      return;
    }
    this.isDockOpenSubject.next(!this.isDockOpenSubject.value);
  }

  openFullChat(sessionId?: string): void {
    const id = sessionId || this.selectedSessionId || this.openTabs[0]?.id || this.activeSessions[0]?.id;
    this.isDockOpenSubject.next(true);
    const session = id ? this.findSession(id) : undefined;
    if (!session) return; // chưa có phiên chat nào: chỉ mở danh sách dock
    this.selectedSessionId = session.id;
    session.unreadCount = 0;
    if (!this.openTabs.some(s => s.id === session.id)) {
      this.openTabs = [...this.openTabs, session];
    }
    this.isFullChatOpenSubject.next(true);
    this.persist();
  }

  closeFullChat(): void {
    this.isFullChatOpenSubject.next(false);
  }

  /** Đóng toàn bộ cửa sổ chat và dock. */
  closeAll(): void {
    this.isFullChatOpenSubject.next(false);
    this.isDockOpenSubject.next(false);
  }

  closeTab(sessionId: string, event?: Event): void {
    event?.stopPropagation();
    const index = this.openTabs.findIndex(s => s.id === sessionId);
    this.openTabs = this.openTabs.filter(s => s.id !== sessionId);
    if (this.selectedSessionId === sessionId) {
      const next = this.openTabs[Math.min(index, this.openTabs.length - 1)];
      this.selectedSessionId = next?.id ?? '';
    }
    if (this.openTabs.length === 0) this.closeFullChat();
    this.persist();
  }

  getSelectedSession(): ChatSession | undefined {
    return this.findSession(this.selectedSessionId);
  }

  get totalUnread(): number {
    return this.activeSessions.reduce((sum, s) => sum + (this.isMuted(s) ? 0 : s.unreadCount), 0);
  }

  /* ===================== Phiên chat ===================== */

  findSession(sessionId: string): ChatSession | undefined {
    return this.activeSessions.find(s => s.id === sessionId);
  }

  ensureDirectSession(user: DatabaseUser): ChatSession {
    let session = this.findSession(user.id);
    if (!session) {
      session = {
        id: user.id, name: user.username, avatar: user.avatar, isGroup: false, peerId: user.id,
        isOnline: user.isOnline, unreadCount: 0, messages: [], mutedUntil: null
      };
      this.activeSessions = [...this.activeSessions, session];
      this.persist();
    }
    return session;
  }

  openDirectChat(user: DatabaseUser): void {
    this.ensureDirectSession(user);
    this.openFullChat(user.id);
  }

  deleteSession(sessionId: string): void {
    this.activeSessions = this.activeSessions.filter(s => s.id !== sessionId);
    this.openTabs = this.openTabs.filter(s => s.id !== sessionId);
    delete this.showBlockedMessagesMap[sessionId];
    if (this.selectedSessionId === sessionId) {
      this.selectedSessionId = this.openTabs[0]?.id ?? '';
    }
    if (!this.selectedSessionId) this.closeFullChat();
    this.persist();
  }

  /* ===================== Tin nhắn ===================== */

  sendMessage(sessionId: string, text: string, attachment?: ChatAttachment): ActionResult {
    const session = this.findSession(sessionId);
    if (!session) return { ok: false, message: 'Không tìm thấy cuộc trò chuyện.' };
    if (!session.isGroup && session.peerId && this.isBlocked(session.peerId)) {
      return { ok: false, message: 'Bạn đã chặn người dùng này. Hãy bỏ chặn để tiếp tục nhắn tin.' };
    }
    const content = text.trim();
    if (!content && !attachment) return { ok: false, message: 'Tin nhắn đang trống.' };
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, message: `Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.` };
    }
    session.messages.push({
      id: this.nextId('msg'), senderId: SELF_ID, sender: this.currentUser.name, avatar: this.currentUser.avatar,
      text: content, time: this.nowText(), isSelf: true, attachment
    });
    this.persist();
    if (content) this.scheduleReply(session, content);
    return { ok: true, message: '' };
  }

  togglePinMessage(sessionId: string, msgId: string): boolean {
    const msg = this.findSession(sessionId)?.messages.find(m => m.id === msgId);
    if (!msg) return false;
    msg.isPinned = !msg.isPinned;
    this.persist();
    return !!msg.isPinned;
  }

  getPinnedMessages(sessionId: string): ChatMessage[] {
    return this.findSession(sessionId)?.messages.filter(m => m.isPinned) ?? [];
  }

  /** Áp dụng bộ lọc từ ngữ của người dùng khi hiển thị tin nhắn. */
  displayText(text: string): string {
    return this.preferences.censor(text);
  }

  /* ===================== Tắt thông báo ===================== */

  isMuted(session: ChatSession): boolean {
    return session.mutedUntil === -1 || (session.mutedUntil !== null && Date.now() < session.mutedUntil);
  }

  muteLabel(session: ChatSession): string {
    if (!this.isMuted(session)) return '';
    if (session.mutedUntil === -1 || session.mutedUntil === null) return 'Cho đến khi bật lại';
    const minutes = Math.max(1, Math.ceil((session.mutedUntil - Date.now()) / 60000));
    return minutes >= 60 ? `còn ${Math.ceil(minutes / 60)} giờ` : `còn ${minutes} phút`;
  }

  muteSession(sessionId: string, duration: '15m' | '1h' | 'forever'): string {
    const session = this.findSession(sessionId);
    if (!session) return '';
    session.mutedUntil = duration === 'forever' ? -1
      : Date.now() + (duration === '15m' ? 15 : 60) * 60 * 1000;
    this.persist();
    return this.muteLabel(session);
  }

  unmuteSession(sessionId: string): void {
    const session = this.findSession(sessionId);
    if (session) {
      session.mutedUntil = null;
      this.persist();
    }
  }

  /* ===================== Quan hệ bạn bè / chặn ===================== */

  relationOf(userId: string): Relation {
    if (userId === SELF_ID) return 'self';
    if (this.isBlocked(userId)) return 'blocked';
    if (this.friendsList.some(f => f.id === userId)) return 'friend';
    if (this.sentFriendRequests.some(r => r.id === userId)) return 'sent';
    if (this.pendingFriendRequests.some(r => r.id === userId)) return 'incoming';
    return 'none';
  }

  /** Tìm thông tin người dùng theo id trong mọi danh sách đã biết. */
  
findUser(userId: string): DatabaseUser | undefined {
  return [
    ...this.friendsList,
    ...this.pendingFriendRequests,
    ...this.sentFriendRequests,
    ...this.blockedUsers,
    ...this.knownUsers,
    ...this.databaseUsers
  ].find(u => u.id === userId);
}


  isBlocked(userId: string): boolean {
    return this.blockedUsers.some(u => u.id === userId);
  }

  isBlockedSender(senderId: string): boolean {
    return senderId !== SELF_ID && this.isBlocked(senderId);
  }

  sendFriendRequest(user: DatabaseUser): ActionResult {
    this.rememberUser(user);
    switch (this.relationOf(user.id)) {
      case 'self': return { ok: false, message: 'Bạn không thể gửi lời mời kết bạn cho chính mình.' };
      case 'blocked': return { ok: false, message: 'Bạn đã chặn người dùng này. Hãy bỏ chặn trước khi tiếp tục.' };
      case 'friend': return { ok: false, message: 'Người dùng này đã có trong danh sách bạn bè.' };
      case 'sent': return { ok: false, message: 'Bạn đã gửi lời mời kết bạn cho người này rồi.' };
      case 'incoming':
        this.acceptFriendRequest(user);
        return { ok: true, message: `${user.username} cũng đã gửi lời mời cho bạn nên hai bạn đã trở thành bạn bè!` };
      default: break;
    }
    this.sentFriendRequests = [...this.sentFriendRequests, user];
    this.persist();
    // Giả lập: mọi lời mời kết bạn đều được chấp nhận sau 1-3 giây.
    setTimeout(() => this.completeSentRequest(user.id), this.acceptDelay(user));
    return { ok: true, message: `📩 Đã gửi lời mời kết bạn tới ${user.username}!` };
  }

  cancelSentRequest(userId: string): void {
    this.sentFriendRequests = this.sentFriendRequests.filter(r => r.id !== userId);
    this.persist();
  }

  acceptFriendRequest(user: FriendRequest): void {
    this.rememberUser(user);
    this.pendingFriendRequests = this.pendingFriendRequests.filter(r => r.id !== user.id);
    this.addFriend(user);
  }

  declineFriendRequest(userId: string): void {
    this.pendingFriendRequests = this.pendingFriendRequests.filter(r => r.id !== userId);
    this.persist();
  }

  
unfriend(userId: string): void {
  const user = this.findUser(userId);

  if (user) {
    this.rememberUser(user);
  }

  this.friendsList = this.friendsList.filter(
    f => f.id !== userId
  );

  this.sentFriendRequests =
    this.sentFriendRequests.filter(
      r => r.id !== userId
    );

  this.pendingFriendRequests =
    this.pendingFriendRequests.filter(
      r => r.id !== userId
    );

  this.deleteSession(userId);
  this.persist();
}


  
blockUser(user: DatabaseUser): ActionResult {
  this.rememberUser(user);

  if (this.isBlocked(user.id)) {
    return {
      ok: false,
      message: 'Người dùng này đã bị chặn.'
    };
  }

  this.blockedUsers = [
    ...this.blockedUsers,
    user
  ];

  this.friendsList = this.friendsList.filter(
    f => f.id !== user.id
  );

  this.pendingFriendRequests =
    this.pendingFriendRequests.filter(
      r => r.id !== user.id
    );

  this.sentFriendRequests =
    this.sentFriendRequests.filter(
      r => r.id !== user.id
    );

  this.deleteSession(user.id);

  // Lưu LocalStorage
  this.persist();

  return {
    ok: true,
    message: `Đã chặn ${user.username}.`
  };
}

unblockUser(userId: string): ActionResult {
  const user = this.blockedUsers.find(
    u => u.id === userId
  );

  if (!user) {
    return {
      ok: false,
      message: 'Người dùng chưa bị chặn.'
    };
  }

  this.rememberUser(user);

  this.blockedUsers = this.blockedUsers.filter(
    u => u.id !== userId
  );

  // Không áp dụng thời gian chờ 48 giờ nữa
  delete this.blockCooldownMap[userId];

  this.persist();

  return {
    ok: true,
    message: `Đã bỏ chặn ${user.username}.`
  };
}


  /* ===================== Nhóm ===================== */

  isGroupOwner(group: GroupChat): boolean {
    return group.ownerId === SELF_ID;
  }

  /** Số thành viên hiển thị (gồm cả chính mình). */
  groupMemberCount(group: GroupChat): number {
    return group.members.length + 1;
  }

  createGroup(name: string, members: DatabaseUser[]): ActionResult & { group?: GroupChat } {
    const groupName = name.trim();
    if (!groupName) return { ok: false, message: 'Vui lòng nhập Tên trò chuyện nhóm!' };
    if (groupName.length > MAX_GROUP_NAME_LENGTH) {
      return { ok: false, message: `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự.` };
    }
    if (this.groups.some(g => g.name.toLowerCase() === groupName.toLowerCase())) {
      return { ok: false, message: 'Bạn đã có một nhóm trùng tên này.' };
    }
    const group: GroupChat = {
      id: this.nextId('group'), name: groupName, slogan: 'Nơi giao lưu đỉnh cao',
      avatar: avatarOf(groupName), ownerId: SELF_ID, ownerName: this.currentUser.name,
      members: [...members], joinRequests: []
    };
    this.groups = [...this.groups, group];
    this.ensureGroupSession(group);
    this.systemMessage(group.id, `${this.currentUser.name} đã tạo nhóm "${group.name}".`);
    this.persist();
    this.scheduleProposal(group);
    return { ok: true, message: `🎉 Tạo nhóm "${group.name}" thành công!`, group };
  }

  acceptGroupInvite(inviteId: string): GroupChat | null {
    const invite = this.groupInvitations.find(i => i.id === inviteId);
    if (!invite) return null;
    this.groupInvitations = this.groupInvitations.filter(i => i.id !== inviteId);

    let group = this.groups.find(g => g.name === invite.groupName && g.ownerId === invite.inviterId);
    if (!group) {
      group = {
        id: this.nextId('group'), name: invite.groupName, slogan: 'Nơi giao lưu đỉnh cao', avatar: invite.avatar,
        ownerId: invite.inviterId, ownerName: invite.inviterName,
        members: invite.members.filter(m => !this.isBlocked(m.id)), joinRequests: []
      };
      this.groups = [...this.groups, group];
      this.ensureGroupSession(group, JSON.parse(JSON.stringify(invite.historyMessages)) as ChatMessage[]);
      this.systemMessage(group.id, `${this.currentUser.name} đã tham gia nhóm.`);
    }
    this.persist();
    this.openFullChat(group.id);
    this.scheduleBanter(group.id);
    return group;
  }

  declineGroupInvite(inviteId: string): void {
    this.groupInvitations = this.groupInvitations.filter(i => i.id !== inviteId);
    this.persist();
  }

  updateGroup(groupId: string, changes: { name: string; slogan: string; avatar: string }): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return { ok: false, message: 'Không tìm thấy nhóm cần cập nhật.' };
    if (!this.isGroupOwner(group)) return { ok: false, message: 'Chỉ trưởng nhóm mới được chỉnh sửa thiết lập nhóm.' };
    const name = changes.name.trim();
    if (!name) return { ok: false, message: 'Tên nhóm không được để trống.' };
    if (name.length > MAX_GROUP_NAME_LENGTH) return { ok: false, message: `Tên nhóm tối đa ${MAX_GROUP_NAME_LENGTH} ký tự.` };
    if (this.groups.some(g => g.id !== groupId && g.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, message: 'Đã có nhóm khác trùng tên này.' };
    }
    group.name = name;
    group.slogan = changes.slogan.trim();
    group.avatar = changes.avatar || group.avatar;
    const session = this.findSession(group.id);
    if (session) {
      session.name = group.name;
      session.avatar = group.avatar;
    }
    this.persist();
    return { ok: true, message: 'Lưu cài đặt nhóm trò chuyện thành công!' };
  }

  /**
   * Thêm người vào nhóm.
   * - Nhóm trưởng: thêm trực tiếp.
   * - Thành viên thường: gửi đề nghị, chờ nhóm trưởng duyệt.
   */
  addMembersToGroup(groupId: string, users: DatabaseUser[]): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return { ok: false, message: 'Không tìm thấy nhóm.' };
    const candidates = users.filter(u =>
      u.id !== SELF_ID && !this.isBlocked(u.id) &&
      !group.members.some(m => m.id === u.id) && !group.joinRequests.some(r => r.user.id === u.id)
    );
    if (candidates.length === 0) return { ok: false, message: 'Những người này đã ở trong nhóm hoặc đang chờ duyệt.' };
    if (group.members.length + 1 + candidates.length > MAX_GROUP_MEMBERS) {
      return { ok: false, message: `Nhóm tối đa ${MAX_GROUP_MEMBERS} thành viên.` };
    }
    const names = candidates.map(u => u.username).join(', ');

    if (this.isGroupOwner(group)) {
      group.members = [...group.members, ...candidates];
      this.systemMessage(groupId, `${this.currentUser.name} đã thêm ${names} vào nhóm.`);
      this.persist();
      return { ok: true, message: `Đã thêm ${names} vào nhóm.` };
    }

    const requests = candidates.map(user => ({
      id: this.nextId('req'), user, requestedById: SELF_ID, requestedByName: this.currentUser.name
    }));
    group.joinRequests = [...group.joinRequests, ...requests];
    this.systemMessage(groupId, `${this.currentUser.name} đề nghị thêm ${names} vào nhóm, đang chờ nhóm trưởng ${group.ownerName} duyệt.`);
    this.persist();
    // Nhóm trưởng là người trong hệ thống: giả lập duyệt sau ít giây.
    requests.forEach((req, i) => setTimeout(() => this.autoApprove(groupId, req.id), 2200 + i * 700));
    return { ok: true, message: `Đã gửi đề nghị thêm ${names}. Đang chờ nhóm trưởng ${group.ownerName} duyệt.` };
  }

  approveJoinRequest(groupId: string, requestId: string): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return { ok: false, message: 'Không tìm thấy nhóm.' };
    if (!this.isGroupOwner(group)) return { ok: false, message: 'Chỉ nhóm trưởng mới được duyệt thành viên.' };
    const req = group.joinRequests.find(r => r.id === requestId);
    if (!req) return { ok: false, message: 'Đề nghị này không còn tồn tại.' };
    group.joinRequests = group.joinRequests.filter(r => r.id !== requestId);
    if (!group.members.some(m => m.id === req.user.id)) group.members = [...group.members, req.user];
    this.systemMessage(groupId, `${this.currentUser.name} đã duyệt: ${req.user.username} (do ${req.requestedByName} đề nghị) đã vào nhóm.`);
    this.persist();
    return { ok: true, message: `Đã duyệt ${req.user.username} vào nhóm.` };
  }

  declineJoinRequest(groupId: string, requestId: string): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group || !this.isGroupOwner(group)) return { ok: false, message: 'Chỉ nhóm trưởng mới được từ chối đề nghị.' };
    const req = group.joinRequests.find(r => r.id === requestId);
    if (!req) return { ok: false, message: 'Đề nghị này không còn tồn tại.' };
    group.joinRequests = group.joinRequests.filter(r => r.id !== requestId);
    this.persist();
    return { ok: true, message: `Đã từ chối đề nghị thêm ${req.user.username}.` };
  }

  /** Nhóm trưởng mời bất kỳ thành viên nào ra khỏi nhóm. */
  kickMember(groupId: string, userId: string): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return { ok: false, message: 'Không tìm thấy nhóm.' };
    if (!this.isGroupOwner(group)) return { ok: false, message: 'Chỉ nhóm trưởng mới được mời thành viên ra khỏi nhóm.' };
    const member = group.members.find(m => m.id === userId);
    if (!member) return { ok: false, message: 'Người này không ở trong nhóm.' };
    group.members = group.members.filter(m => m.id !== userId);
    group.joinRequests = group.joinRequests.filter(r => r.user.id !== userId);
    this.systemMessage(groupId, `${member.username} đã bị ${this.currentUser.name} mời ra khỏi nhóm.`);
    this.persist();
    return { ok: true, message: `Đã mời ${member.username} ra khỏi nhóm.` };
  }

  /** Bổ nhiệm một thành viên làm nhóm trưởng mới (mình trở thành thành viên thường). */
  transferOwnership(groupId: string, userId: string): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return { ok: false, message: 'Không tìm thấy nhóm.' };
    if (!this.isGroupOwner(group)) return { ok: false, message: 'Chỉ nhóm trưởng hiện tại mới được chuyển quyền.' };
    const target = group.members.find(m => m.id === userId);
    if (!target) return { ok: false, message: 'Người được bổ nhiệm phải là thành viên của nhóm.' };
    group.ownerId = target.id;
    group.ownerName = target.username;
    this.systemMessage(groupId, `${this.currentUser.name} đã bổ nhiệm ${target.username} làm nhóm trưởng mới.`);
    this.persist();
    return { ok: true, message: `${target.username} giờ là nhóm trưởng của "${group.name}".` };
  }

  leaveGroup(groupId: string): ActionResult {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return { ok: false, message: 'Không tìm thấy nhóm.' };
    // Nhóm trưởng còn thành viên khác: phải chọn người kế nhiệm trước khi rời.
    if (this.isGroupOwner(group) && group.members.length > 0) {
      return { ok: false, message: 'Bạn đang là nhóm trưởng. Hãy bổ nhiệm một thành viên làm nhóm trưởng mới trước khi rời nhóm.' };
    }
    this.groups = this.groups.filter(g => g.id !== groupId);
    this.deleteSession(groupId);
    this.persist();
    return { ok: true, message: `Bạn đã rời nhóm "${group.name}".` };
  }

  /* ===================== Hồ sơ công khai ===================== */

  /** Hồ sơ của một người dùng khác theo quyền của mình: bạn bè xem đầy đủ, người lạ chỉ xem thông tin cơ bản. */
  getPublicProfile(userId: string): PublicProfile | null {
    const user = this.findUser(userId);
    if (!user) return null;
    const relation = this.relationOf(userId);
    const isFriend = relation === 'friend';
    const mine = this.friendsList.map(f => f.id);
    const theirIds = user.friendIds ?? [];
    return {
      user, relation, isFriend,
      bio: isFriend ? (user.bio ?? '') : '',
      country: user.country ?? 'Việt Nam',
      wishlistIds: isFriend && !user.hideWishlist ? (user.wishlistIds ?? []) : [],
      libraryIds: isFriend && !user.hideLibrary ? (user.libraryIds ?? []) : [],
      wishlistHidden: !!user.hideWishlist,
      libraryHidden: !!user.hideLibrary,
      mutualFriends: theirIds.filter(id => mine.includes(id)).map(id => directoryUser(id)).filter(u => !!u),
      friendCount: theirIds.length + (isFriend ? 1 : 0)
    };
  }
/* ===================== Hồ sơ công khai ===================== */

  // XÓA GAME KHỎI DANH SÁCH ƯỚC VÀ CHUYỂN VÀO THƯ VIỆN CỦA BẠN BÈ KHI ĐƯỢC TẶNG
  removeFriendWishlistGame(friendIdentifier: string, gameId: string): void {
    if (!friendIdentifier || !gameId) return;

    const target = friendIdentifier.trim().toLowerCase();
    const friend = [...this.friendsList, ...this.databaseUsers]
      .find(u => u.id.toLowerCase() === target || u.username.toLowerCase() === target || (u.handle && u.handle.toLowerCase() === target));

    if (friend) {
      // 1. Xóa game khỏi danh sách ước của bạn bè
      if (friend.wishlistIds) {
        friend.wishlistIds = friend.wishlistIds.filter(id => id !== gameId);
      }

      // 2. Tự động thêm game vào thư viện game hay chơi của bạn bè
      if (!friend.libraryIds) {
        friend.libraryIds = [];
      }
      if (!friend.libraryIds.includes(gameId)) {
        friend.libraryIds.push(gameId);
      }

      // Lưu lại thay đổi
      this.persist();
    }
  }
  /* ===================== Đặt lại / dữ liệu mẫu ===================== */

  reset(): void {
    this.clearState();
    this.closeAll();
    this.persist();
  }

  loadSample(): void {
    this.reset();
    this.applySeed();
    this.persist();
  }

  /* ===================== Nội bộ ===================== */

  private clearState(): void {
    this.knownUsers = [];
    this.friendsList = [];
    this.pendingFriendRequests = [];
    this.sentFriendRequests = [];
    this.blockedUsers = [];
    this.blockCooldownMap = {};
    this.groupInvitations = [];
    this.groups = [];
    this.activeSessions = [];
    this.openTabs = [];
    this.selectedSessionId = '';
    this.showBlockedMessagesMap = {};
    this.starterInviteSent = false;
  }

  private addFriend(user: DatabaseUser): void {
    if (this.isBlocked(user.id)) return;
    if (!this.friendsList.some(f => f.id === user.id)) {
      this.friendsList = [...this.friendsList, user];
    }
    this.ensureDirectSession(user);
    this.persist();
    this.scheduleStarterInvite();
  }

  /** Mọi lời mời kết bạn đều được chấp nhận sau 1-3 giây (giả lập). */
  private acceptDelay(user: DatabaseUser): number {
    const index = Math.max(0, DIRECTORY.findIndex(u => u.id === user.id));
    return 1200 + (index % 5) * 450;
  }

  private completeSentRequest(userId: string): void {
    const user = this.sentFriendRequests.find(r => r.id === userId);
    if (!user) return; // đã bị hủy hoặc đã xử lý
    this.sentFriendRequests = this.sentFriendRequests.filter(r => r.id !== userId);
    this.addFriend(user);
    this.toast.success(`${user.username} đã đồng ý lời mời kết bạn, giờ đây hai bạn có thể trò chuyện với nhau.`);
    this.notifications.push('friend', 'KẾT BẠN THÀNH CÔNG', `${user.username} đã chấp nhận lời mời kết bạn của bạn.`, '🤝');
    // Bạn mới chào hỏi ngay.
    setTimeout(() => this.receiveMessage(userId, this.greeting(user)), 1500);
  }

  private greeting(user: DatabaseUser): string {
    const hello = KEYWORD_REPLIES[0].lines;
    return `${hello[Math.floor(Math.random() * hello.length)]} Mình là ${user.username}, rất vui được làm quen!`;
  }

  /** Người dùng mới có 2 người bạn đầu tiên → họ rủ vào một nhóm có thêm người lạ (chỉ một lần). */
  private scheduleStarterInvite(): void {
    if (this.starterInviteSent || this.friendsList.length < 2) return;
    this.starterInviteSent = true;
    const [first, second] = this.friendsList;
    setTimeout(() => {
      if (!this.auth.isLoggedIn) return;
      const members = [first, second, directoryUser('db12'), directoryUser('db13'), directoryUser('db14')]
        .filter((u, idx, arr) => !!u && arr.findIndex(x => x.id === u.id) === idx && !this.isBlocked(u.id));
      this.groupInvitations = [...this.groupInvitations, {
        id: this.nextId('inv'), groupName: 'Hội Anh Em Chơi Game', inviterId: first.id, inviterName: first.username,
        avatar: avatarOf('hoi-anh-em-choi-game'), members,
        historyMessages: buildHistory(STARTER_GROUP_SCRIPT, this.selfInfo(), this.nextId('starter'))
      }];
      this.persist();
      this.toast.success(`👥 ${first.username} mời bạn vào nhóm "Hội Anh Em Chơi Game"!`);
      this.notifications.push('friend', 'LỜI MỜI VÀO NHÓM', `${first.username} mời bạn vào nhóm "Hội Anh Em Chơi Game".`, '👥');
    }, 4000);
  }

  private ensureGroupSession(group: GroupChat, initial: ChatMessage[] = []): void {
    if (this.findSession(group.id)) return;
    const session: ChatSession = {
      id: group.id, name: group.name, avatar: group.avatar, isGroup: true,
      unreadCount: 0, messages: initial, mutedUntil: null
    };
    this.activeSessions = [...this.activeSessions, session];
  }

  private systemMessage(sessionId: string, text: string): void {
    const session = this.findSession(sessionId);
    if (!session) return;
    session.messages.push({
      id: this.nextId('sys'), senderId: SYSTEM_ID, sender: 'Hệ thống', avatar: '',
      text, time: this.nowText(), isSelf: false, isSystem: true
    });
  }

  private selfInfo(): { name: string; avatar: string } {
    return { name: this.currentUser.name, avatar: this.currentUser.avatar };
  }

  /** Nhóm trưởng (người trong hệ thống) tự duyệt đề nghị của mình sau ít giây. */
  private autoApprove(groupId: string, requestId: string): void {
    const group = this.groups.find(g => g.id === groupId);
    const req = group?.joinRequests.find(r => r.id === requestId);
    if (!group || !req || this.isGroupOwner(group)) return;
    group.joinRequests = group.joinRequests.filter(r => r.id !== requestId);
    if (!group.members.some(m => m.id === req.user.id)) group.members = [...group.members, req.user];
    this.systemMessage(groupId, `Nhóm trưởng ${group.ownerName} đã duyệt: ${req.user.username} đã vào nhóm.`);
    this.persist();
    this.toast.success(`${group.ownerName} đã duyệt: ${req.user.username} đã vào nhóm "${group.name}".`);
  }

  /** Trong nhóm của mình, một thành viên đề nghị thêm người lạ vào (chỉ một lần) để nhóm trưởng duyệt. */
  private scheduleProposal(group: GroupChat): void {
    if (group.proposalMade || group.ownerId !== SELF_ID || group.members.length === 0) return;
    setTimeout(() => {
      const live = this.groups.find(g => g.id === group.id);
      if (!live || live.proposalMade || !this.auth.isLoggedIn) return;
      const proposer = live.members[0];
      const candidate = DIRECTORY.find(u =>
        !live.members.some(m => m.id === u.id) && !live.joinRequests.some(r => r.user.id === u.id) &&
        !this.isBlocked(u.id) && !this.friendsList.some(f => f.id === u.id)
      );
      if (!proposer || !candidate) return;
      live.proposalMade = true;
      live.joinRequests = [...live.joinRequests, { id: this.nextId('req'), user: candidate, requestedById: proposer.id, requestedByName: proposer.username }];
      this.systemMessage(live.id, `${proposer.username} đề nghị thêm ${candidate.username} vào nhóm. Nhóm trưởng hãy duyệt trong phần Thiết lập nhóm.`);
      this.persist();
      this.toast.success(`🔔 ${proposer.username} đề nghị thêm ${candidate.username} vào nhóm "${live.name}". Hãy duyệt trong Thiết lập nhóm.`);
      this.notifications.push('friend', 'ĐỀ NGHỊ THÊM THÀNH VIÊN', `${proposer.username} đề nghị thêm ${candidate.username} vào "${live.name}".`, '➕');
    }, 9000);
  }

  /* ----- Phản hồi tự động ----- */

  private pick<T>(list: T[]): T {
    return list[Math.floor(Math.random() * list.length)];
  }

  private replyFor(user: DatabaseUser, text: string): string {
    const rule = KEYWORD_REPLIES.find(r => r.pattern.test(text));
    const pool = rule ? rule.lines : (PERSONALITY_REPLIES[user.personality ?? ''] ?? PERSONALITY_REPLIES['chill']);
    return this.pick(pool);
  }

  /** Bạn bè online trả lời tin nhắn 1-1 theo tính cách; thành viên nhóm góp chuyện. */
  private scheduleReply(session: ChatSession, text: string): void {
    if (session.isGroup) {
      this.scheduleBanter(session.id, text);
      return;
    }
    if (!session.peerId || !session.isOnline) return;
    const peerId = session.peerId;
    setTimeout(() => {
      const user = this.findUser(peerId);
      if (user && !this.isBlocked(peerId)) this.receiveMessage(peerId, this.replyFor(user, text));
    }, 900 + Math.random() * 1400);
  }

  /** 1-3 thành viên trong nhóm lần lượt trả lời cho cuộc trò chuyện thêm náo nhiệt. */
  private scheduleBanter(groupId: string, text = ''): void {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;
    const speakers = [...group.members].filter(m => !this.isBlocked(m.id)).sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
    speakers.forEach((member, i) => {
      setTimeout(() => {
        if (!this.groups.some(g => g.id === groupId) || this.isBlocked(member.id)) return;
        const line = text && Math.random() < 0.6 ? this.replyFor(member, text) : this.pick(GROUP_BANTER);
        this.receiveMessage(groupId, line, member);
      }, 1100 + i * 1600 + Math.random() * 700);
    });
  }

  /** Nhận một tin nhắn mới (từ bạn bè trong chat 1-1, hoặc từ thành viên khi truyền vào `from`). */
  private receiveMessage(sessionId: string, text: string, from?: DatabaseUser): void {
    const session = this.findSession(sessionId);
    if (!session) return;
    const sender = from ?? this.findUser(session.peerId ?? sessionId);
    if (!sender) return;
    session.messages.push({
      id: this.nextId('msg'), senderId: sender.id, sender: sender.username, avatar: sender.avatar,
      text, time: this.nowText(), isSelf: false
    });
    const isViewing = this.isFullChatOpenSubject.value && this.selectedSessionId === session.id;
    if (!isViewing) {
      session.unreadCount++;
      if (!this.isMuted(session)) {
        this.toast.success(`💬 ${session.isGroup ? `${sender.username} (${session.name})` : sender.username}: ${text}`);
      }
    }
    this.persist();
  }

  private nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${++this.idSeq}`;
  }

  private nowText(): string {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  /** Dữ liệu mẫu cho tài khoản demo: nhiều bạn bè, nhóm có sẵn, lời mời nhóm có người lạ. */
  private applySeed(): void {
    const self = this.selfInfo();
    this.friendsList = ['db5', 'db6', 'db7', 'db8', 'db9', 'db10'].map(directoryUser);
    this.pendingFriendRequests = ['db3', 'db4', 'db11'].map(directoryUser);
    this.starterInviteSent = true;

    // Trò chuyện 1-1 có sẵn
    Object.entries(FRIEND_SCRIPTS).forEach(([friendId, script]) => {
      const user = directoryUser(friendId);
      this.activeSessions.push({
        id: user.id, name: user.username, avatar: user.avatar, isGroup: false, peerId: user.id,
        isOnline: user.isOnline, unreadCount: friendId === 'db8' ? 2 : 0, mutedUntil: null,
        messages: buildHistory(script, self, `seed-${friendId}`)
      });
    });
    this.friendsList.filter(f => !this.findSession(f.id)).forEach(f => this.ensureDirectSession(f));

    // Nhóm đã tham gia: "Hội Anh Em Cày Game" (nhóm trưởng rong_con_96)
    const owner = directoryUser('db8');
    const ownGroup: GroupChat = {
      id: 'group-seed-cay-game', name: 'Hội Anh Em Cày Game', slogan: 'Cày game vui là chính', avatar: avatarOf('hoi-anh-em-cay-game'),
      ownerId: owner.id, ownerName: owner.username, joinRequests: [],
      members: ['db8', 'db5', 'db6', 'db7', 'db9', 'db10'].map(directoryUser)
    };
    this.groups = [ownGroup];
    this.activeSessions.push({
      id: ownGroup.id, name: ownGroup.name, avatar: ownGroup.avatar, isGroup: true, unreadCount: 3, mutedUntil: null,
      messages: buildHistory(OWN_GROUP_SCRIPT, self, 'seed-group')
    });

    // Lời mời nhóm: có nhiều người lạ để kết bạn
    const inv = (id: string, name: string, inviter: string, members: string[], script: typeof INVITE_BOSS_SCRIPT) => ({
      id, groupName: name, inviterId: inviter, inviterName: directoryUser(inviter).username, avatar: avatarOf(name),
      members: members.map(directoryUser), historyMessages: buildHistory(script, self, `seed-${id}`)
    });
    this.groupInvitations = [
      inv('inv-ctrlc', 'Hội Game Thủ Ctrl C', 'db1', ['db1', 'db3', 'db4', 'db12', 'db13'], INVITE_CTRLC_SCRIPT),
      inv('inv-boss', 'Team Săn Boss Đêm Khuya', 'db9', ['db9', 'db6', 'db14', 'db15'], INVITE_BOSS_SCRIPT)
    ];
  }

  private reload(): void {
    this.clearState();
    this.closeAll();
    if (!this.auth.isLoggedIn) return;

    const stored = loadJson<PersistedChat | null>(STORAGE_KEY, null);
    if (!stored) {
      if (this.auth.isDemoAccount) this.applySeed();
      return;
    }
    this.friendsList = stored.friends ?? [];
    this.pendingFriendRequests = stored.pending ?? [];
    this.sentFriendRequests = stored.sent ?? [];
    this.blockedUsers = stored.blocked ?? [];
    this.knownUsers = stored.knownUsers ?? [];
    this.blockCooldownMap = stored.blockCooldown ?? {};
    this.groupInvitations = stored.invites ?? [];
    this.groups = (stored.groups ?? []).map(g => ({ ...g, joinRequests: g.joinRequests ?? [] }));
    this.starterInviteSent = !!stored.starterInviteSent;
    this.activeSessions = stored.sessions ?? [];
    this.openTabs = (stored.openTabIds ?? [])
      .map(id => this.findSession(id))
      .filter((s): s is ChatSession => !!s);
    this.selectedSessionId = this.findSession(stored.selectedSessionId) ? stored.selectedSessionId : '';
    // Yêu cầu kết bạn đang chờ phản hồi từ lần trước: người dùng demo sẽ chấp nhận ngay.
    this.sentFriendRequests.forEach(r => setTimeout(() => this.completeSentRequest(r.id), this.acceptDelay(r)));
    this.groups.forEach(g => {
      this.scheduleProposal(g);
      g.joinRequests.filter(() => g.ownerId !== SELF_ID).forEach((req, i) => setTimeout(() => this.autoApprove(g.id, req.id), 2200 + i * 700));
    });
  }

  private persist(): void {
    // Không lưu dữ liệu tệp (base64) vào localStorage để tránh đầy dung lượng.
    const sessions = this.activeSessions.map(s => ({
      ...s,
      messages: s.messages.map(m => (m.attachment
        ? { ...m, attachment: undefined, text: m.text || '[Tệp đính kèm đã hết hạn sau khi tải lại trang]' }
        : m))
    }));
    const data: PersistedChat = {
      knownUsers: this.knownUsers,
      friends: this.friendsList,
      pending: this.pendingFriendRequests,
      sent: this.sentFriendRequests,
      blocked: this.blockedUsers,
      blockCooldown: this.blockCooldownMap,
      invites: this.groupInvitations,
      groups: this.groups,
      sessions,
      openTabIds: this.openTabs.map(s => s.id),
      selectedSessionId: this.selectedSessionId,
      starterInviteSent: this.starterInviteSent
    };
    saveJson(STORAGE_KEY, data);
  }
}
