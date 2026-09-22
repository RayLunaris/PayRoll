'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import {
  MessageCircle,
  Send,
  Search,
  User,
  MessageSquarePlus,
  CheckCheck,
  Smile,
  X,
  Lock,
  ArrowLeft,
  Users,
} from 'lucide-react';

interface Conversation {
  partnerId: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  partnerEmail: string | null;
  partnerName: string | null;
  partnerRole: string | null;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface Contact {
  userId: string;
  name: string;
  email: string;
  role: string;
  nip: string | null;
  department: string | null;
  position: string | null;
  avatarUrl: string | null;
}

const AVATAR_BG_COLORS = [
  'bg-emerald-600 text-white',
  'bg-blue-600 text-white',
  'bg-indigo-600 text-white',
  'bg-purple-600 text-white',
  'bg-amber-600 text-white',
  'bg-rose-600 text-white',
  'bg-teal-600 text-white',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_BG_COLORS[Math.abs(hash) % AVATAR_BG_COLORS.length];
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMessageTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatConversationTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Kemarin';
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

const QUICK_EMOJIS = ['👍', '😊', '🙏', '❤️', '👋', '💼', '🚀', '👌'];

export default function MessagesPage() {
  const user = useAuthStore((state) => state.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get<{ data: Conversation[] }>('/messages');
      setConversations(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await api.get<{ data: Contact[] }>('/messages/contacts');
      setContacts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  }, []);

  const fetchMessages = useCallback(async (userId: string) => {
    try {
      const response = await api.get<{ data: Message[] }>(`/messages/${userId}`);
      setMessages(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.all([fetchConversations(), fetchContacts()]);
    })();
  }, [fetchConversations, fetchContacts]);

  useEffect(() => {
    if (activeUser) {
      void (async () => {
        await fetchMessages(activeUser);
      })();
    }
  }, [activeUser, fetchMessages]);

  // Real-time polling every 3 seconds
  useEffect(() => {
    if (!activeUser) return;
    const interval = setInterval(() => {
      void fetchMessages(activeUser);
      void fetchConversations();
    }, 3000);
    return () => clearInterval(interval);
  }, [activeUser, fetchMessages, fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectUserToChat = (targetUserId: string, contactData?: Contact) => {
    setActiveUser(targetUserId);
    if (contactData) {
      setActiveContact(contactData);
    } else {
      const found = contacts.find((c) => c.userId === targetUserId);
      if (found) setActiveContact(found);
    }
    setShowNewChatModal(false);
    setSearchQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeUser) return;

    const messageText = input.trim();
    setInput('');
    setShowEmojiPicker(false);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user?.id || '',
      receiverId: activeUser,
      content: messageText,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const response = await api.post<{ data: Message }>('/messages', {
        receiverId: activeUser,
        content: messageText,
      });

      // Replace optimistic message with actual data
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? response.data.data : msg)),
      );
      void fetchConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message if failed
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    }
  };

  const activeConversation = conversations.find(
    (conv) => conv.partnerId === activeUser,
  );
  const activeContactInfo =
    contacts.find((c) => c.userId === activeUser) || activeContact;

  const partnerName =
    activeConversation?.partnerName ||
    activeContactInfo?.name ||
    activeConversation?.partnerEmail ||
    activeContactInfo?.email ||
    'Rekan Kerja';

  const partnerSubtitle =
    activeContactInfo?.department && activeContactInfo?.position
      ? `${activeContactInfo.department} • ${activeContactInfo.position}`
      : activeContactInfo?.department ||
        activeContactInfo?.position ||
        (activeConversation?.partnerRole
          ? `Role: ${activeConversation.partnerRole}`
          : 'Karyawan');

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (conv.partnerName && conv.partnerName.toLowerCase().includes(q)) ||
      (conv.partnerEmail && conv.partnerEmail.toLowerCase().includes(q)) ||
      (conv.lastMessage && conv.lastMessage.toLowerCase().includes(q))
    );
  });

  // Filter contacts not already in conversation list matching search
  const existingPartnerIds = new Set(conversations.map((c) => c.partnerId));
  const searchMatchedContacts = searchQuery.trim()
    ? contacts.filter(
        (c) =>
          !existingPartnerIds.has(c.userId) &&
          (c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.department &&
              c.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (c.nip && c.nip.toLowerCase().includes(searchQuery.toLowerCase()))),
      )
    : [];

  const modalFilteredContacts = contacts.filter((c) => {
    if (!contactSearchQuery.trim()) return true;
    const q = contactSearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.department && c.department.toLowerCase().includes(q)) ||
      (c.nip && c.nip.toLowerCase().includes(q)) ||
      (c.position && c.position.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      <Breadcrumb />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <MessageCircle className="h-6 w-6 text-emerald-600" />
            Pesan Antar Karyawan
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Komunikasi langsung real-time antar rekan kerja
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewChatModal(true)}
          className="btn btn-primary !py-2 !px-4 flex items-center gap-2 shadow-sm rounded-lg"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>Chat Baru</span>
        </button>
      </div>

      {/* Main WhatsApp-like Layout Container */}
      <div className="card h-[640px] flex overflow-hidden p-0 border border-gray-200 shadow-sm rounded-xl">
        {/* ================= SIDEBAR (Conversation List) ================= */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-gray-200 flex flex-col bg-white ${
            activeUser ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Sidebar Top Profile Header */}
          <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${getAvatarColor(
                  user?.id || 'me',
                )}`}
              >
                {getInitials(user?.email?.split('@')[0])}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.email?.split('@')[0]}
                </p>
                <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Online
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewChatModal(true)}
              title="Mulai Chat Baru"
              className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-gray-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari percakapan atau kontak..."
                className="w-full bg-gray-100 pl-9 pr-8 py-2 text-sm rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Conversations & Matched Contacts List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {/* 1. Existing Conversations */}
            {filteredConversations.map((conv) => {
              const isSelected = activeUser === conv.partnerId;
              const name =
                conv.partnerName || conv.partnerEmail?.split('@')[0] || 'Karyawan';
              return (
                <button
                  key={conv.partnerId}
                  type="button"
                  onClick={() => selectUserToChat(conv.partnerId)}
                  className={`w-full flex items-center gap-3 p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/80 border-l-4 border-emerald-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`h-11 w-11 rounded-full flex items-center justify-center font-semibold text-sm shadow-sm ${getAvatarColor(
                        conv.partnerId,
                      )}`}
                    >
                      {getInitials(name)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isSelected ? 'text-emerald-950' : 'text-gray-900'
                        }`}
                      >
                        {name}
                      </p>
                      <span className="text-[11px] text-gray-400 flex-shrink-0 ml-1">
                        {formatConversationTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 truncate max-w-[190px]">
                        {conv.lastMessage || 'Memulai percakapan...'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* 2. Search Matched Contacts (if not in conversation list) */}
            {searchMatchedContacts.length > 0 && (
              <div className="bg-gray-50/70 p-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase px-2 py-1 tracking-wider">
                  Kontak Rekan Kerja
                </p>
                {searchMatchedContacts.map((contact) => (
                  <button
                    key={contact.userId}
                    type="button"
                    onClick={() => selectUserToChat(contact.userId, contact)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-white transition-colors"
                  >
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs ${getAvatarColor(
                        contact.userId,
                      )}`}
                    >
                      {getInitials(contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {contact.name}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {contact.department || contact.email}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Mulai Chat
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty State when no conversations and not searching */}
            {conversations.length === 0 && !loading && !searchQuery && (
              <div className="p-6 text-center flex flex-col items-center justify-center h-full my-auto">
                <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-inner">
                  <MessageSquarePlus className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 mb-1">
                  Belum Ada Percakapan
                </h4>
                <p className="text-xs text-gray-500 mb-4 max-w-[200px] leading-relaxed">
                  Mulai berkirim pesan langsung secara pribadi dengan rekan kerja Anda.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="btn btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5 shadow-sm rounded-lg"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Pilih Rekan Kerja
                </button>
              </div>
            )}

            {/* Empty Search Result */}
            {searchQuery &&
              filteredConversations.length === 0 &&
              searchMatchedContacts.length === 0 && (
                <div className="p-8 text-center text-xs text-gray-500">
                  Tidak ditemukan percakapan atau kontak dengan kata kunci &ldquo;
                  {searchQuery}&rdquo;
                </div>
              )}
          </div>
        </div>

        {/* ================= CHAT AREA (Right Panel) ================= */}
        <div
          className={`flex-1 flex flex-col bg-[#f0f2f5] ${
            activeUser ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeUser ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between z-10 shadow-xs">
                <div className="flex items-center gap-3">
                  {/* Back button on mobile */}
                  <button
                    type="button"
                    onClick={() => setActiveUser(null)}
                    className="md:hidden p-1.5 text-gray-600 hover:text-gray-900 rounded-lg"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="relative">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${getAvatarColor(
                        activeUser,
                      )}`}
                    >
                      {getInitials(partnerName)}
                    </div>
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">
                      {partnerName}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs text-gray-500 truncate max-w-[240px]">
                        {partnerSubtitle}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {activeContactInfo?.nip && (
                    <span className="hidden sm:inline-block bg-white px-2.5 py-1 rounded-md border border-gray-200 font-mono text-[11px]">
                      NIP: {activeContactInfo.nip}
                    </span>
                  )}
                </div>
              </div>

              {/* Messages Body (WhatsApp Wallpaper Tint) */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{
                  backgroundColor: '#efeae2',
                  backgroundImage:
                    'radial-gradient(#d1c7b7 0.75px, transparent 0.75px)',
                  backgroundSize: '16px 16px',
                }}
              >
                {/* Security Announcement Pill */}
                <div className="flex justify-center my-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 bg-amber-50/90 border border-amber-200/80 px-3 py-1 rounded-full shadow-xs">
                    <Lock className="h-3 w-3 text-amber-600" />
                    Pesan antar pengguna terenkripsi & khusus komunikasi internal perusahaan.
                  </span>
                </div>

                {messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-xs text-sm relative break-words ${
                          isMine
                            ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-xs'
                            : 'bg-white text-gray-900 rounded-tl-xs border border-gray-100'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5 text-[10px] text-gray-500 select-none">
                          <span>{formatMessageTime(msg.createdAt)}</span>
                          {isMine && (
                            <CheckCheck
                              className={`h-3.5 w-3.5 ${
                                msg.isRead ? 'text-blue-500' : 'text-gray-400'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {messages.length === 0 && (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                    <div className="h-10 w-10 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-xs mb-2">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-semibold text-gray-700">
                      Mulai percakapan dengan {partnerName}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Kirim pesan pertama Anda di bawah ini
                    </p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Emojis Bar (if toggled) */}
              {showEmojiPicker && (
                <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400 mr-1">Reaksi:</span>
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setInput((prev) => prev + emoji)}
                      className="text-lg hover:scale-125 transition-transform p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* WhatsApp-like Bottom Input Bar */}
              <form
                onSubmit={sendMessage}
                className="p-3 bg-gray-100 border-t border-gray-200 flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  title="Sisipkan emoji"
                  className={`p-2 rounded-full transition-colors ${
                    showEmojiPicker
                      ? 'text-emerald-600 bg-emerald-100'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Smile className="h-5 w-5" />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm text-gray-900 border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-xs"
                />

                <button
                  type="submit"
                  disabled={!input.trim()}
                  title="Kirim pesan"
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                    input.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white scale-100'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send className="h-4 w-4 ml-0.5" />
                </button>
              </form>
            </>
          ) : (
            /* WhatsApp Web Style Welcome / Empty Screen */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50">
              <div className="h-20 w-20 rounded-full bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-5 shadow-sm">
                <MessageCircle className="h-10 w-10" />
              </div>

              <h2 className="text-xl font-bold text-gray-900 mb-2">
                PayrollPro Chat Antar Karyawan
              </h2>
              <p className="text-sm text-gray-500 max-w-md leading-relaxed mb-6">
                Kirim dan terima pesan langsung dengan rekan kerja Anda secara
                real-time, aman, dan terisolasi internal perusahaan seperti di WhatsApp.
              </p>

              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="btn btn-primary !py-2.5 !px-5 flex items-center gap-2 shadow-md rounded-full text-sm font-medium"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span>Mulai Chat Baru</span>
              </button>

              <div className="mt-16 flex items-center gap-1.5 text-xs text-gray-400">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                <span>Pesan terenkripsi end-to-end khusus lingkungan PayrollPro</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODAL: CHAT BARU (PILIH KONTAK) ================= */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <h3 className="font-semibold text-base">Pilih Rekan Kerja</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1 hover:bg-emerald-700 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Search */}
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={contactSearchQuery}
                  onChange={(e) => setContactSearchQuery(e.target.value)}
                  placeholder="Cari nama, NIP, atau divisi..."
                  className="w-full bg-white pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Contacts Directory List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
              {modalFilteredContacts.length > 0 ? (
                modalFilteredContacts.map((contact) => (
                  <button
                    key={contact.userId}
                    type="button"
                    onClick={() => selectUserToChat(contact.userId, contact)}
                    className="w-full flex items-center gap-3 p-3 text-left rounded-xl hover:bg-emerald-50/70 transition-colors group"
                  >
                    <div
                      className={`h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shadow-xs ${getAvatarColor(
                        contact.userId,
                      )}`}
                    >
                      {getInitials(contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-emerald-900 truncate">
                          {contact.name}
                        </p>
                        {contact.nip && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {contact.nip}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {contact.department || 'Umum'}{' '}
                        {contact.position ? `• ${contact.position}` : ''}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-gray-500">
                  {contacts.length === 0
                    ? 'Sedang memuat kontak rekan kerja...'
                    : 'Tidak ada rekan kerja yang cocok dengan pencarian.'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-500">
                Menampilkan {modalFilteredContacts.length} rekan kerja
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}