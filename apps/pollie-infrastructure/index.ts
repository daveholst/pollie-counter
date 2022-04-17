import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as path from 'path'

import { getDomainAndSubdomain } from './utils'
import { ApiGatewayLambdaProxy } from '@wanews/pulumi-apigateway-lambda-proxy'

// This is the path to the other project relative to the CWD
const projectRoot = '../..'

const name = 'pollie-rater-api'
const domain = 'pollie-api.dh.wtf'
const dbName = 'pollie-rater-table'
const domainParts = getDomainAndSubdomain(domain)
const tenMinutes = 60 * 10

// Get the hosted zone by domain name
const selectedZone = pulumi.output(
  aws.route53.getZone({ name: domainParts.parentDomain }, { async: true })
)

//  Create the SSL Certificate
const certificate = new aws.acm.Certificate(
  `${name}-certificate`,
  {
    domainName: domain,
    validationMethod: 'DNS',
  }
  // { provider: eastRegion }
)
// Create the Certificate Validation Records in the DNS
const certificateValidationDomain = new aws.route53.Record(
  `${name}-validation`,
  {
    name: certificate.domainValidationOptions[0].resourceRecordName,
    zoneId: selectedZone.zoneId,
    type: certificate.domainValidationOptions[0].resourceRecordType,
    records: [certificate.domainValidationOptions[0].resourceRecordValue],
    ttl: tenMinutes,
  }
)

// Wait for Certificate to be validated
const certificateValidation = new aws.acm.CertificateValidation(
  `${name}-certificate-validation`,
  {
    certificateArn: certificate.arn,
    validationRecordFqdns: [certificateValidationDomain.fqdn],
  }
)

// Create a Database infrastructure
const pollieRaterTable = new aws.dynamodb.Table(dbName, {
  attributes: [
    {
      name: 'pollie-name',
      type: 'S',
    },
    {
      name: 'aggregates',
      type: 'S',
    },
    {
      name: 'userId',
      type: 'S',
    },
  ],
  hashKey: 'pollie-name',
  rangeKey: 'aggregates',
  globalSecondaryIndexes: [
    {
      hashKey: 'userId',
      name: 'user-index',
      nonKeyAttributes: ['userId', 'pollie-name'],
      projectionType: 'INCLUDE',
      rangeKey: 'pollie-name',
      readCapacity: 10,
      writeCapacity: 10,
    },
  ],
  billingMode: 'PROVISIONED',
  readCapacity: 10,
  writeCapacity: 10,
})

// lambda policy
const role = new aws.iam.Role(`${name}-lambda-policy`, {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'lambda.amazonaws.com',
  }),
})

const policy = new aws.iam.RolePolicy(`${name}-lambda-policy`, {
  role,
  policy: pollieRaterTable.arn.apply((arn) =>
    JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: [
            'dynamodb:*',
            // 'dynamodb:CreateTable',
            // 'dynamodb:ListTables',
            // 'dynamodb:UpdateItem',
            // 'dynamodb:PutItem',
            // 'dynamodb:GetItem',
            // 'dynamodb:DescribeTable',
          ],
          Resource: [arn, `${arn}/index/*`],
          // Resource: [juiceboxTable.arn, `${juiceboxTable.arn}/index/*`],
          Effect: 'Allow',
        },
        {
          Action: ['logs:*', 'cloudwatch:*'],
          Resource: '*',
          Effect: 'Allow',
        },
      ],
    })
  ),
})

// create lambda from code
const apiProxy = new ApiGatewayLambdaProxy(`${name}-lambda-proxy`, {
  executionRole: role,
  hostname: domain,
  apiGatewayCertificateArn: certificateValidation.certificateArn,
  apiGatewayOptions: {
    corsConfiguration: {
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS', 'PUT'],
      allowOrigins: ['*'],
      allowHeaders: [
        'Accept',
        'Accept-Encoding',
        'X-Api-Key',
        'Origin',
        'Content-Type',
        'Authorization',
        'Pragma', // otherwise it breaks in Chrome DevTools!
      ],
    },
  },
  getTags,

  lambdaOptions: {
    code: new pulumi.asset.FileArchive(
      path.resolve(projectRoot, 'archive.zip')
    ),
    runtime: 'nodejs14.x',
    handler: 'index.handler',
    memorySize: 256,
    environment: {
      variables: {
        DB_NAME: pollieRaterTable.name,
      },
    },
  },
})

// Create DB

// had to add this conditional for typescript Object is possibly 'undefined' error. is there a better way?
if (apiProxy.apiGatewayDomainName) {
  const apiDnsRecord = new aws.route53.Record(
    `${name}-dns-record`,
    {
      // name: apiGatewayDomainName.domainName,
      name: domain,
      type: 'A',
      zoneId: selectedZone.zoneId,
      aliases: [
        {
          evaluateTargetHealth: false,
          // name: apiProxy.apiGatewayHostname.apply((host) => host),
          name: apiProxy.apiGatewayDomainName.domainNameConfiguration.apply(
            (domainNameConfiguration) =>
              domainNameConfiguration.targetDomainName
          ),
          zoneId:
            apiProxy.apiGatewayDomainName.domainNameConfiguration.apply(
              (domainNameConfiguration) => domainNameConfiguration.hostedZoneId
            ) || 'none',
        },
      ],
    },
    { dependsOn: certificateValidation }
  )
}
//  Create DNS record for apiGateway

function getTags(name: string) {
  // Use whatever logic you like to construct your tags
  return {
    Name: name,
    Product: 'pollie-counter',
    /* ... */
  }
}

exports.url = apiProxy.invokeUrl
exports.dbArn = pollieRaterTable.arn
