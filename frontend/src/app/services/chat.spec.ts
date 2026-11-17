import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth';
import { ChatService, DatabaseUser } from './chat';

describe('ChatService', () => {
  let chat: ChatService;
  let auth: AuthService;

  const user = (id: string): DatabaseUser => {
    const u = chat.databaseUsers.find(x => x.id === id);
    if (!u) throw new Error('missing ' + id);
    return u;
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    auth = TestBed.inject(AuthService);
    chat = TestBed.inject(ChatService);
    auth.login('khach_vip01', 'password123');
    chat.reset();
  });

  it('keeps friends per account (demo gets sample data, new accounts start empty)', () => {
    auth.logout();
    auth.login('5 con nhái', 'Steal@123');
    expect(chat.friendsList.length).toBeGreaterThan(0);
    auth.logout();
    auth.saveRegisterStep1('chat@example.com', 'Việt Nam');
    auth.finishRegister('Nguoi Chat', 'Abcdef1!', 'Abcdef1!');
    expect(chat.friendsList.length).toBe(0);
  });

  it('reports relations consistently', () => {
    expect(chat.relationOf('db2')).toBe('none');
    chat.sendFriendRequest(user('db2'));
    expect(chat.relationOf('db2')).toBe('sent');
    chat.acceptFriendRequest(user('db3'));
    expect(chat.relationOf('db3')).toBe('friend');
  });

  it('does not allow duplicate requests', () => {
    chat.sendFriendRequest(user('db2'));
    expect(chat.sendFriendRequest(user('db2')).ok).toBeFalse();
  });

  it('blocking removes the friend and its session, and applies a re-block cooldown', () => {
    chat.acceptFriendRequest(user('db3'));
    expect(chat.blockUser(user('db3')).ok).toBeTrue();
    expect(chat.relationOf('db3')).toBe('blocked');
    expect(chat.friendsList.length).toBe(0);
    expect(chat.findSession('db3')).toBeUndefined();
    chat.unblockUser('db3');
    expect(chat.blockUser(user('db3')).ok).toBeFalse();
  });

  it('refuses to send messages to blocked users and caps message length', () => {
    chat.acceptFriendRequest(user('db3'));
    expect(chat.sendMessage('db3', 'hi').ok).toBeTrue();
    expect(chat.sendMessage('db3', 'x'.repeat(5000)).ok).toBeFalse();
    chat.blockUser(user('db3'));
    expect(chat.sendMessage('db3', 'hi').ok).toBeFalse();
  });

  it('groups: unique names, owner-only edits, ownership handover on leave', () => {
    const a = chat.createGroup('Nhóm A', [user('db2')]).group;
    const b = chat.createGroup('Nhóm B', []).group;
    if (!a || !b) throw new Error('no groups');
    expect(chat.updateGroup(a.id, { name: 'Nhóm B', slogan: '', avatar: '' }).ok).toBeFalse();
    expect(chat.updateGroup(a.id, { name: 'Nhóm A2', slogan: 'hi', avatar: '' }).ok).toBeTrue();
    expect(chat.leaveGroup(a.id).ok).toBeFalse(); // nhóm trưởng phải bổ nhiệm người kế nhiệm trước
    expect(chat.transferOwnership(a.id, 'db2').ok).toBeTrue();
    expect(chat.leaveGroup(a.id).ok).toBeTrue();
    expect(chat.groups.some(g => g.id === a.id)).toBeFalse();
    expect(chat.findSession(a.id)).toBeUndefined();
  });

  it('mutes a session with an expiry', () => {
    chat.acceptFriendRequest(user('db3'));
    const session = chat.findSession('db3');
    if (!session) throw new Error('no session');
    chat.muteSession('db3', '15m');
    expect(chat.isMuted(session)).toBeTrue();
    session.mutedUntil = Date.now() - 1000;
    expect(chat.isMuted(session)).toBeFalse();
  });
});
