import { APIGatewayEvent, APIGatewayProxyHandler } from 'aws-lambda'
import { DynamoDB } from 'aws-sdk'

const dynamoDB = new DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: 'ap-southeast-2',
})
const dbName = process.env.DB_NAME

const AWS = require('aws-sdk') // Or use `import` syntax for Typescript and newer ES versions

interface castVoteDTO {
  pollieName: string
  rating: number
}

export async function handler(event: APIGatewayEvent) {
  if (!dbName) {
    console.error('no dynamo table name found :(')
    return
  }
  if (event.path === '/' && event.httpMethod === 'POST' && event.body) {
    const data = JSON.parse(event.body) as castVoteDTO
    // smack it into the DB
    try {
      // update atomic counters
      const result1 = await dynamoDB
        .update({
          TableName: dbName,
          Key: { 'pollie-name': data.pollieName, aggregates: 'total-votes' },
          ReturnValues: 'UPDATED_NEW',
          UpdateExpression: `SET #value1 = if_not_exists(#value1, :start) + :increment1, #value2 = if_not_exists(#value2, :start) + :increment2`,
          ExpressionAttributeValues: {
            ':start': 0,
            ':increment1': data.rating,
            ':increment2': 1,
          },
          ExpressionAttributeNames: {
            '#value1': 'accumulated-vote-count',
            '#value2': 'total-votes-cast',
          },
        })
        .promise()

      const averageRating =
        Math.round(
          (result1.Attributes?.['accumulated-vote-count'] /
            result1.Attributes?.['total-votes-cast']) *
            10
        ) / 10

      return {
        statusCode: 200,
        body: JSON.stringify({ ...result1.Attributes, averageRating }, null, 2),
      }
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify(error, null, 2),
      }
    }
  }
}
