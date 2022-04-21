import { APIGatewayEvent, APIGatewayProxyHandler } from 'aws-lambda'
import { DynamoDB } from 'aws-sdk'
import { castVote } from './handlers/cast-vote'
import { multiUpdate } from './utils'

const dbName = process.env.DB_NAME
const dynamoDB = new DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: 'ap-southeast-2',
})

export async function handler(event: APIGatewayEvent) {
  if (!dbName) {
    console.error('no dynamo table name found :(')
    return {
      statusCode: 500,
      body: 'No Dynamo Table Found :(',
    }
  }

  // POST on the root with body content
  if (event.path === '/' && event.httpMethod === 'POST' && event.body) {
    // TODO type check it here?
    return await castVote({
      body: event.body,
      dynamoDB,
      dbName,
    })
  }
  // GET on the root
  if (event.path === '/' && event.httpMethod === 'GET' && event.body) {
    const getParams = JSON.parse(event.body)
    console.log(getParams)

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

    return {
      statusCode: 200,
      body: JSON.stringify(queryResult, null, 2),
    }
  }
}
