import { vi } from "vitest";

// Mocks compartidos para repositorio, reloj e IDs.
// Mantienen las pruebas deterministicas y sin dependencia de AWS real.
export function fixedClock(iso = "2026-07-01T10:00:00.000Z") {
  return () => new Date(iso);
}

export function fixedId(id = "test-id") {
  return () => id;
}

export function createRepositoryMock(overrides = {}) {
  return {
    getItem: vi.fn().mockResolvedValue(undefined),
    queryByPk: vi.fn().mockResolvedValue([]),
    findClienteByEmail: vi.fn().mockResolvedValue(null),
    scanByTipo: vi.fn().mockResolvedValue([]),
    scanReservas: vi.fn().mockResolvedValue([]),
    putItem: vi.fn().mockResolvedValue(undefined),
    transactWrite: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}
