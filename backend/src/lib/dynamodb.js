import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

const tableName = process.env.TABLE_NAME || "barbercloud-local";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local"
  }
}));

export async function putItem(item) {
  await client.send(new PutCommand({
    TableName: tableName,
    Item: item
  }));
}

export async function queryByPk(pk) {
  const response = await client.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": pk
    }
  }));

  return response.Items || [];
}

export async function findClienteByEmail(email) {
  const response = await client.send(new QueryCommand({
    TableName: tableName,
    IndexName: "gsi1",
    KeyConditionExpression: "gsi1pk = :gsi1pk",
    ExpressionAttributeValues: {
      ":gsi1pk": `CLIENTE_EMAIL#${email}`
    }
  }));

  return (response.Items || []).find(item => item.tipo === "CLIENTE") || null;
}

export async function scanReservas() {
  const response = await client.send(new ScanCommand({
    TableName: tableName,
    FilterExpression: "tipo = :tipo",
    ExpressionAttributeValues: {
      ":tipo": "RESERVA"
    }
  }));

  return response.Items || [];
}
