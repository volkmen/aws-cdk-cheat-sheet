import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import ConstructorProperties = jest.ConstructorProperties;
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'node:path';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkAwsCheatSheetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queue1 = this.createQueue('CdkQueue1');
    const queue2 = this.createQueue('CdkQueue2');
    const topic1 = this.createTopic('CdkTopic1');

    topic1.addSubscription(new SqsSubscription(queue1));
    topic1.addSubscription(new SqsSubscription(queue2));

    const lambdaDb = this.createLambdaFunction('CdkLambda1Db', {
      entry: path.join(process.cwd(), 'lambdas/updateDb.ts'),
      handler: 'handler'
    });
    queue1.grantConsumeMessages(lambdaDb);
    lambdaDb.addEventSource(
      new SqsEventSource(queue1, {
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        reportBatchItemFailures: true
      })
    );

    const lambda2 = this.createLambdaFunction('CdkLambda2Asset', {
      entry: path.join(process.cwd(), 'lambdas/statisticUpdate.ts'),
      handler: 'handler'
    });
    queue2.grantConsumeMessages(lambda2);
  }

  createQueue(name: string, options: Partial<ConstructorProperties<typeof Queue>> = {}) {
    return new Queue(this, name, {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: name,
      ...options
    });
  }

  createTopic(name: string, options: Partial<ConstructorProperties<typeof Topic>> = {}) {
    return new Topic(this, name, {
      topicName: name,
      ...options
    });
  }

  createLambdaFunction(name: string, options: Partial<ConstructorProperties<typeof NodejsFunction>> = {}) {
    return new NodejsFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_22_X,
      ...options
    });
  }
}
