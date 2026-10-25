import type { INodeProperties } from 'n8n-workflow';

export const clientInterviewOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['clientInterview'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a client interview with its submittal, candidate and job',
				action: 'Get a client interview',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List client interviews, newest first',
				action: 'Get many client interviews',
			},
		],
		default: 'get',
	},
];

const showFor = (operation: string[]) => ({ show: { resource: ['clientInterview'], operation } });

export const clientInterviewFields: INodeProperties[] = [
	{
		displayName: 'Interview ID',
		name: 'interviewId',
		type: 'string',
		required: true,
		default: '',
		description: 'From a "Client interview scheduled" event',
		displayOptions: showFor(['get']),
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor(['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 100 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: ['clientInterview'], operation: ['getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getAll']),
		options: [
			{ displayName: 'Candidate ID', name: 'candidateId', type: 'string', default: '' },
			{ displayName: 'Job ID', name: 'jobId', type: 'string', default: '' },
			{
				displayName: 'Outcome',
				name: 'outcome',
				type: 'options',
				options: [
					{ name: 'Failed', value: 'failed' },
					{ name: 'No Show', value: 'no_show' },
					{ name: 'Passed', value: 'passed' },
					{ name: 'Pending', value: 'pending' },
				],
				default: 'pending',
			},
			{ displayName: 'Scheduled After', name: 'scheduledAfter', type: 'dateTime', default: '' },
			{ displayName: 'Scheduled Before', name: 'scheduledBefore', type: 'dateTime', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'No Show', value: 'no_show' },
					{ name: 'Rescheduled', value: 'rescheduled' },
					{ name: 'Scheduled', value: 'scheduled' },
				],
				default: 'scheduled',
			},
			{ displayName: 'Submittal ID', name: 'submittalId', type: 'string', default: '' },
		],
	},
];
