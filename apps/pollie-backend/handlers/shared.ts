import { DynamoDB } from 'aws-sdk'

// query DB and retrieve votes for user

export interface getVoteParams {
  body: string
  dynamoDB: DynamoDB.DocumentClient
  dbName: string
}

export async function getVoteItems({
  body,
  dynamoDB,
  dbName,
}: getVoteParams): Promise<DynamoDB.DocumentClient.QueryOutput | undefined> {
  const getParams = JSON.parse(body)
  if (!getParams.userId) {
    throw new Error('No UserID provided for fetch')
  }
  const queryResult = await dynamoDB
    .query({
      TableName: dbName,
      KeyConditionExpression: `#source = :source and #data = :data`,
      ExpressionAttributeNames: {
        '#source': 'source',
        '#data': 'data',
      },
      ExpressionAttributeValues: {
        ':source': `user#${getParams.userId}`,
        ':data': 'federalElection2022#votes',
      },
    })
    .promise()
  return queryResult
}
