import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const region = process.env.AWS_REGION || "us-east-1";
const topicArn = process.env.TOPIC_ARN;
const queueUrl = process.env.NOTIFICATION_QUEUE_URL;
const senderEmail = process.env.SES_SENDER_EMAIL;

const sns = new SNSClient({ region });
const ses = new SESClient({ region });
const sqs = new SQSClient({ region });

export async function publishReservationEvent(eventType, reserva) {
  if (!topicArn) return;

  await sns.send(new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify({ eventType, reserva }),
    MessageAttributes: {
      eventType: {
        DataType: "String",
        StringValue: eventType
      }
    }
  }));
}

export async function sendReservationEmail({ to, subject, message }) {
  if (!senderEmail || !to) {
    await enqueueNotification({ to, subject, message, reason: "SES sender or recipient missing" });
    return { queued: true };
  }

  try {
    await ses.send(new SendEmailCommand({
      Source: senderEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: message, Charset: "UTF-8" }
        }
      }
    }));

    return { sent: true };
  } catch (error) {
    await enqueueNotification({ to, subject, message, reason: error.message });
    return { queued: true };
  }
}

export async function enqueueNotification(payload) {
  if (!queueUrl) return;

  await sqs.send(new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(payload)
  }));
}

export function getSnsRecords(event) {
  return event?.Records?.map(record => {
    if (record.Sns?.Message) {
      return JSON.parse(record.Sns.Message);
    }

    if (record.body) {
      return JSON.parse(record.body);
    }

    return record;
  }) || [];
}
