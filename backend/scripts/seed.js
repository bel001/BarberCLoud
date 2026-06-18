import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const tableName = process.env.TABLE_NAME || "barbercloud-local";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local"
  }
}));

const now = new Date().toISOString();
const items = [
  {
    pk: "CLIENTE#cliente-demo",
    sk: "PROFILE",
    tipo: "CLIENTE",
    clienteId: "cliente-demo",
    nombre: "Cliente Demo",
    email: "cliente@barbercloud.com",
    gsi1pk: "CLIENTE_EMAIL#cliente@barbercloud.com",
    gsi1sk: "CLIENTE#cliente-demo",
    creadoEn: now
  },
  {
    pk: "BARBERO#barbero_carlos",
    sk: "PROFILE",
    tipo: "BARBERO",
    barberoId: "barbero_carlos",
    nombre: "Carlos Barbero",
    email: "barbero@barbercloud.com",
    creadoEn: now
  }
];

await client.send(new BatchWriteCommand({
  RequestItems: {
    [tableName]: items.map(Item => ({
      PutRequest: { Item }
    }))
  }
}));

console.log(`Seed data loaded into ${tableName}`);
