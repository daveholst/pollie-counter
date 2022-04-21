import { DynamoDB } from 'aws-sdk'
import { multiUpdate } from '../utils'

export interface castVoteParams {
  body: string
  dynamoDB: DynamoDB.DocumentClient
  dbName: string
}
export interface IndividualVotesDTO {
  scottMorrison?: number
  anthonyAlbanese?: number
}

export interface CastVoteDTO {
  userId: string
  pollieName: string
  rating: number
}
export async function castVote({ body, dynamoDB, dbName }: castVoteParams) {
  const data = JSON.parse(body) as CastVoteDTO
  const indivudalVoteData: IndividualVotesDTO = {
    [data.pollieName]: data.rating,
  }
  // smack it into the DB
  try {
    // TODO update the users vote, check if item exists in the db from this user?
    //create or override result
    const voteResult = await multiUpdate({
      tableName: dbName,
      partitionKeyName: 'source',
      partitionKeyValue: `user#${data.userId}`,
      sortKeyName: 'data',
      sortKeyValue: `federalElection2022#votes`,
      updates: indivudalVoteData,
      db: dynamoDB,
    })

    // update atomic counters from 'create' vote (no previous votes / check previous votes)
    const counterResult = await dynamoDB
      .update({
        TableName: dbName,
        Key: {
          source: `federalElection2022#aggregates`,
          data: `politician#${data.pollieName}`,
        },
        ReturnValues: 'UPDATED_NEW',
        UpdateExpression: `SET #value1 = if_not_exists(#value1, :start) + :increment1, #value2 = if_not_exists(#value2, :start) + :increment2`,
        ExpressionAttributeValues: {
          ':start': 0,
          ':increment1': data.rating,
          ':increment2': 1,
        },
        ExpressionAttributeNames: {
          '#value1': 'accumulatedVoteCount',
          '#value2': 'totalVotesCast',
        },
      })
      .promise()

    const averageRating =
      Math.round(
        (counterResult.Attributes?.accumulatedVoteCount /
          counterResult.Attributes?.totalVotesCast) *
          10
      ) / 10

    return {
      statusCode: 200,
      body: JSON.stringify(
        { ...counterResult.Attributes, averageRating },
        null,
        2
      ),
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error, null, 2),
    }
  }
}
