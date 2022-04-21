import { DynamoDB } from 'aws-sdk'

export interface multiUpdateOptions {
  tableName: string
  partitionKeyName: string
  partitionKeyValue: string
  sortKeyName: string
  sortKeyValue: string
  db: DynamoDB.DocumentClient
  updates: any //TODO should prob sort this.... but mehhh \o/
}

export const multiUpdate = async ({
  tableName,
  partitionKeyName,
  partitionKeyValue,
  sortKeyName,
  sortKeyValue,
  db,
  updates,
}: multiUpdateOptions) => {
  const keys = Object.keys(updates)
  const keyNameExpressions = keys.map((name) => `#${name}`)
  const keyValueExpressions = keys.map((value) => `:${value}`)
  const UpdateExpression =
    'set ' +
    keyNameExpressions
      .map((nameExpr, idx) => `${nameExpr} = ${keyValueExpressions[idx]}`)
      .join(', ')
  const ExpressionAttributeNames = keyNameExpressions.reduce(
    (exprs, nameExpr, idx) => ({ ...exprs, [nameExpr]: keys[idx] }),
    {}
  )
  const ExpressionAttributeValues = keyValueExpressions.reduce(
    (exprs, valueExpr, idx) => ({ ...exprs, [valueExpr]: updates[keys[idx]] }),
    {}
  )

  const params = {
    TableName: tableName,
    Key: { [partitionKeyName]: partitionKeyValue, [sortKeyName]: sortKeyValue },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  }
  return db.update(params).promise()
}
