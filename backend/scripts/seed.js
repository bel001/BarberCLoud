import { BatchWriteCommand, DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const tableName = process.env.TABLE_NAME || "barbercloud-local";
const dynamodbConfig = {
  region: process.env.AWS_REGION || "us-east-1"
};

if (process.env.DYNAMODB_ENDPOINT) {
  dynamodbConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
  dynamodbConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local"
  };
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient(dynamodbConfig));

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
  },
  {
    pk: "SERVICIO#corte-clasico",
    sk: "PROFILE",
    tipo: "SERVICIO",
    servicioId: "corte-clasico",
    nombre: "Corte clasico",
    precio: 30,
    duracionMinutos: 45,
    estado: "ACTIVO",
    gsi1pk: "SERVICIO",
    gsi1sk: "Corte clasico",
    creadoEn: now
  },
  {
    pk: "SERVICIO#barba",
    sk: "PROFILE",
    tipo: "SERVICIO",
    servicioId: "barba",
    nombre: "Perfilado de barba",
    precio: 20,
    duracionMinutos: 30,
    estado: "ACTIVO",
    gsi1pk: "SERVICIO",
    gsi1sk: "Perfilado de barba",
    creadoEn: now
  },
  {
    pk: "SERVICIO#corte-barba",
    sk: "PROFILE",
    tipo: "SERVICIO",
    servicioId: "corte-barba",
    nombre: "Corte y barba",
    precio: 45,
    duracionMinutos: 60,
    estado: "ACTIVO",
    gsi1pk: "SERVICIO",
    gsi1sk: "Corte y barba",
    creadoEn: now
  },
  {
    pk: "INVENTARIO#cera",
    sk: "PROFILE",
    tipo: "INVENTARIO",
    productoId: "cera",
    nombre: "Cera moldeadora",
    stock: 20,
    precio: 25,
    gsi1pk: "INVENTARIO",
    gsi1sk: "Cera moldeadora",
    actualizadoEn: now
  }
];

// El perfil del cliente demo acumula puntos de lealtad en tiempo real: si ya
// existe, no lo sobrescribimos para no resetear sus puntos en cada reinicio.
const clientePerfilExistente = await client.send(new GetCommand({
  TableName: tableName,
  Key: { pk: "CLIENTE#cliente-demo", sk: "PROFILE" }
}));

const itemsAInsertar = clientePerfilExistente.Item
  ? items.filter(item => item.pk !== "CLIENTE#cliente-demo")
  : items;

if (itemsAInsertar.length > 0) {
  await client.send(new BatchWriteCommand({
    RequestItems: {
      [tableName]: itemsAInsertar.map(Item => ({
        PutRequest: { Item }
      }))
    }
  }));
}

console.log(`Seed data loaded into ${tableName}`);
