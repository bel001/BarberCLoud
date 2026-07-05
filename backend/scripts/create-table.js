import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  waitUntilTableExists
} from "@aws-sdk/client-dynamodb";

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

const client = new DynamoDBClient(dynamodbConfig);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDynamoDB() {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      return "exists";
    } catch (error) {
      if (error.name === "ResourceNotFoundException") {
        return "missing";
      }

      if (attempt === 20) {
        throw error;
      }

      await sleep(1000);
    }
  }

  return "missing";
}

const status = await waitForDynamoDB();

if (status === "exists") {
  console.log(`DynamoDB table already exists: ${tableName}`);
  process.exit(0);
}

await client.send(new CreateTableCommand({
  TableName: tableName,
  BillingMode: "PAY_PER_REQUEST",
  AttributeDefinitions: [
    { AttributeName: "pk", AttributeType: "S" },
    { AttributeName: "sk", AttributeType: "S" },
    { AttributeName: "gsi1pk", AttributeType: "S" },
    { AttributeName: "gsi1sk", AttributeType: "S" }
  ],
  KeySchema: [
    { AttributeName: "pk", KeyType: "HASH" },
    { AttributeName: "sk", KeyType: "RANGE" }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: "gsi1",
      KeySchema: [
        { AttributeName: "gsi1pk", KeyType: "HASH" },
        { AttributeName: "gsi1sk", KeyType: "RANGE" }
      ],
      Projection: { ProjectionType: "ALL" }
    }
  ]
}));

await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: tableName });
console.log(`DynamoDB table created: ${tableName}`);
