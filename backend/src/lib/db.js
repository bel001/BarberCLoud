import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from './config.js';

const client = new DynamoDBClient({
  region: config.region,
  endpoint: config.dynamodbEndpoint,
  credentials: config.dynamodbEndpoint
    ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local' }
    : undefined
});

export const documentClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

export { client as dynamoClient };
