import { vi } from 'vitest';

export function fixedClock(iso = '2026-07-01T10:00:00.000Z') {
  return () => new Date(iso);
}

export function fixedId(id = 'test-id') {
  return () => id;
}

export function createRepositoryMock(overrides = {}) {
  return {
    getItem: vi.fn().mockResolvedValue(null),
    scanByType: vi.fn().mockResolvedValue([]),
    scanAll: vi.fn().mockResolvedValue([]),
    putItem: vi.fn().mockImplementation(async (item) => item),
    updateItem: vi.fn().mockImplementation(async (_pk, updates) => updates),
    deleteItem: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}
