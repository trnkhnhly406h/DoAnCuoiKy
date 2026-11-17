import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth';
import {
  ChatService, DatabaseUser, GroupChat, GroupInvite, JoinRequest, MAX_GROUP_MEMBERS, MAX_GROUP_NAME_LENGTH, Relation
} from '../services/chat';
import { ConfirmService } from '../services/confirm';
import { normalizeText } from '../services/storage';
import { ToastService } from '../services/toast';
import { UserProfileService } from '../services/user-profile';

import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

export type ChatTab = 'ban-be' | 'them-ban' | 'loi-moi' | 'da-chan' | 'nhom-cua-ban' | 'loi-moi-nhom';
type GroupSettingsTab = 'tong-quat' | 'thanh-vien';

const VALID_TABS: ChatTab[] = ['ban-be', 'them-ban', 'loi-moi', 'da-chan', 'nhom-cua-ban', 'loi-moi-nhom'];
const MAX_FRIENDS = 300;
const MAX_GROUP_AVATAR_BYTES = 500 * 1024;
const MIN_SEARCH_LENGTH = 2;

@Component({
  selector: 'app-tro-chuyen',
  templateUrl: './tro-chuyen.html',
  styleUrls: ['./tro-chuyen.css'],
  standalone: false
})
export class TroChuyenComponent implements OnInit, OnDestroy {
  readonly maxFriends = MAX_FRIENDS;
  readonly maxGroupNameLength = MAX_GROUP_NAME_LENGTH;
  readonly minSearchLength = MIN_SEARCH_LENGTH;

  /** Tab đang mở. Nguồn sự thật duy nhất là query param `?tab=`, nên luôn khớp với URL. */
  activeTab: ChatTab = 'ban-be';

  filterFriendsQuery = '';
  searchByCodeQuery = '';
  searchByNameQuery = '';
  activeGearFriendId: string | null = null;

  // Tạo nhóm
  showCreateGroupModal = false;
  newGroupNameInput = '';
  selectedFriendsForGroup: DatabaseUser[] = [];

  // Thiết lập nhóm
  showGroupSettingsModal = false;
  activeGroupSettingsTab: GroupSettingsTab = 'tong-quat';
  managingGroupId = '';
  groupDraft = { name: '', slogan: '', avatar: '' };
  readonly maxGroupMembers = MAX_GROUP_MEMBERS;

  // Thêm người vào nhóm
  showAddMembers = false;
  addMemberQuery = '';
  addMemberSelection: DatabaseUser[] = [];

  private sub?: Subscription;

  constructor(
    public chatService: ChatService,
    public authService: AuthService,
    public profileService: UserProfileService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as ChatTab | null;
      this.activeTab = tab && VALID_TABS.includes(tab) ? tab : 'ban-be';
      this.closeGearMenu();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showGroupSettingsModal) this.closeGroupSettings();
    else if (this.showCreateGroupModal) this.closeCreateGroupModal();
    this.closeGearMenu();
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  get userAccountCode(): string {
    return this.profileService.accountCode;
  }

  /* ---------- Điều hướng tab ---------- */

  setTab(tab: ChatTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab }, queryParamsHandling: 'merge' });
  }

  /* ---------- Dữ liệu hiển thị ---------- */

  private get filteredFriends(): DatabaseUser[] {
    const q = normalizeText(this.filterFriendsQuery);
    if (!q) return this.chatService.friendsList;
    return this.chatService.friendsList.filter(f =>
      [f.username, f.handle, f.accountCode].some(v => normalizeText(v).includes(q))
    );
  }

  get onlineFriends(): DatabaseUser[] {
    return this.filteredFriends.filter(f => f.isOnline);
  }

  get offlineFriends(): DatabaseUser[] {
    return this.filteredFriends.filter(f => !f.isOnline);
  }

  get filteredByCodeResults(): DatabaseUser[] {
    const q = normalizeText(this.searchByCodeQuery).replace(/\s+/g, '');
    if (q.length < 3) return [];
    return this.chatService.databaseUsers.filter(u => normalizeText(u.accountCode).includes(q));
  }

  get filteredByNameResults(): DatabaseUser[] {
    const q = normalizeText(this.searchByNameQuery);
    if (q.length < MIN_SEARCH_LENGTH) return [];
    return this.chatService.databaseUsers.filter(u => normalizeText(u.username).includes(q) || normalizeText(u.handle).includes(q));
  }

  /* ---------- Quan hệ với người khác (nhãn nút) ---------- */

  relationOf(userId: string): Relation {
    return this.chatService.relationOf(userId);
  }

  relationLabel(userId: string): string {
    switch (this.relationOf(userId)) {
      case 'friend': return '✓ Bạn bè';
      case 'sent': return 'Đã gửi lời mời';
      case 'blocked': return 'Đã chặn';
      case 'incoming': return 'Chấp nhận lời mời';
      case 'self': return 'Bạn';
      default: return 'Thêm bạn';
    }
  }

  isRelationActionDisabled(userId: string): boolean {
    return ['friend', 'sent', 'blocked', 'self'].includes(this.relationOf(userId));
  }

  /* ---------- Bạn bè ---------- */

  toggleGearMenu(friendId: string, event: Event): void {
    event.stopPropagation();
    this.activeGearFriendId = this.activeGearFriendId === friendId ? null : friendId;
  }

  closeGearMenu(): void {
    this.activeGearFriendId = null;
  }

  startChat(friend: DatabaseUser): void {
    this.closeGearMenu();
    this.chatService.openDirectChat(friend);
  }

  
unfriend(friend: DatabaseUser): void {
  const ok = window.confirm(
    `Bạn có chắc chắn muốn hủy kết bạn với ${friend.username}?`
  );

  if (!ok) return;

  this.chatService.unfriend(friend.id);

  this.activeGearFriendId = null;

  this.toast.success(
    `Đã hủy kết bạn với ${friend.username}.`
  );

  this.cdr.detectChanges();
}

blockFriend(user: DatabaseUser): void {
  const ok = window.confirm(
    `Bạn có chắc chắn muốn chặn ${user.username}? ` +
    'Người này sẽ bị xóa khỏi danh sách bạn bè.'
  );

  if (!ok) return;

  const result = this.chatService.blockUser(user);

  if (!result.ok) {
    this.toast.warning(result.message);
    return;
  }

  this.activeGearFriendId = null;

  this.toast.success(result.message);

  this.cdr.detectChanges();
}


  unblockUser(user: DatabaseUser): void {
    const result = this.chatService.unblockUser(user.id);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
  }

  async copyAccountCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.userAccountCode);
      this.toast.success(`Đã sao chép mã tài khoản ${this.userAccountCode}!`);
    } catch {
      this.toast.warning('Trình duyệt không cho phép sao chép tự động. Hãy chọn mã và nhấn Ctrl+C.');
    }
  }

  /* ---------- Lời mời kết bạn ---------- */

  onAddFriend(user: DatabaseUser): void {
    const result = this.chatService.sendFriendRequest(user);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
  }

  acceptFriendRequest(user: DatabaseUser): void {
    this.chatService.acceptFriendRequest(user);
    this.toast.success(`Hai bạn và ${user.username} đã trở thành bạn bè!`);
  }

  declineFriendRequest(user: DatabaseUser): void {
    this.chatService.declineFriendRequest(user.id);
    this.toast.warning(`Đã từ chối lời mời kết bạn từ ${user.username}.`);
  }

  cancelSentRequest(user: DatabaseUser): void {
    this.chatService.cancelSentRequest(user.id);
    this.toast.warning(`Đã hủy lời mời kết bạn gửi tới ${user.username}.`);
  }

  /* ---------- Lời mời nhóm ---------- */

  acceptGroupInvite(invite: GroupInvite): void {
    const group = this.chatService.acceptGroupInvite(invite.id);
    if (group) this.toast.success(`🎉 Bạn đã gia nhập nhóm "${group.name}". Cửa sổ chat nhóm đã mở.`);
  }

  declineGroupInvite(inviteId: string): void {
    this.chatService.declineGroupInvite(inviteId);
    this.toast.warning('Đã từ chối lời mời tham gia nhóm.');
  }

  /* ---------- Tạo nhóm ---------- */

  openCreateGroupModal(): void {
    this.showCreateGroupModal = true;
    this.newGroupNameInput = '';
    this.selectedFriendsForGroup = [];
  }

  closeCreateGroupModal(): void {
    this.showCreateGroupModal = false;
  }

  isFriendSelectedForGroup(friend: DatabaseUser): boolean {
    return this.selectedFriendsForGroup.some(f => f.id === friend.id);
  }

  toggleSelectFriendForGroup(friend: DatabaseUser): void {
    this.selectedFriendsForGroup = this.isFriendSelectedForGroup(friend)
      ? this.selectedFriendsForGroup.filter(f => f.id !== friend.id)
      : [...this.selectedFriendsForGroup, friend];
  }

  removeSelectedFriendTag(friend: DatabaseUser): void {
    this.selectedFriendsForGroup = this.selectedFriendsForGroup.filter(f => f.id !== friend.id);
  }

  submitCreateGroup(): void {
    const result = this.chatService.createGroup(this.newGroupNameInput, this.selectedFriendsForGroup);
    if (!result.ok || !result.group) {
      this.toast.warning(result.message);
      return;
    }
    this.closeCreateGroupModal();
    this.toast.success(result.message);
    this.setTab('nhom-cua-ban');
    this.chatService.openFullChat(result.group.id);
  }

  /* ---------- Thiết lập nhóm ---------- */

  get currentManagingGroup(): GroupChat | undefined {
    return this.chatService.groups.find(g => g.id === this.managingGroupId);
  }

  get isManagingGroupOwner(): boolean {
    const group = this.currentManagingGroup;
    return !!group && this.chatService.isGroupOwner(group);
  }

  openGroupSettings(group: GroupChat): void {
    this.managingGroupId = group.id;
    this.groupDraft = { name: group.name, slogan: group.slogan, avatar: group.avatar };
    this.activeGroupSettingsTab = 'tong-quat';
    this.resetAddMembers();
    this.showGroupSettingsModal = true;
  }

  closeGroupSettings(): void {
    this.showGroupSettingsModal = false;
    this.resetAddMembers();
  }

  private resetAddMembers(): void {
    this.showAddMembers = false;
    this.addMemberQuery = '';
    this.addMemberSelection = [];
  }

  /* ---------- Thành viên nhóm: thêm / duyệt / mời ra / bổ nhiệm ---------- */

  /** Bạn bè có thể thêm: chưa trong nhóm, chưa chờ duyệt, không bị chặn. */
  get addableFriends(): DatabaseUser[] {
    const group = this.currentManagingGroup;
    if (!group) return [];
    const q = normalizeText(this.addMemberQuery);
    return this.chatService.friendsList.filter(f =>
      !group.members.some(m => m.id === f.id) &&
      !group.joinRequests.some(r => r.user.id === f.id) &&
      !this.chatService.isBlocked(f.id) &&
      (!q || normalizeText(f.username).includes(q) || normalizeText(f.handle).includes(q))
    );
  }

  get isGroupFull(): boolean {
    const group = this.currentManagingGroup;
    return !!group && this.chatService.groupMemberCount(group) >= MAX_GROUP_MEMBERS;
  }

  toggleAddMembers(): void {
    this.showAddMembers = !this.showAddMembers;
    this.addMemberQuery = '';
    this.addMemberSelection = [];
  }

  isAddSelected(friend: DatabaseUser): boolean {
    return this.addMemberSelection.some(f => f.id === friend.id);
  }

  toggleAddSelected(friend: DatabaseUser): void {
    this.addMemberSelection = this.isAddSelected(friend)
      ? this.addMemberSelection.filter(f => f.id !== friend.id)
      : [...this.addMemberSelection, friend];
  }

  submitAddMembers(): void {
    if (this.addMemberSelection.length === 0) {
      this.toast.warning('Hãy chọn ít nhất một người bạn để thêm.');
      return;
    }
    const result = this.chatService.addMembersToGroup(this.managingGroupId, this.addMemberSelection);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
    if (result.ok) this.resetAddMembers();
  }

  approveRequest(req: JoinRequest): void {
    const result = this.chatService.approveJoinRequest(this.managingGroupId, req.id);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
  }

  declineRequest(req: JoinRequest): void {
    const result = this.chatService.declineJoinRequest(this.managingGroupId, req.id);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
  }

  async kickMember(member: DatabaseUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Mời ${member.username} ra khỏi nhóm?`,
      message: 'Người này sẽ không còn thấy cuộc trò chuyện của nhóm. Mọi thành viên sẽ nhận được thông báo hệ thống.',
      confirmText: 'Mời ra khỏi nhóm',
      danger: true
    });
    if (!ok) return;
    const result = this.chatService.kickMember(this.managingGroupId, member.id);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
  }

  async makeOwner(member: DatabaseUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Bổ nhiệm ${member.username} làm nhóm trưởng?`,
      message: 'Bạn sẽ trở thành thành viên thường và không thể tự lấy lại quyền trưởng nhóm.',
      confirmText: 'Bổ nhiệm'
    });
    if (!ok) return;
    const result = this.chatService.transferOwnership(this.managingGroupId, member.id);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
    if (result.ok) this.resetAddMembers();
  }

  pendingCount(group: GroupChat): number {
    return group.joinRequests.length;
  }

  onGroupAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.warning('Vui lòng chọn một tệp hình ảnh.');
      return;
    }
    if (file.size > MAX_GROUP_AVATAR_BYTES) {
      this.toast.warning('Ảnh nhóm quá lớn. Vui lòng chọn ảnh nhỏ hơn 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => this.toast.warning('Không đọc được tệp ảnh.');
    reader.onload = () => {
      if (typeof reader.result === 'string') this.groupDraft.avatar = reader.result;
    };
    reader.readAsDataURL(file);
  }

  saveGroupSettings(): void {
    const result = this.chatService.updateGroup(this.managingGroupId, this.groupDraft);
    this.toast.show(result.message, result.ok ? 'success' : 'warning');
    if (result.ok) this.closeGroupSettings();
  }

  async askLeaveGroup(): Promise<void> {
    const group = this.currentManagingGroup;
    if (!group) return;
    // Nhóm trưởng còn thành viên khác: phải bổ nhiệm người kế nhiệm trước.
    if (this.chatService.isGroupOwner(group) && group.members.length > 0) {
      this.activeGroupSettingsTab = 'thanh-vien';
      this.toast.warning('Bạn đang là nhóm trưởng. Hãy bấm "Bổ nhiệm" cho một thành viên trước khi rời nhóm.');
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Xác nhận rời nhóm',
      message: group.members.length === 0
        ? `Bạn là thành viên cuối cùng, nhóm "${group.name}" sẽ bị xóa khi bạn rời đi.`
        : `Bạn có chắc chắn muốn rời khỏi nhóm "${group.name}" không?`,
      confirmText: 'Xác nhận rời nhóm',
      danger: true
    });
    if (!ok) return;
    const result = this.chatService.leaveGroup(group.id);
    if (!result.ok) {
      this.toast.warning(result.message);
      return;
    }
    this.closeGroupSettings();
    this.toast.warning(result.message);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
