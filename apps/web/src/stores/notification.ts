import { create } from 'zustand';
import api from '@/lib/api';

interface NotificationState {
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  isLoading: boolean;
  fetchUnreadCounts: () => Promise<void>;
  setUnreadNotificationsCount: (count: number) => void;
  setUnreadMessagesCount: (count: number) => void;
  decrementUnreadNotifications: () => void;
  clearUnreadNotifications: () => void;
  clearUnreadMessages: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadNotificationsCount: 0,
  unreadMessagesCount: 0,
  isLoading: false,

  fetchUnreadCounts: async () => {
    try {
      const [notifRes, msgRes] = await Promise.allSettled([
        api.get<{ success: boolean; count: number }>('/notifications/unread-count'),
        api.get<{ success: boolean; count: number }>('/messages/unread-count'),
      ]);

      const unreadNotifications =
        notifRes.status === 'fulfilled' && notifRes.value.data?.success
          ? Number(notifRes.value.data.count || 0)
          : 0;

      const unreadMessages =
        msgRes.status === 'fulfilled' && msgRes.value.data?.success
          ? Number(msgRes.value.data.count || 0)
          : 0;

      set({
        unreadNotificationsCount: unreadNotifications,
        unreadMessagesCount: unreadMessages,
      });
    } catch (error) {
      console.warn('Failed to fetch unread counters:', error);
    }
  },

  setUnreadNotificationsCount: (count: number) =>
    set({ unreadNotificationsCount: Math.max(0, count) }),

  setUnreadMessagesCount: (count: number) =>
    set({ unreadMessagesCount: Math.max(0, count) }),

  decrementUnreadNotifications: () =>
    set((state) => ({
      unreadNotificationsCount: Math.max(0, state.unreadNotificationsCount - 1),
    })),

  clearUnreadNotifications: () => set({ unreadNotificationsCount: 0 }),

  clearUnreadMessages: () => set({ unreadMessagesCount: 0 }),
}));
