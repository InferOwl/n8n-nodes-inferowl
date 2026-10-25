import type { INodeProperties } from 'n8n-workflow';

const showFor = (operation: string[]) => ({ show: { resource: ['candidate'], operation } });

const candidateTypeOptions = [
	{ name: 'Local', value: 'local' },
	{ name: 'Per Diem', value: 'per_diem' },
	{ name: 'Permanent', value: 'perm' },
	{ name: 'Permanent (Local)', value: 'permanent_local' },
	{ name: 'Travel', value: 'travel' },
];

const workAuthOptions = [
	{ name: 'Citizen', value: 'citizen' },
	{ name: 'None', value: 'none' },
	{ name: 'Permanent Resident', value: 'perm_resident' },
	{ name: 'Visa', value: 'visa' },
];

// Mirrors CreateCandidateDto / UpdateCandidateDto in the InferOwl API. SSN,
// date of birth and do-not-hire flags are deliberately not offered.
const sharedFields: INodeProperties[] = [
	{ displayName: 'Availability Date', name: 'availabilityDate', type: 'dateTime', default: '' },
	{
		displayName: 'Candidate Type',
		name: 'candidateType',
		type: 'options',
		options: candidateTypeOptions,
		default: 'travel',
	},
	{
		displayName: 'Certifications',
		name: 'certifications',
		type: 'string',
		default: '',
		description: 'Comma-separated, for example BLS, ACLS',
	},
	{ displayName: 'City', name: 'city', type: 'string', default: '' },
	{ displayName: 'Country', name: 'country', type: 'string', default: '' },
	{
		displayName: 'Email',
		name: 'email',
		type: 'string',
		placeholder: 'name@email.com',
		default: '',
	},
	{
		displayName: 'Experience (Years)',
		name: 'experienceYears',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
	},
	{ displayName: 'First Name', name: 'firstName', type: 'string', default: '' },
	{
		displayName: 'Languages',
		name: 'languages',
		type: 'string',
		default: '',
		description: 'Comma-separated',
	},
	{ displayName: 'Last Name', name: 'lastName', type: 'string', default: '' },
	{
		displayName: 'Pay Expectation Max',
		name: 'payExpectationMax',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
	},
	{
		displayName: 'Pay Expectation Min',
		name: 'payExpectationMin',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
	},
	{
		displayName: 'Phone',
		name: 'phone',
		type: 'string',
		default: '',
		description: 'E.164 is best, for example +15555550142',
	},
	{
		displayName: 'Primary Specialty',
		name: 'primarySpecialty',
		type: 'string',
		default: '',
		description: 'For example ICU, ER, Med-Surg',
	},
	{
		displayName: 'Profession',
		name: 'profession',
		type: 'string',
		default: '',
		description: 'For example RN, LPN, CNA, PT',
	},
	{ displayName: 'Referral Source', name: 'referralSource', type: 'string', default: '' },
	{ displayName: 'Secondary Specialty', name: 'secondarySpecialty', type: 'string', default: '' },
	{
		displayName: 'State',
		name: 'state',
		type: 'string',
		default: '',
		description: 'Two-letter code, for example TX',
	},
	{
		displayName: 'Willing to Relocate',
		name: 'willingToRelocate',
		type: 'boolean',
		default: false,
		description: 'Whether the candidate is willing to relocate',
	},
	{
		displayName: 'Work Authorization',
		name: 'workAuthStatus',
		type: 'options',
		options: workAuthOptions,
		default: 'citizen',
	},
	{ displayName: 'ZIP Code', name: 'zip', type: 'string', default: '' },
];

const sortByName = (fields: INodeProperties[]) =>
	[...fields].sort((a, b) => a.displayName.localeCompare(b.displayName));

export const candidateOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['candidate'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a candidate',
				action: 'Create a candidate',
			},
			{ name: 'Get', value: 'get', description: 'Get a candidate', action: 'Get a candidate' },
			{
				name: 'Search',
				value: 'search',
				description: 'Find candidates by email, phone or name',
				action: 'Search candidates',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update a candidate',
				action: 'Update a candidate',
			},
		],
		default: 'create',
	},
];

export const candidateFields: INodeProperties[] = [
	{
		displayName: 'Full Name',
		name: 'fullName',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['create']),
		options: sortByName([
			...sharedFields,
			{
				displayName: 'Skills',
				name: 'skills',
				type: 'string',
				default: '',
				description: 'Comma-separated',
			},
			{
				displayName: 'Source',
				name: 'source',
				type: 'options',
				options: [
					{ name: 'Direct Application', value: 'direct_application' },
					{ name: 'Manual', value: 'manual' },
					{ name: 'Referral', value: 'referral' },
					{ name: 'Sourcing Tool', value: 'scraper' },
					{ name: 'Upload', value: 'upload' },
				],
				default: 'manual',
			},
		]),
	},
	{
		displayName: 'Candidate ID',
		name: 'candidateId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: showFor(['get', 'update']),
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: showFor(['update']),
		options: sortByName([
			...sharedFields,
			{ displayName: 'Full Name', name: 'fullName', type: 'string', default: '' },
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Archived', value: 'archived' },
					{ name: 'Do Not Contact', value: 'do_not_contact' },
					{ name: 'Placed', value: 'placed' },
				],
				default: 'active',
			},
		]),
	},
	{
		displayName: 'Search By',
		name: 'searchBy',
		type: 'options',
		options: [
			{ name: 'Email', value: 'email' },
			{ name: 'Name', value: 'name' },
			{ name: 'Phone', value: 'phone' },
		],
		default: 'email',
		displayOptions: showFor(['search']),
	},
	{
		displayName: 'Search Value',
		name: 'searchValue',
		type: 'string',
		required: true,
		default: '',
		description:
			'Email and phone return exact matches only; phone is matched on its last 10 digits',
		displayOptions: showFor(['search']),
	},
];
