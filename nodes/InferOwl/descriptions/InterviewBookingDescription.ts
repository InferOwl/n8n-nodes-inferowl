import type { INodeProperties } from 'n8n-workflow';

export const interviewBookingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['interviewBooking'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get an interview booked with a candidate',
				action: 'Get an interview booking',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List interview bookings, most recently booked first',
				action: 'Get many interview bookings',
			},
		],
		default: 'get',
	},
];

const showFor = (operation: string[]) => ({ show: { resource: ['interviewBooking'], operation } });

export const interviewBookingFields: INodeProperties[] = [
	{
		displayName: 'Booking ID',
		name: 'bookingId',
		type: 'string',
		required: true,
		default: '',
		description: 'From an "Interview booked" or "Interview booking changed" event',
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
			show: { resource: ['interviewBooking'], operation: ['getAll'], returnAll: [false] },
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
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Cancelled', value: 'cancelled' },
					{ name: 'Completed', value: 'completed' },
					{ name: 'Confirmed', value: 'confirmed' },
					{ name: 'No Show', value: 'no_show' },
					{ name: 'Pending', value: 'pending' },
					{ name: 'Scheduled', value: 'scheduled' },
				],
				default: 'confirmed',
			},
		],
	},
];
