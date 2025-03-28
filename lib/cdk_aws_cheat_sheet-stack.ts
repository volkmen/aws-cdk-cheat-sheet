import * as cdk from 'aws-cdk-lib';
import * as path from 'node:path';

import { type Construct } from 'constructs';
import { Queue } from 'aws-cdk-lib/aws-sqs';

import { Topic } from 'aws-cdk-lib/aws-sns';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

import { type IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

import { IpAddresses, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { VpcProps } from 'aws-cdk-lib/aws-ec2/lib/vpc';
import { Deployment, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';

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

    const vpc = this.createVpc('CDK-vpc');

    const restApi = this.createRestApiGateway('CDK_restapi', {});
    // const deployment = new Deployment(this, 'staging', { api: restApi });
    // const production = new Deployment(this, 'production', { api: restApi });

    const resource = restApi.root.addResource('lambda-api');
    const restApiLambdaFn = this.createLambdaFunction('CDK_restapi_lambda', {
      entry: path.join(process.cwd(), 'lambdas/restHandler.ts'),
      handler: 'handler'
    });
    restApiLambdaFn.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));

    resource.addMethod('GET', new LambdaIntegration(restApiLambdaFn));
  }

  /*********
   ***** QUEUE *****
   *********/

  createQueue(name: string, options: Partial<ConstructorParameters<typeof Queue>[2]> = {}) {
    return new Queue(this, name, {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: name,
      ...options
    });
  }

  /*********
   ***** TOPIC *****
   *********/

  createTopic(name: string, options: Partial<ConstructorParameters<typeof Topic>[2]> = {}) {
    return new Topic(this, name, {
      topicName: name,
      ...options
    });
  }

  /*********
   ***** LAMBDA *****
   *********/

  createLambdaFunction(name: string, options: Partial<ConstructorParameters<typeof NodejsFunction>[2]> = {}) {
    return new NodejsFunction(this, name, {
      functionName: name,
      runtime: Runtime.NODEJS_22_X,
      ...options
    });
  }

  /*********
   ***** VPC *****
   *********/

  getVpcSubnetOptions(name: string, subnetType: SubnetType) {
    return {
      cidrMask: 24,
      name,
      subnetType
    };
  }

  createVpc(name: string, options: Partial<VpcProps> = {}) {
    const defaultOptions = {
      natGateways: 0,
      maxAzs: 1,
      ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        this.getVpcSubnetOptions('Private subnet with egress', SubnetType.PRIVATE_WITH_EGRESS),
        this.getVpcSubnetOptions('Public subnet', SubnetType.PUBLIC)
      ]
    };

    return new Vpc(this, name, {
      vpcName: name,
      ...defaultOptions,
      ...options
    });
  }

  /*******
   ***** SG *****
   ******/

  createSecurityGroup(name: string, options: ConstructorParameters<typeof SecurityGroup>[2]) {
    const sg = new SecurityGroup(this, name, {
      securityGroupName: name,
      ...options
    });

    /***
     OutBounds rules
     ****/
    // sg.addEgressRule(Peer.anyIpv6(), Port.allTcp());

    /***
     InBound rules
     ****/
    // sg.addIngressRule(Peer.anyIpv6(), Port.allTcp());

    return sg;
  }

  /*******
   ***** REST API GATEWAY *****
   ******/
  createRestApiGateway(name: string, options: ConstructorParameters<typeof RestApi>[2]) {
    const restApi = new RestApi(this, name, {
      restApiName: name,
      ...options
    });

    return restApi;
  }

  addLambdaRestApiIntegration(
    gt: RestApi,
    { endpoint, method, lambdaFn }: { endpoint: string; method: string; lambdaFn: IFunction }
  ) {
    const resource = gt.root.addResource(endpoint);
    resource.addMethod(method, new LambdaIntegration(lambdaFn));
  }

  /*******
   ***** HTTP API GATEWAY *****
   ******/
  createHttpApiGateway(name: string) {
    const httpApi = new HttpApi(this, name, {
      apiName: name
    });

    return httpApi;
  }
}
