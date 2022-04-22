import { APIGatewayEvent, APIGatewayProxyHandler } from 'aws-lambda'
import { DynamoDB } from 'aws-sdk'
import { castVote } from './handlers/cast-vote'
import { getVotes } from './handlers/get-votes'
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
  // GET on the root - retrieve all the votes
  if (event.path === '/' && event.httpMethod === 'GET' && event.body) {
    return await getVotes({
      body: event.body,
      dynamoDB,
      dbName,
    })
  }
}
