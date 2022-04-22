import { getVoteItems, getVoteParams } from './shared'

export async function getVotes({ body, dynamoDB, dbName }: getVoteParams) {
  try {
    const queryResult = await getVoteItems({
      body,
      dynamoDB,
      dbName,
    })

    return {
      statusCode: 200,
      body: JSON.stringify(queryResult, null, 2),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error, null, 2),
    }
  }
}
