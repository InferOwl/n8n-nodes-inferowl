import type { INodeProperties } from 'n8n-workflow';

export const placementOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['placement'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a contract placement (candidate assignment)',
				action: 'Get a placement',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List contract placements, most recently created first',
				action: 'Get many placements',
			},
		],
		default: 'get',
	},
];

const showFor = (operation: string[]) => ({ show: { resource: ['placement'], operation } });

export const placementFields: INodeProperties[] = [
	{
		displayName: 'Placement ID',
		name: 'placementId',
		type: 'string',
		required: true,
		default: '',
		description: 'The assignment_id of a "Placement started" or "Placement status changed" event',
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
			show: { resource: ['placement'], operation: ['getAll'], returnAll: [false] },
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
			{
				displayName: 'Ending Within (Days)',
				name: 'endingIn',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 3650 },
				default: 30,
				description: 'Only placements whose end date falls within this many days',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Booked', value: 'booked' },
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Extended', value: 'extended' },
					{ name: 'Replaced', value: 'replaced' },
				],
				default: 'active',
			},
		],
	},
];
