import { describe, expect, it } from 'vitest';
import { calculateAvailability, overlaps } from '../../src/services/availability-service.js';

describe('availability service', () => {
  it('detecta cruces y respeta bordes consecutivos', () => {
    expect(overlaps('09:00', 30, '09:15', 30)).toBe(true);
    expect(overlaps('09:00', 30, '09:30', 30)).toBe(false);
  });

  it('genera horarios dentro de la jornada', () => {
    const result = calculateAvailability({
      openTime: '09:00', closeTime: '11:00', slotMinutes: 30,
      serviceDuration: 30, appointments: []
    });
    expect(result).toEqual(['09:00', '09:30', '10:00', '10:30']);
  });

  it('elimina horarios ocupados e ignora citas canceladas', () => {
    const result = calculateAvailability({
      openTime: '09:00', closeTime: '11:00', slotMinutes: 30,
      serviceDuration: 30,
      appointments: [
        { time: '09:30', duration: 30, status: 'CONFIRMADA' },
        { time: '10:00', duration: 30, status: 'CANCELADA' }
      ]
    });
    expect(result).toEqual(['09:00', '10:00', '10:30']);
  });

  it('no ofrece un bloque que excede la hora de cierre', () => {
    const result = calculateAvailability({
      openTime: '18:00', closeTime: '19:00', slotMinutes: 30,
      serviceDuration: 45, appointments: []
    });
    expect(result).toEqual(['18:00']);
  });
});
