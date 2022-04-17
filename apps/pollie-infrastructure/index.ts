import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsnative from "@pulumi/aws-native";

const pollieCounterLambdaRole = new awsnative.iam.Role(
  "PollieCounterLambdaRole",
  {
    assumeRolePolicyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "sts:AssumeRole",
          Principal: {
            Service: "lambda.amazonaws.com",
          },
          Effect: "Allow",
          Sid: "",
        },
      ],
    },
  }
);

// create my own policy
// const pollieCounteLPolicy = new aws.iam.RolePolicy("pollieCounterPolicy", {

// })
const pollieCounterFunction = new awsnative.lambda.Function(
  "pollieCounterFunction",
  {
    role: pollieCounterLambdaRole.arn,
    runtime: "nodejs14.x",
    handler: "index.handler",
    code: {
      zipFile: `exports.handler = function(event, context, callback){ callback(null, {"response": "Hello "}); };`,
    },
  }
);

const lambdaRoleAttachment = new aws.iam.RolePolicy("lambdaRoleAttachment", {
  role: pulumi.interpolate`${pollieCounterLambdaRole.roleName}`,
  // policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  policy: pollieCounterFunction.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["lambda:InvokeFunctionUrl"],
          Resource: [arn],
          // Condition: {
          //   StringEquals: {
          //     "lambda:FunctionUrlAuthType": "NONE",
          //   },
          // },
        },
        {
          Action: ["logs:*", "cloudwatch:*"],
          Resource: "*",
          Effect: "Allow",
        },
      ],
    })
  ),
});

const lambdaUrl = new awsnative.lambda.Url("test", {
  targetFunctionArn: pollieCounterFunction.arn,
  authType: awsnative.lambda.UrlAuthType.None,
  // cors: {
  //   allowOrigins: ["*"],
  //   allowMethods: ["*"],
  // },
});

export const url = lambdaUrl.functionUrl;
