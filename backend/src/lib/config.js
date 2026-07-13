export const config = {
  port: Number(process.env.PORT || 3001),
  tableName: process.env.TABLE_NAME || 'barbercloud-local',
  region: process.env.AWS_REGION || 'us-east-1',
  dynamodbEndpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  authSecret: process.env.AUTH_SECRET || 'barbercloud-development-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  nodeEnv: process.env.NODE_ENV || 'development',
  userPoolId: process.env.USER_POOL_ID || '',
  reservationTopicArn: process.env.RESERVATION_TOPIC_ARN || '',
  cancellationTopicArn: process.env.CANCELLATION_TOPIC_ARN || '',
  retryQueueUrl: process.env.RETRY_QUEUE_URL || '',
  sesSenderEmail: process.env.SES_SENDER_EMAIL || ''
};

export const isAwsRuntime = () => Boolean(config.userPoolId && !config.dynamodbEndpoint);
