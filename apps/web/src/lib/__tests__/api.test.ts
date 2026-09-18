import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  mockGet,
  mockPost,
  mockPut,
  mockDelete,
  hooks,
} = vi.hoisted(() => {
  const hooks: { onRequest?: (config: Record<string, unknown>) => unknown; onResponse?: unknown } = {};
  return {
    mockGet: vi.fn(),
    mockPost: vi.fn(),
    mockPut: vi.fn(),
    mockDelete: vi.fn(),
    hooks,
  };
});

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: (fn: typeof hooks.onRequest) => (hooks.onRequest = fn) },
        response: { use: (fn: unknown) => (hooks.onResponse = fn) },
      },
    }),
  },
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: () => ({
      accessToken: 'stored-token',
      refreshToken: 'stored-refresh',
      logout: vi.fn(),
      setTokens: vi.fn(),
    }),
  },
}));

import api from '@/lib/api';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes GET, POST, PUT and DELETE methods', () => {
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
    expect(typeof api.put).toBe('function');
    expect(typeof api.delete).toBe('function');
  });

  it('attaches Authorization header from store in request interceptor', () => {
    expect(hooks.onRequest).toBeTypeOf('function');
    const config = { headers: {} as Record<string, string> };

    hooks.onRequest?.(config);

    expect(config.headers.Authorization).toBe('Bearer stored-token');
  });

  it('registers a response interceptor', () => {
    expect(hooks.onResponse).toBeTypeOf('function');
  });
});