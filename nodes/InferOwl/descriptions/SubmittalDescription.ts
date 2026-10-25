import type { INodeProperties } from 'n8n-workflow';

export const submittalOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['submittal'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a submittal with its interviews, offers, client responses and placements',
				action: 'Get a submittal',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List submittals, most recently submitted first',
				action: 'Get many submittals',
			},
		],
		default: 'get',
	},
];

const showFor = (operation: string[]) => ({ show: { resource: ['submittal'], operation } });

export const submittalFields: INodeProperties[] = [
	{
		displayName: 'Submittal ID',
		name: 'submittalId',
		type: 'string',
		required: true,
		default: '',
		description: 'From a "Submittal created" or "Submittal status changed" event',
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
			show: { resource: ['submittal'], operation: ['getAll'], returnAll: [false] },
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
			{ displayName: 'Client ID', name: 'clientId', type: 'string', default: '' },
			{ displayName: 'Job ID', name: 'jobId', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Awaiting Approval', value: 'awaiting_approval' },
					{ name: 'Declined', value: 'declined' },
					{ name: 'Interview Requested', value: 'interview_requested' },
					{ name: 'Interview Scheduled', value: 'interview_scheduled' },
					{ name: 'Offer Accepted', value: 'offer_accepted' },
					{ name: 'Offer Accepted With Condition', value: 'offer_accepted_with_condition' },
					{ name: 'Offer Pending', value: 'offer_pending' },
					{ name: 'Rejected', value: 'rejected' },
					{ name: 'Submitted to Client', value: 'submitted_to_client' },
					{ name: 'Under Review', value: 'under_review' },
					{ name: 'Withdrawn', value: 'withdrawn' },
				],
				default: 'submitted_to_client',
			},
			{ displayName: 'Submitted After', name: 'submittedAfter', type: 'dateTime', default: '' },
			{ displayName: 'Submitted Before', name: 'submittedBefore', type: 'dateTime', default: '' },
		],
	},
];
