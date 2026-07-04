import { beforeEach, describe, expect, it, vi } from "vitest";

const snsSend = vi.hoisted(() => vi.fn());
const sesSend = vi.hoisted(() => vi.fn());
const sqsSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(function snsClient() {
    return { send: snsSend };
  }),
  PublishCommand: vi.fn(function publishCommand(input) {
    this.input = input;
  })
}));

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn(function sesClient() {
    return { send: sesSend };
  }),
  SendEmailCommand: vi.fn(function sendEmailCommand(input) {
    this.input = input;
  })
}));

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(function sqsClient() {
    return { send: sqsSend };
  }),
  SendMessageCommand: vi.fn(function sendMessageCommand(input) {
    this.input = input;
  })
}));

async function importNotifications(env = {}) {
  vi.resetModules();
  delete process.env.TOPIC_ARN;
  delete process.env.NOTIFICATION_QUEUE_URL;
  delete process.env.SES_SENDER_EMAIL;
  Object.assign(process.env, env);
  return import("../../src/lib/notifications.js");
}

describe("notifications", () => {
  beforeEach(() => {
    snsSend.mockReset();
    sesSend.mockReset();
    sqsSend.mockReset();
  });

  it("no publica reserva si no existe TOPIC_ARN", async () => {
    // Arrange
    const { publishReservationEvent } = await importNotifications();

    // Act
    await publishReservationEvent("RESERVA_CREADA", { reservaId: "res_1" });

    // Assert
    expect(snsSend).not.toHaveBeenCalled();
  });

  it("publica evento de reserva en SNS con atributo de tipo", async () => {
    // Arrange
    const { publishReservationEvent } = await importNotifications({ TOPIC_ARN: "arn:test:sns" });

    // Act
    await publishReservationEvent("RESERVA_CREADA", { reservaId: "res_1" });

    // Assert
    expect(snsSend).toHaveBeenCalledTimes(1);
    expect(snsSend.mock.calls[0][0].input).toEqual({
      TopicArn: "arn:test:sns",
      Message: JSON.stringify({ eventType: "RESERVA_CREADA", reserva: { reservaId: "res_1" } }),
      MessageAttributes: {
        eventType: {
          DataType: "String",
          StringValue: "RESERVA_CREADA"
        }
      }
    });
  });

  it("encola notificacion si falta remitente SES", async () => {
    // Arrange
    const { sendReservationEmail } = await importNotifications({ NOTIFICATION_QUEUE_URL: "https://sqs.test/queue" });

    // Act
    const result = await sendReservationEmail({
      to: "cliente@demo.local",
      subject: "Reserva",
      message: "Confirmada"
    });

    // Assert
    expect(result).toEqual({ queued: true });
    expect(sesSend).not.toHaveBeenCalled();
    expect(sqsSend.mock.calls[0][0].input).toEqual({
      QueueUrl: "https://sqs.test/queue",
      MessageBody: JSON.stringify({
        to: "cliente@demo.local",
        subject: "Reserva",
        message: "Confirmada",
        reason: "SES sender or recipient missing"
      })
    });
  });

  it("envia email por SES cuando hay remitente y destinatario", async () => {
    // Arrange
    sesSend.mockResolvedValueOnce({});
    const { sendReservationEmail } = await importNotifications({ SES_SENDER_EMAIL: "no-reply@barbercloud.com" });

    // Act
    const result = await sendReservationEmail({
      to: "cliente@demo.local",
      subject: "Reserva",
      message: "Confirmada"
    });

    // Assert
    expect(result).toEqual({ sent: true });
    expect(sesSend.mock.calls[0][0].input).toMatchObject({
      Source: "no-reply@barbercloud.com",
      Destination: { ToAddresses: ["cliente@demo.local"] }
    });
  });

  it("parsea registros desde SNS y SQS", async () => {
    // Arrange
    const { getSnsRecords } = await importNotifications();
    const event = {
      Records: [
        { Sns: { Message: JSON.stringify({ eventType: "SNS" }) } },
        { body: JSON.stringify({ eventType: "SQS" }) },
        { eventType: "RAW" }
      ]
    };

    // Act
    const records = getSnsRecords(event);

    // Assert
    expect(records).toEqual([
      { eventType: "SNS" },
      { eventType: "SQS" },
      { eventType: "RAW" }
    ]);
  });
});
