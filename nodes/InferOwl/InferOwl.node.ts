import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { candidateFields, candidateOperations } from './descriptions/CandidateDescription';
import { jobFields, jobOperations } from './descriptions/JobDescription';
import {
	applicationFields,
	applicationOperations,
	callFields,
	callOperations,
} from './descriptions/PipelineDescription';
import { runOperation } from './shared/operations';
import { inferOwlApiRequest } from './shared/transport';

export class InferOwl implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'InferOwl',
		name: 'inferOwl',
		icon: { light: 'file:../../icons/inferowl.svg', dark: 'file:../../icons/inferowl.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Work with candidates, jobs, pipelines and calls in InferOwl',
		defaults: {
			name: 'InferOwl',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'inferOwlApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Application',
						value: 'application',
						description: 'A candidate on a job pipeline',
					},
					{ name: 'Call', value: 'call' },
					{ name: 'Candidate', value: 'candidate' },
					{ name: 'Job', value: 'job' },
				],
				default: 'candidate',
			},
			...candidateOperations,
			...candidateFields,
			...jobOperations,
			...jobFields,
			...applicationOperations,
			...applicationFields,
			...callOperations,
			...callFields,
		],
	};

	methods = {
		loadOptions: {
			async getStages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const stages = ((await inferOwlApiRequest.call(this, 'GET', '/pipeline/stages')) ??
					[]) as IDataObject[];
				return stages.map((stage) => ({
					name: String(stage.name ?? stage.slug ?? stage.id),
					value: String(stage.id),
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				const result = await runOperation.call(this, resource, operation, itemIndex);
				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(result ?? {}),
					{ itemData: { item: itemIndex } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				// Both constructors return an error that is already an n8n node error unchanged.
				if (error instanceof NodeOperationError)
					throw new NodeOperationError(this.getNode(), error, { itemIndex });
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
			}
		}

		return [returnData];
	}
}
