const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function overlaps(startA, durationA, startB, durationB) {
  const a = toMinutes(startA);
  const b = toMinutes(startB);
  return a < b + durationB && b < a + durationA;
}

export function calculateAvailability({ openTime, closeTime, slotMinutes, serviceDuration, appointments }) {
  const available = [];
  const start = toMinutes(openTime);
  const end = toMinutes(closeTime);
  for (let minute = start; minute + serviceDuration <= end; minute += slotMinutes) {
    const time = toTime(minute);
    const occupied = appointments.some((appointment) =>
      !['CANCELADA', 'NO_ASISTIO'].includes(appointment.status) &&
      overlaps(time, serviceDuration, appointment.time, Number(appointment.duration || serviceDuration))
    );
    if (!occupied) available.push(time);
  }
  return available;
}
