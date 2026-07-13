import { describe, expect, it } from 'vitest';
import { handler as reservationNotification } from '../../src/handlers/notificarReserva.js';
import { handler as cancellationNotification } from '../../src/handlers/notificarCancelacion.js';
import { parseBody } from '../helpers/events.js';

describe('notification handlers', () => {
  it('procesa registros de reserva por SES', async () => {
    const response = await reservationNotification({ Records: [{}, {}] });
    expect(response.statusCode).toBe(200);
    expect(parseBody(response).data).toMatchObject({ processed: 2, channel: 'SES' });
  });

  it('procesa cancelación con SES y cola de reintento', async () => {
    const response = await cancellationNotification({ Records: [{}] });
    expect(parseBody(response).data).toMatchObject({ processed: 1, channel: 'SES/SQS' });
  });

  it('acepta evento sin Records', async () => {
    expect(parseBody(await reservationNotification({})).data.processed).toBe(0);
  });
});
