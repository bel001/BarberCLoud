import { CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { dynamoClient } from '../src/lib/db.js';
import { config } from '../src/lib/config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDynamo() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await dynamoClient.send(new DescribeTableCommand({ TableName: config.tableName }));
      return 'exists';
    } catch (error) {
      if (error.name === 'ResourceNotFoundException') return 'missing';
      if (attempt === 30) throw error;
      console.log(`Esperando DynamoDB (${attempt}/30)...`);
      await sleep(2000);
    }
  }
  return 'missing';
}

const state = await waitForDynamo();
if (state === 'exists') {
  console.log(`Tabla ${config.tableName} ya existe.`);
  process.exit(0);
}

await dynamoClient.send(new CreateTableCommand({
  TableName: config.tableName,
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' }
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' }
  ],
  GlobalSecondaryIndexes: [{
    IndexName: 'GSI1',
    KeySchema: [
      { AttributeName: 'GSI1PK', KeyType: 'HASH' },
      { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
    ],
    Projection: { ProjectionType: 'ALL' }
  }]
}));

for (let attempt = 1; attempt <= 20; attempt += 1) {
  const description = await dynamoClient.send(new DescribeTableCommand({ TableName: config.tableName }));
  if (description.Table?.TableStatus === 'ACTIVE') break;
  await sleep(500);
}
console.log(`Tabla ${config.tableName} creada y activa.`);
