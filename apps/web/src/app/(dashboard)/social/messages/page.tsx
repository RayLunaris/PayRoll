'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { MessageCircle, Send, Search, User } from 'lucide-react';

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

export default function MessagesPage() {
  const user = useAuthStore((state) => state.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      await fetchConversations();
    })();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeUser) {
      void (async () => {
        await fetchMessages(activeUser);
      })();
    }
  }, [activeUser, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeUser) return;

    try {
      const response = await api.post<{ data: Message }>('/messages', {
        receiverId: activeUser,
        content: input.trim(),
      });

      setMessages((prev) => [...prev, response.data.data]);
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const activeConversation = conversations.find(
    (conv) => conv.partnerId === activeUser,
  );

  return (
    <div>
      <Breadcrumb />

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <MessageCircle className="h-6 w-6 text-blue-600" />
          Pesan
        </h1>
      </div>

      <div className="card h-[600px] flex overflow-hidden p-0">
        {/* Conversation list */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari percakapan..."
                className="input pl-9 !py-1.5 !text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.partnerId}
                type="button"
                onClick={() => setActiveUser(conv.partnerId)}
                className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors ${
                  activeUser === conv.partnerId ? 'bg-blue-50' : ''
                }`}
              >
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {conv.partnerName || conv.partnerEmail || 'Karyawan'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            ))}

            {conversations.length === 0 && !loading && (
              <div className="p-6 text-center text-sm text-gray-500">
                Belum ada percakapan
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Chat header */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {activeConversation?.partnerName ||
                  activeConversation?.partnerEmail ||
                  'Pilih percakapan'}
              </p>
              <p className="text-xs text-emerald-600">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeUser ? (
              messages.map((msg) => {
                const isMine = msg.senderId === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          isMine ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                Pilih percakapan untuk mulai chat
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {activeUser && (
            <form
              onSubmit={sendMessage}
              className="p-4 border-t border-gray-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tulis pesan..."
                className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="btn btn-primary !rounded-full !py-2"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}