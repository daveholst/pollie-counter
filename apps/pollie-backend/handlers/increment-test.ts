import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyHandler,
} from 'aws-lambda'

export async function insertVote(event: APIGatewayProxyHandler) {
  return console.log(JSON.stringify(event, null, 2))
}
