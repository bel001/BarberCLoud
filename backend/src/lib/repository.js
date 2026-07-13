import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { documentClient } from './db.js';
import { config } from './config.js';

const table = config.tableName;

export async function putItem(item) {
  await documentClient.send(new PutCommand({ TableName: table, Item: item }));
  return item;
}

export async function getItem(PK, SK = 'META') {
  const result = await documentClient.send(new GetCommand({ TableName: table, Key: { PK, SK } }));
  return result.Item || null;
}

export async function deleteItem(PK, SK = 'META') {
  await documentClient.send(new DeleteCommand({ TableName: table, Key: { PK, SK } }));
}

export async function scanByType(entityType) {
  const result = await documentClient.send(new ScanCommand({
    TableName: table,
    FilterExpression: '#entityType = :entityType',
    ExpressionAttributeNames: { '#entityType': 'entityType' },
    ExpressionAttributeValues: { ':entityType': entityType }
  }));
  return result.Items || [];
}

export async function scanAll() {
  const result = await documentClient.send(new ScanCommand({ TableName: table }));
  return result.Items || [];
}

export async function updateItem(PK, updates, SK = 'META') {
  const keys = Object.keys(updates);
  const expressionNames = {};
  const expressionValues = {};
  const sets = keys.map((key, index) => {
    expressionNames[`#k${index}`] = key;
    expressionValues[`:v${index}`] = updates[key];
    return `#k${index} = :v${index}`;
  });
  const result = await documentClient.send(new UpdateCommand({
    TableName: table,
    Key: { PK, SK },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW'
  }));
  return result.Attributes;
}
