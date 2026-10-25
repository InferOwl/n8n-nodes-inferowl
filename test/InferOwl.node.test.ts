import type { IExecuteFunctions, ILoadOptionsFunctions, INodeProperties } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { InferOwl } from '../nodes/InferOwl/InferOwl.node';
import { candidateBody, jobBody, samePhone } from '../nodes/InferOwl/shared/operations';
import { envelope, executeContext, router } from './helpers';

const CANDIDATE = {
	id: '3f6c1d2a-8b4e-4c1f-9a7d-2e5b8c0d1f34',
	full_name: 'Jordan Reyes',
	email: 'jordan.reyes@example.com',
	phone: '+15555550142',
};
const JOB = { id: '9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d', title: 'ICU RN', status: 'open' };
const APPLICATION = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';
const STAGE = '9f0a1b2c-3d4e-4f5a-9b6c-7d8e9f0a1b2c';
const CALL = '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a';

const node = new InferOwl();
const run = (context: ReturnType<typeof executeContext>) =>
	node.execute.call(context as unknown as IExecuteFunctions);

describe('InferOwl node description', () => {
	it('is a usable-as-tool node on the inferOwlApi credential with four resources', () => {
		const { description } = node;
		expect(description.name).toBe('inferOwl');
		expect(description.usableAsTool).toBe(true);
		expect(description.credentials).toEqual([{ name: 'inferOwlApi', required: true }]);
		const resource = description.properties.find(
			(property) => property.name === 'resource',
		) as INodeProperties;
		expect((resource.options as Array<{ value: string }>).map((option) => option.value)).toEqual([
			'application',
			'call',
			'candidate',
			'job',
		]);
	});

	it('never offers SSN, date of birth or do-not-hire fields', () => {
		const names = JSON.stringify(node.description.properties);
		for (const forbidden of ['ssn', 'dob', 'doNotHire', 'do_not_hire'])
			expect(names).not.toContain(`"${forbidden}`);
	});
});

describe('request bodies', () => {
	it('maps candidate fields to the API names and drops empty values', () => {
		expect(
			candidateBody({
				fullName: 'Jordan Reyes',
				email: 'jordan.reyes@example.com',
				phone: '',
				primarySpecialty: 'ICU',
				availabilityDate: '2026-12-01T00:00:00.000Z',
				experienceYears: 6,
				willingToRelocate: false,
				skills: 'Epic, Telemetry',
				certifications: '',
				languages: 'English,Spanish',
				candidateType: 'travel',
			}),
		).toEqual({
			full_name: 'Jordan Reyes',
			email: 'jordan.reyes@example.com',
			primary_specialty: 'ICU',
			availability_date: '2026-12-01',
			experience_years: 6,
			willing_to_relocate: false,
			skills: ['Epic', 'Telemetry'],
			bilingual_languages: ['English', 'Spanish'],
			candidate_type: 'travel',
		});
	});

	it('maps job fields to the API names', () => {
		expect(
			jobBody('ICU RN', {
				initialStatus: 'open',
				openings: 2,
				billRate: 95.5,
				requiredCertifications: 'BLS',
				isExclusive: true,
				assignmentStartDate: '2026-12-01T00:00:00Z',
				clientId: '',
			}),
		).toEqual({
			title: 'ICU RN',
			initial_status: 'open',
			openings: 2,
			bill_rate: 95.5,
			required_certifications: ['BLS'],
			is_exclusive: true,
			assignment_start_date: '2026-12-01',
		});
	});

	it('matches phones with or without the country code', () => {
		expect(samePhone('+1 (555) 555-0142', '5555550142')).toBe(true);
		expect(samePhone('+15555550142', '+15555550143')).toBe(false);
		expect(samePhone('', '5555550142')).toBe(false);
	});
});

describe('candidate operations', () => {
	it('creates a candidate with the bearer credential and returns the record with pairedItem', async () => {
		const http = router({ 'POST /candidates': envelope(CANDIDATE) });
		const result = await run(
			executeContext(
				[
					{
						resource: 'candidate',
						operation: 'create',
						fullName: 'Jordan Reyes',
						additionalFields: { email: 'jordan.reyes@example.com', source: 'referral' },
					},
				],
				http,
			),
		);
		expect(http.requests[0]).toMatchObject({
			credentialType: 'inferOwlApi',
			method: 'POST',
			url: 'https://api.inferowl.com/api/v1/candidates',
			json: true,
			body: { full_name: 'Jordan Reyes', email: 'jordan.reyes@example.com', source: 'referral' },
		});
		expect(result).toEqual([[{ json: CANDIDATE, pairedItem: { item: 0 } }]]);
	});

	it('updates only the given fields, and refuses an empty update', async () => {
		const http = router({
			[`PATCH /candidates/${CANDIDATE.id}`]: envelope({ ...CANDIDATE, status: 'placed' }),
		});
		await run(
			executeContext(
				[
					{
						resource: 'candidate',
						operation: 'update',
						candidateId: CANDIDATE.id,
						updateFields: { status: 'placed', email: '' },
					},
				],
				http,
			),
		);
		expect(http.requests[0].body).toEqual({ status: 'placed' });
		await expect(
			run(
				executeContext(
					[
						{
							resource: 'candidate',
							operation: 'update',
							candidateId: CANDIDATE.id,
							updateFields: {},
						},
					],
					http,
				),
			),
		).rejects.toThrow('Add at least one field to update');
	});

	it('gets a candidate without the in-app agent suggestions', async () => {
		const http = router({
			[`GET /candidates/${CANDIDATE.id}`]: envelope({
				...CANDIDATE,
				agent_suggestions: [{ id: 'x' }],
			}),
		});
		const [[item]] = await run(
			executeContext(
				[{ resource: 'candidate', operation: 'get', candidateId: CANDIDATE.id }],
				http,
			),
		);
		expect(item.json).toEqual(CANDIDATE);
	});

	it('searches by email and keeps exact matches only', async () => {
		const http = router({
			'GET /candidates': envelope([
				{ ...CANDIDATE, id: 'other', email: 'jordan.reyes@example.org' },
				CANDIDATE,
			]),
		});
		const [items] = await run(
			executeContext(
				[
					{
						resource: 'candidate',
						operation: 'search',
						searchBy: 'email',
						searchValue: 'Jordan.Reyes@example.com',
					},
				],
				http,
			),
		);
		expect(http.requests[0].qs).toEqual({ search: 'jordan.reyes@example.com', limit: 25 });
		expect(items.map((item) => item.json.id)).toEqual([CANDIDATE.id]);
	});

	it('searches by phone on the last 10 digits', async () => {
		const http = router({
			'GET /candidates': envelope([
				CANDIDATE,
				{ ...CANDIDATE, id: 'other', phone: '+15555550199' },
			]),
		});
		const [items] = await run(
			executeContext(
				[
					{
						resource: 'candidate',
						operation: 'search',
						searchBy: 'phone',
						searchValue: '(555) 555-0142',
					},
				],
				http,
			),
		);
		expect(http.requests[0].qs).toEqual({ search: '5555550142', limit: 25 });
		expect(items.map((item) => item.json.id)).toEqual([CANDIDATE.id]);
	});
});

describe('job operations', () => {
	it('creates, gets and searches jobs', async () => {
		const http = router({
			'POST /jobs': envelope(JOB),
			[`GET /jobs/${JOB.id}`]: envelope({ ...JOB, agent_suggestions: [] }),
			'GET /jobs': envelope([JOB]),
		});
		const [[created]] = await run(
			executeContext(
				[
					{
						resource: 'job',
						operation: 'create',
						title: 'ICU RN',
						additionalFields: { location: 'Austin, TX' },
					},
				],
				http,
			),
		);
		expect(http.requests[0].body).toEqual({ title: 'ICU RN', location: 'Austin, TX' });
		expect(created.json).toEqual(JOB);
		const [[fetched]] = await run(
			executeContext([{ resource: 'job', operation: 'get', jobId: JOB.id }], http),
		);
		expect(fetched.json).toEqual(JOB);
		await run(
			executeContext(
				[{ resource: 'job', operation: 'search', search: ' ICU ', filters: { status: 'open' } }],
				http,
			),
		);
		expect(http.requests[2].qs).toEqual({ search: 'ICU', status: 'open', limit: 25 });
	});
});

describe('application and call operations', () => {
	const moved = { id: APPLICATION, stage_id: STAGE, stage_position: 0 };

	it('moves an application found from candidate + job', async () => {
		const http = router({
			[`GET /candidates/${CANDIDATE.id}/applications`]: envelope([
				{ id: 'other', job_id: 'other-job' },
				{ id: APPLICATION, job_id: JOB.id },
			]),
			'POST /pipeline/move': envelope(moved),
		});
		const [[item]] = await run(
			executeContext(
				[
					{
						resource: 'application',
						operation: 'moveStage',
						identifyBy: 'candidateAndJob',
						candidateId: CANDIDATE.id,
						jobId: JOB.id,
						stageId: STAGE,
						reason: '',
					},
				],
				http,
			),
		);
		expect(http.requests[1].body).toEqual({ applicationId: APPLICATION, stageId: STAGE });
		expect(item.json).toEqual(moved);
	});

	it('moves a given application id directly, with a reason', async () => {
		const http = router({ 'POST /pipeline/move': envelope(moved) });
		await run(
			executeContext(
				[
					{
						resource: 'application',
						operation: 'moveStage',
						identifyBy: 'application',
						applicationId: APPLICATION,
						stageId: STAGE,
						reason: 'Client asked',
					},
				],
				http,
			),
		);
		expect(http.requests).toHaveLength(1);
		expect(http.requests[0].body).toEqual({
			applicationId: APPLICATION,
			stageId: STAGE,
			reason: 'Client asked',
		});
	});

	it('explains when the candidate is not on the job', async () => {
		const http = router({ [`GET /candidates/${CANDIDATE.id}/applications`]: envelope([]) });
		const error = await run(
			executeContext(
				[
					{
						resource: 'application',
						operation: 'moveStage',
						identifyBy: 'candidateAndJob',
						candidateId: CANDIDATE.id,
						jobId: JOB.id,
						stageId: STAGE,
					},
				],
				http,
			),
		).catch((caught) => caught);
		expect(error).toBeInstanceOf(NodeOperationError);
		expect(error.message).toContain("not on this job's pipeline");
	});

	it('logs a call outcome', async () => {
		const http = router({
			[`PATCH /communication/calls/${CALL}/disposition`]: envelope({
				id: CALL,
				disposition: 'voicemail',
			}),
		});
		await run(
			executeContext(
				[
					{
						resource: 'call',
						operation: 'logOutcome',
						callId: CALL,
						disposition: 'voicemail',
						note: 'Left a message',
					},
				],
				http,
			),
		);
		expect(http.requests[0]).toMatchObject({
			method: 'PATCH',
			body: { disposition: 'voicemail', note: 'Left a message' },
		});
	});
});

describe('errors, base URL and dropdowns', () => {
	it('wraps API failures as NodeApiError, or returns them as items with Continue On Fail', async () => {
		const http = router({
			'POST /jobs': () => {
				throw new Error('Request failed with status code 403');
			},
		});
		const params = [{ resource: 'job', operation: 'create', title: 'x', additionalFields: {} }];
		await expect(run(executeContext(params, http))).rejects.toBeInstanceOf(NodeApiError);
		const [[item]] = await run(executeContext(params, http, { continueOnFail: true }));
		expect(item).toEqual({
			json: { error: 'Request failed with status code 403' },
			pairedItem: { item: 0 },
		});
	});

	it('uses a custom HTTPS base URL and refuses plain HTTP', async () => {
		const http = router({ [`GET /jobs/${JOB.id}`]: envelope(JOB) });
		await run(
			executeContext([{ resource: 'job', operation: 'get', jobId: JOB.id }], http, {
				credentials: { apiKey: 'k', baseUrl: 'https://staging.example.com/api/v1/' },
			}),
		);
		expect(http.requests[0].url).toBe(`https://staging.example.com/api/v1/jobs/${JOB.id}`);
		const insecure = executeContext([{ resource: 'job', operation: 'get', jobId: JOB.id }], http, {
			credentials: { apiKey: 'k', baseUrl: 'http://api.inferowl.com' },
		});
		await expect(run(insecure)).rejects.toThrow('must start with https://');
	});

	it('loads pipeline stages for the stage dropdown', async () => {
		const http = router({
			'GET /pipeline/stages': envelope([
				{ id: 's1', name: 'Screening' },
				{ id: 's2', slug: 'submitted' },
			]),
		});
		const context = executeContext([{}], http) as unknown as ILoadOptionsFunctions;
		await expect(node.methods.loadOptions.getStages.call(context)).resolves.toEqual([
			{ name: 'Screening', value: 's1' },
			{ name: 'submitted', value: 's2' },
		]);
	});
});
