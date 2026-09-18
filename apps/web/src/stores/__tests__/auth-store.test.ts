import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('@/lib/auth-cookie', () => ({
  persistServerSession: vi.fn().mockResolvedValue(true),
  clearServerSession: vi.fn().mockResolvedValue(undefined),
}));

import api from '@/lib/api';
import { persistServerSession, clearServerSession } from '@/lib/auth-cookie';
import { useAuthStore } from '@/stores/auth';

const mockedPost = vi.mocked(api.post);

describe('Auth Store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('should initialize as unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set tokens via setTokens', () => {
    useAuthStore.getState().setTokens('access-token', 'refresh-token');

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('access-token');
    expect(state.refreshToken).toBe('refresh-token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should set user on login', async () => {
    const user = { id: '1', email: 'test@payroll.com', role: 'employee' as const };
    mockedPost.mockResolvedValue({
      data: {
        data: { user, accessToken: 'jwt-token', refreshToken: 'refresh-token' },
      },
    });

    await useAuthStore.getState().login('test@payroll.com', 'password123');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('jwt-token');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(persistServerSession).toHaveBeenCalledWith('jwt-token', 'refresh-token', 'employee');
  });

  it('should surface error and clear loading when login fails', async () => {
    mockedPost.mockRejectedValue({
      response: { data: { error: 'Invalid credentials' } },
    });

    await expect(useAuthStore.getState().login('test@payroll.com', 'wrongpass1')).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.error).toBe('Invalid credentials');
    expect(state.isLoading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
  });

  it('should clear user on logout', async () => {
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'test@payroll.com',
        role: 'employee',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      accessToken: 'jwt-token',
      refreshToken: 'refresh-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(clearServerSession).toHaveBeenCalled();
    expect(mockedPost).toHaveBeenCalledWith('/auth/logout', {
      refreshToken: 'refresh-token',
    });
  });
});