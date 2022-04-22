import { DynamoDB } from 'aws-sdk'
import { multiUpdate } from '../utils'
import { getVotes } from './get-votes'
import { getVoteItems } from './shared'

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
  const individualVoteData: IndividualVotesDTO = {
    [data.pollieName]: data.rating,
  }
  let voteVariance = 0
  let previousVote = undefined
  // smack it into the DB
  try {
    // TODO add data validation ie vote between 1-10
    const resultItems = await getVoteItems({
      body,
      dynamoDB,
      dbName,
    })

    // if a previous vote exists, set variables accordingly
    if (resultItems?.Items) {
      resultItems.Items.some((e, i) => {
        if (e[data.pollieName]) {
          previousVote = e[data.pollieName]
          voteVariance = data.rating - previousVote
          return true
        }
      })
    }

    //create or override (upsert?) result
    const voteResult = await multiUpdate({
      tableName: dbName,
      partitionKeyName: 'source',
      partitionKeyValue: `user#${data.userId}`,
      sortKeyName: 'data',
      sortKeyValue: `federalElection2022#votes`,
      updates: individualVoteData,
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
          ':increment1': previousVote ? voteVariance : data.rating,
          // if the vote is
          ':increment2': previousVote ? 0 : 1,
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
