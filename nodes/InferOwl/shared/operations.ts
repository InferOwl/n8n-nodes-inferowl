import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { compact, inferOwlApiRawRequest, inferOwlApiRequest, toDate, toList } from './transport';

const enc = encodeURIComponent;

/** GET /candidates/:id and /jobs/:id add in-app agent suggestions, which are not part of the record. */
const withoutSuggestions = (record: IDataObject | undefined): IDataObject => {
	const copy = { ...(record ?? {}) };
	delete copy.agent_suggestions;
	return copy;
};

const numberOrUndefined = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Node field names (camelCase) → CreateCandidateDto / UpdateCandidateDto fields. */
export function candidateBody(fields: IDataObject): IDataObject {
	return compact({
		full_name: fields.fullName,
		first_name: fields.firstName,
		last_name: fields.lastName,
		email: fields.email,
		phone: fields.phone,
		city: fields.city,
		state: fields.state,
		zip: fields.zip,
		country: fields.country,
		profession: fields.profession,
		primary_specialty: fields.primarySpecialty,
		secondary_specialty: fields.secondarySpecialty,
		candidate_type: fields.candidateType,
		work_auth_status: fields.workAuthStatus,
		availability_date: toDate(fields.availabilityDate),
		experience_years: numberOrUndefined(fields.experienceYears),
		pay_expectation_min: numberOrUndefined(fields.payExpectationMin),
		pay_expectation_max: numberOrUndefined(fields.payExpectationMax),
		willing_to_relocate:
			typeof fields.willingToRelocate === 'boolean' ? fields.willingToRelocate : undefined,
		skills: toList(fields.skills),
		certifications: toList(fields.certifications),
		bilingual_languages: toList(fields.languages),
		referral_source: fields.referralSource,
		source: fields.source,
		status: fields.status,
	});
}

/** Node field names → CreateJobDto fields. */
export function jobBody(title: string, fields: IDataObject): IDataObject {
	return compact({
		title,
		description: fields.description,
		initial_status: fields.initialStatus,
		job_number: fields.jobNumber,
		profession: fields.profession,
		specialty: fields.specialty,
		location: fields.location,
		facility_name: fields.facilityName,
		department: fields.department,
		employment_type: fields.employmentType,
		contract_type: fields.contractType,
		shift_type: fields.shiftType,
		weekly_hours: numberOrUndefined(fields.weeklyHours),
		openings: numberOrUndefined(fields.openings),
		assignment_start_date: toDate(fields.assignmentStartDate),
		length_weeks: numberOrUndefined(fields.lengthWeeks),
		bill_rate: numberOrUndefined(fields.billRate),
		pay_rate: numberOrUndefined(fields.payRate),
		required_certifications: toList(fields.requiredCertifications),
		is_exclusive: typeof fields.isExclusive === 'boolean' ? fields.isExclusive : undefined,
		client_id: fields.clientId,
	});
}

const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

/** Same number whether or not either side carries the +1 country code. */
export function samePhone(a: unknown, b: unknown): boolean {
	const left = digits(a);
	const right = digits(b);
	if (!left || !right) return false;
	return (
		left === right ||
		(left.slice(-10) === right.slice(-10) && Math.min(left.length, right.length) >= 10)
	);
}

async function searchCandidates(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject[]> {
	const searchBy = this.getNodeParameter('searchBy', itemIndex) as 'email' | 'phone' | 'name';
	const value = String(this.getNodeParameter('searchValue', itemIndex) ?? '').trim();
	if (!value)
		throw new NodeOperationError(this.getNode(), 'Enter a value to search for', { itemIndex });
	const term =
		searchBy === 'phone'
			? digits(value).slice(-10) || value
			: searchBy === 'email'
				? value.toLowerCase()
				: value;
	const candidates = ((await inferOwlApiRequest.call(this, 'GET', '/candidates', {
		qs: { search: term, limit: 25 },
	})) ?? []) as IDataObject[];
	if (searchBy === 'email')
		return candidates.filter((candidate) => String(candidate.email ?? '').toLowerCase() === term);
	if (searchBy === 'phone')
		return candidates.filter((candidate) => samePhone(candidate.phone, value));
	return candidates;
}

async function resolveApplicationId(this: IExecuteFunctions, itemIndex: number): Promise<string> {
	const identifyBy = this.getNodeParameter('identifyBy', itemIndex) as string;
	if (identifyBy === 'application')
		return this.getNodeParameter('applicationId', itemIndex) as string;
	const candidateId = this.getNodeParameter('candidateId', itemIndex) as string;
	const jobId = this.getNodeParameter('jobId', itemIndex) as string;
	const applications = ((await inferOwlApiRequest.call(
		this,
		'GET',
		`/candidates/${enc(candidateId)}/applications`,
	)) ?? []) as IDataObject[];
	const match = applications.find((application) => application.job_id === jobId);
	if (!match) {
		throw new NodeOperationError(this.getNode(), "The candidate is not on this job's pipeline", {
			itemIndex,
			description: 'Add the candidate to the job in InferOwl first, or pass an application ID.',
		});
	}
	return String(match.id);
}

/** The API's list page size cap. */
const PAGE_SIZE = 100;

/** The pipeline:read list routes (paged with page / limit) and their n8n filter names. */
const LISTS: Record<string, { path: string; qs: (filters: IDataObject) => IDataObject }> = {
	submittal: {
		path: '/submittals',
		qs: (filters) => ({
			candidate_id: filters.candidateId,
			client_id: filters.clientId,
			job_id: filters.jobId,
			status: filters.status,
			submitted_after: filters.submittedAfter,
			submitted_before: filters.submittedBefore,
		}),
	},
	clientInterview: {
		path: '/submittals/interviews',
		qs: (filters) => ({
			candidate_id: filters.candidateId,
			job_id: filters.jobId,
			submittal_id: filters.submittalId,
			status: filters.status,
			outcome: filters.outcome,
			scheduled_after: filters.scheduledAfter,
			scheduled_before: filters.scheduledBefore,
			sort: 'created_at',
			order: 'desc',
		}),
	},
	interviewBooking: {
		path: '/interviews/bookings',
		qs: (filters) => ({
			candidate_id: filters.candidateId,
			job_id: filters.jobId,
			status: filters.status,
			sort: 'created_at',
			order: 'desc',
		}),
	},
	placement: {
		path: '/assignments',
		qs: (filters) => ({
			candidate_id: filters.candidateId,
			client_id: filters.clientId,
			status: filters.status,
			ending_in: numberOrUndefined(filters.endingIn),
			sort: 'created_at',
			order: 'desc',
		}),
	},
};

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);

const GETS: Record<string, { parameter: string; path: (id: string) => string }> = {
	submittal: { parameter: 'submittalId', path: (id) => `/submittals/${enc(id)}` },
	clientInterview: {
		parameter: 'interviewId',
		path: (id) => `/submittals/interviews/${enc(id)}`,
	},
	interviewBooking: { parameter: 'bookingId', path: (id) => `/interviews/bookings/${enc(id)}` },
	placement: { parameter: 'placementId', path: (id) => `/assignments/${enc(id)}` },
};

const ID_LABELS: Record<string, string> = {
	candidateId: 'Candidate ID',
	jobId: 'Job ID',
	submittalId: 'Submittal ID',
	interviewId: 'Interview ID',
	bookingId: 'Booking ID',
	placementId: 'Placement ID',
};

/**
 * The trimmed record id; an empty one would turn GET /resource/:id into the
 * list route (or a 404 on the wrong path), so it is refused here.
 */
function requiredId(this: IExecuteFunctions, parameter: string, itemIndex: number): string {
	const id = String(this.getNodeParameter(parameter, itemIndex) ?? '').trim();
	if (!id) {
		throw new NodeOperationError(this.getNode(), `${ID_LABELS[parameter] ?? parameter} is empty`, {
			itemIndex,
			description: 'Enter the record ID, or map it from the event or a previous node.',
		});
	}
	return id;
}

async function listRecords(
	this: IExecuteFunctions,
	resource: string,
	itemIndex: number,
): Promise<IDataObject[]> {
	const list = LISTS[resource];
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? PAGE_SIZE : (this.getNodeParameter('limit', itemIndex, 50) as number);
	const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	const qs = compact(list.qs(filters));
	const records: IDataObject[] = [];
	for (let page = 1; ; page++) {
		const body = ((await inferOwlApiRawRequest.call(this, 'GET', list.path, {
			qs: { ...qs, page, limit },
		})) ?? {}) as IDataObject;
		const rows = Array.isArray(body.data) ? (body.data as IDataObject[]) : [];
		records.push(...rows);
		if (!returnAll || rows.length === 0 || page >= Number(body.totalPages ?? 0)) break;
	}
	return records;
}

/** Runs one operation for one input item; returns the record(s) it produced. */
export async function runOperation(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<IDataObject | IDataObject[]> {
	if (resource === 'candidate') {
		if (operation === 'create') {
			const fullName = this.getNodeParameter('fullName', itemIndex) as string;
			const fields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
			const body = candidateBody({ ...fields, fullName });
			return (await inferOwlApiRequest.call(this, 'POST', '/candidates', { body })) as IDataObject;
		}
		if (operation === 'update') {
			const candidateId = this.getNodeParameter('candidateId', itemIndex) as string;
			const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
			const body = candidateBody(fields);
			if (Object.keys(body).length === 0) {
				throw new NodeOperationError(this.getNode(), 'Add at least one field to update', {
					itemIndex,
				});
			}
			return (await inferOwlApiRequest.call(this, 'PATCH', `/candidates/${enc(candidateId)}`, {
				body,
			})) as IDataObject;
		}
		if (operation === 'get') {
			const candidateId = requiredId.call(this, 'candidateId', itemIndex);
			return withoutSuggestions(
				(await inferOwlApiRequest.call(
					this,
					'GET',
					`/candidates/${enc(candidateId)}`,
				)) as IDataObject,
			);
		}
		if (operation === 'search') return searchCandidates.call(this, itemIndex);
	}

	if (resource === 'job') {
		if (operation === 'create') {
			const title = this.getNodeParameter('title', itemIndex) as string;
			const fields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
			return (await inferOwlApiRequest.call(this, 'POST', '/jobs', {
				body: jobBody(title, fields),
			})) as IDataObject;
		}
		if (operation === 'get') {
			const jobId = requiredId.call(this, 'jobId', itemIndex);
			return withoutSuggestions(
				(await inferOwlApiRequest.call(this, 'GET', `/jobs/${enc(jobId)}`)) as IDataObject,
			);
		}
		if (operation === 'search') {
			const search = String(this.getNodeParameter('search', itemIndex) ?? '').trim();
			const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
			const qs = compact({ search, status: filters.status, limit: 25 });
			return ((await inferOwlApiRequest.call(this, 'GET', '/jobs', { qs })) ?? []) as IDataObject[];
		}
	}

	if (resource === 'application' && operation === 'moveStage') {
		const applicationId = await resolveApplicationId.call(this, itemIndex);
		const stageId = this.getNodeParameter('stageId', itemIndex) as string;
		const reason = this.getNodeParameter('reason', itemIndex, '') as string;
		const body = compact({ applicationId, stageId, reason });
		return (await inferOwlApiRequest.call(this, 'POST', '/pipeline/move', { body })) as IDataObject;
	}

	if (has(GETS, resource) && operation === 'get') {
		const { parameter, path } = GETS[resource];
		const id = requiredId.call(this, parameter, itemIndex);
		return (await inferOwlApiRequest.call(this, 'GET', path(id))) as IDataObject;
	}
	if (has(LISTS, resource) && operation === 'getAll')
		return listRecords.call(this, resource, itemIndex);

	if (resource === 'call' && operation === 'logOutcome') {
		const callId = this.getNodeParameter('callId', itemIndex) as string;
		const disposition = this.getNodeParameter('disposition', itemIndex) as string;
		const note = this.getNodeParameter('note', itemIndex, '') as string;
		return (await inferOwlApiRequest.call(
			this,
			'PATCH',
			`/communication/calls/${enc(callId)}/disposition`,
			{
				body: compact({ disposition, note }),
			},
		)) as IDataObject;
	}

	throw new NodeOperationError(
		this.getNode(),
		`Unsupported operation "${operation}" for "${resource}"`,
		{ itemIndex },
	);
}
