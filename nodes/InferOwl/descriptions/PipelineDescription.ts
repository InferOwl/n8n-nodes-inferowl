import type { INodeProperties } from 'n8n-workflow';

export const applicationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['application'] } },
		options: [
			{
				name: 'Move to Stage',
				value: 'moveStage',
				description: 'Move a candidate on a job pipeline to another stage',
				action: 'Move a candidate to a pipeline stage',
			},
		],
		default: 'moveStage',
	},
];

const showMove = (extra: Record<string, string[]> = {}) => ({
	show: { resource: ['application'], operation: ['moveStage'], ...extra },
});

export const applicationFields: INodeProperties[] = [
	{
		displayName: 'Identify By',
		name: 'identifyBy',
		type: 'options',
		options: [
			{
				name: 'Application ID',
				value: 'application',
				description: 'From a "Candidate added to job" or "Pipeline stage changed" event',
			},
			{ name: 'Candidate and Job', value: 'candidateAndJob' },
		],
		default: 'candidateAndJob',
		displayOptions: showMove(),
	},
	{
		displayName: 'Application ID',
		name: 'applicationId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showMove({ identifyBy: ['application'] }),
	},
	{
		displayName: 'Candidate ID',
		name: 'candidateId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showMove({ identifyBy: ['candidateAndJob'] }),
	},
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showMove({ identifyBy: ['candidateAndJob'] }),
	},
	{
		displayName: 'Stage Name or ID',
		name: 'stageId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getStages' },
		required: true,
		default: '',
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
		displayOptions: showMove(),
	},
	{
		displayName: 'Reason',
		name: 'reason',
		type: 'string',
		default: '',
		description: 'Required by some stages (up to 500 characters)',
		displayOptions: showMove(),
	},
];

export const callOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['call'] } },
		options: [
			{
				name: 'Log Outcome',
				value: 'logOutcome',
				description: 'Record the outcome and a note on a call. It never places a call.',
				action: 'Log a call outcome',
			},
		],
		default: 'logOutcome',
	},
];

export const callDispositionOptions = [
	{ name: 'Busy', value: 'busy' },
	{ name: 'Callback Requested', value: 'callback_requested' },
	{ name: 'Connected', value: 'connected' },
	{ name: 'Do Not Call', value: 'dnc' },
	{ name: 'Left Voicemail', value: 'voicemail' },
	{ name: 'No Answer', value: 'no_answer' },
	{ name: 'Wrong Number', value: 'wrong_number' },
];

export const callFields: INodeProperties[] = [
	{
		displayName: 'Call ID',
		name: 'callId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['call'], operation: ['logOutcome'] } },
	},
	{
		displayName: 'Outcome',
		name: 'disposition',
		type: 'options',
		options: callDispositionOptions,
		required: true,
		default: 'connected',
		displayOptions: { show: { resource: ['call'], operation: ['logOutcome'] } },
	},
	{
		displayName: 'Note',
		name: 'note',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		displayOptions: { show: { resource: ['call'], operation: ['logOutcome'] } },
	},
];
