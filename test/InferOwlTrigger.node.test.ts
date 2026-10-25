import type { IDataObject, IHookFunctions, IWebhookFunctions } from 'n8n-workflow';
import { EVENT_OPTIONS, InferOwlTrigger } from '../nodes/InferOwlTrigger/InferOwlTrigger.node';
import { signBody } from '../nodes/InferOwl/shared/signature';
import { envelope, FIXTURE_CREDENTIAL, router } from './helpers';

const WEBHOOK_URL = 'https://n8n.example.com/webhook/4f1c2b3a/webhook';
const SECRET = `whsec_${'ab'.repeat(24)}`;
const HOOK_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';

const trigger = new InferOwlTrigger();
const lifecycle = trigger.webhookMethods.default;

function hookContext(
	http: ReturnType<typeof router>,
	staticData: IDataObject,
	events: string[] = ['candidate.created'],
) {
	return {
		getNodeWebhookUrl: () => WEBHOOK_URL,
		getNodeParameter: (name: string) => (name === 'events' ? events : undefined),
		getWorkflowStaticData: () => staticData,
		getCredentials: async () => ({
			apiKey: FIXTURE_CREDENTIAL,
			baseUrl: 'https://api.inferowl.com',
		}),
		getNode: () => ({
			id: 'trigger-1',
			name: 'InferOwl Trigger',
			type: 'n8n-nodes-inferowl.inferOwlTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: { httpRequestWithAuthentication: http.httpRequestWithAuthentication },
	} as unknown as IHookFunctions;
}

describe('InferOwl Trigger description', () => {
	it('is a webhook trigger node with no inputs', () => {
		expect(trigger.description).toMatchObject({
			name: 'inferOwlTrigger',
			displayName: 'InferOwl Trigger',
			inputs: [],
			group: ['trigger'],
		});
		expect(trigger.description.webhooks).toEqual([
			{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
		]);
	});

	it('offers every InferOwl webhook event', () => {
		expect(EVENT_OPTIONS.map((option) => option.value).sort()).toEqual([
			'application.created',
			'application.stage_changed',
			'candidate.created',
			'interview.booked',
			'interview.scheduled',
			'interview.status_changed',
			'job.closed',
			'job.created',
			'job.status_changed',
			'placement.started',
			'placement.status_changed',
			'submittal.created',
			'submittal.status_changed',
		]);
	});
});

describe('webhook lifecycle', () => {
	it('checkExists is false without a stored subscription and secret (nothing to verify with)', async () => {
		const http = router({});
		await expect(lifecycle.checkExists.call(hookContext(http, {}))).resolves.toBe(false);
		await expect(
			lifecycle.checkExists.call(hookContext(http, { webhookId: HOOK_ID })),
		).resolves.toBe(false);
		expect(http.requests).toHaveLength(0);
	});

	it('checkExists is true for the stored, active subscription with the same URL and events', async () => {
		const http = router({
			'GET /platform/webhooks': envelope([
				{ id: HOOK_ID, url: WEBHOOK_URL, events: ['candidate.created'], is_active: true },
			]),
		});
		const staticData = { webhookId: HOOK_ID, webhookSecret: SECRET };
		await expect(lifecycle.checkExists.call(hookContext(http, staticData))).resolves.toBe(true);
		expect(http.requests[0]).toMatchObject({
			method: 'GET',
			url: 'https://api.inferowl.com/api/v1/platform/webhooks',
			credentialType: 'inferOwlApi',
		});
	});

	it.each([
		['the events changed', { events: ['job.created'], is_active: true }],
		['it was auto-disabled', { events: ['candidate.created'], is_active: false }],
		['it was deleted in the app', null],
	])('checkExists forgets the stored subscription when %s', async (_label, stored) => {
		const rows = stored ? [{ id: HOOK_ID, url: WEBHOOK_URL, ...stored }] : [];
		const http = router({ 'GET /platform/webhooks': envelope(rows) });
		const staticData: IDataObject = { webhookId: HOOK_ID, webhookSecret: SECRET };
		await expect(lifecycle.checkExists.call(hookContext(http, staticData))).resolves.toBe(false);
		expect(staticData).toEqual({});
	});

	it('create replaces older subscriptions to this URL, subscribes the events and keeps the id and secret', async () => {
		const http = router({
			'GET /platform/webhooks': envelope([
				{ id: 'old-1', url: WEBHOOK_URL, events: ['job.created'] },
				{ id: 'someone-else', url: 'https://hooks.zapier.com/x', events: ['candidate.created'] },
			]),
			'DELETE /platform/webhooks/old-1': { success: true },
			'POST /platform/webhooks': envelope({
				id: HOOK_ID,
				url: WEBHOOK_URL,
				events: ['candidate.created', 'job.created'],
				secret: SECRET,
			}),
		});
		const staticData: IDataObject = {};
		await expect(
			lifecycle.create.call(hookContext(http, staticData, ['candidate.created', 'job.created'])),
		).resolves.toBe(true);
		expect(http.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			'GET https://api.inferowl.com/api/v1/platform/webhooks',
			'DELETE https://api.inferowl.com/api/v1/platform/webhooks/old-1',
			'POST https://api.inferowl.com/api/v1/platform/webhooks',
		]);
		expect(http.requests[2].body).toEqual({
			url: WEBHOOK_URL,
			events: ['candidate.created', 'job.created'],
		});
		expect(staticData).toEqual({ webhookId: HOOK_ID, webhookSecret: SECRET });
	});

	it('create surfaces a refused subscription (for example delivery not enabled)', async () => {
		const http = router({
			'GET /platform/webhooks': envelope([]),
			'POST /platform/webhooks': () => {
				throw new Error(
					'Event delivery (outbound webhooks) is not enabled for this workspace yet.',
				);
			},
		});
		await expect(lifecycle.create.call(hookContext(http, {}))).rejects.toThrow('not enabled');
	});

	it('delete removes the subscription and clears the stored secret', async () => {
		const http = router({ [`DELETE /platform/webhooks/${HOOK_ID}`]: { success: true } });
		const staticData: IDataObject = { webhookId: HOOK_ID, webhookSecret: SECRET };
		await expect(lifecycle.delete.call(hookContext(http, staticData))).resolves.toBe(true);
		expect(staticData).toEqual({});
	});

	it('delete treats an already-removed subscription as deleted, and reports other failures', async () => {
		const notFound = Object.assign(new Error('Not found'), { httpCode: '404' });
		const gone = router({
			[`DELETE /platform/webhooks/${HOOK_ID}`]: () => {
				throw notFound;
			},
		});
		const staticData: IDataObject = { webhookId: HOOK_ID, webhookSecret: SECRET };
		await expect(lifecycle.delete.call(hookContext(gone, staticData))).resolves.toBe(true);
		expect(staticData).toEqual({});

		const forbidden = Object.assign(new Error('Forbidden'), { httpCode: '403' });
		const refused = router({
			[`DELETE /platform/webhooks/${HOOK_ID}`]: () => {
				throw forbidden;
			},
		});
		await expect(
			lifecycle.delete.call(hookContext(refused, { webhookId: HOOK_ID, webhookSecret: SECRET })),
		).resolves.toBe(false);
	});
});

describe('webhook delivery', () => {
	const payload = {
		id: 'evt_42',
		event: 'candidate.created',
		tenant_id: '11111111-1111-4111-8111-111111111111',
		timestamp: '2026-10-25T10:00:00.000Z',
		data: { candidate_id: '3f6c1d2a-8b4e-4c1f-9a7d-2e5b8c0d1f34', created_by: null },
	};
	const raw = JSON.stringify(payload);

	function webhookContext(options: {
		body?: IDataObject;
		rawBody?: Buffer;
		signature?: string;
		secret?: string;
		events?: string[];
		readRawBody?: () => Promise<void>;
	}) {
		const response = {
			statusCode: 200,
			body: undefined as unknown,
			status(code: number) {
				this.statusCode = code;
				return this;
			},
			json(body: unknown) {
				this.body = body;
				return this;
			},
		};
		const request: IDataObject = { rawBody: options.rawBody };
		if (options.readRawBody) request.readRawBody = options.readRawBody.bind(null);
		const context = {
			getRequestObject: () => request,
			getResponseObject: () => response,
			getBodyData: () => options.body ?? payload,
			getHeaderData: () =>
				options.signature === undefined ? {} : { 'x-inferowl-signature': options.signature },
			getWorkflowStaticData: () => ({
				webhookId: HOOK_ID,
				webhookSecret: options.secret ?? SECRET,
			}),
			getNodeParameter: () => options.events ?? ['candidate.created'],
			helpers: { returnJsonArray: (data: IDataObject) => [{ json: data }] },
		};
		return { context: context as unknown as IWebhookFunctions, response, request };
	}

	it('runs the workflow for a correctly signed event, flattened', async () => {
		const { context } = webhookContext({
			rawBody: Buffer.from(raw),
			signature: signBody(SECRET, raw),
		});
		await expect(trigger.webhook.call(context)).resolves.toEqual({
			workflowData: [
				[
					{
						json: {
							id: 'evt_42',
							event: 'candidate.created',
							occurred_at: '2026-10-25T10:00:00.000Z',
							...payload.data,
						},
					},
				],
			],
		});
	});

	it('answers 401 and runs nothing for a bad, missing or foreign signature', async () => {
		for (const signature of [signBody('whsec_other', raw), undefined, 'not-hex']) {
			const { context, response } = webhookContext({ rawBody: Buffer.from(raw), signature });
			await expect(trigger.webhook.call(context)).resolves.toEqual({ noWebhookResponse: true });
			expect(response.statusCode).toBe(401);
		}
	});

	it('rejects a body altered after signing', async () => {
		const tampered = raw.replace('evt_42', 'evt_43');
		const { context, response } = webhookContext({
			rawBody: Buffer.from(tampered),
			signature: signBody(SECRET, raw),
		});
		await expect(trigger.webhook.call(context)).resolves.toEqual({ noWebhookResponse: true });
		expect(response.statusCode).toBe(401);
	});

	it('reads the raw body when n8n has not buffered it yet', async () => {
		let request: IDataObject = {};
		const readRawBody = jest.fn(async () => {
			request.rawBody = Buffer.from(raw);
		});
		const built = webhookContext({ signature: signBody(SECRET, raw), readRawBody });
		request = built.request;
		const result = await trigger.webhook.call(built.context);
		expect(readRawBody).toHaveBeenCalled();
		expect(result.workflowData).toBeDefined();
	});

	it('falls back to the re-serialised JSON body when no raw body is available', async () => {
		const { context } = webhookContext({ signature: signBody(SECRET, raw) });
		await expect(trigger.webhook.call(context)).resolves.toHaveProperty('workflowData');
	});

	it('acknowledges the settings test ping and unselected events without running the workflow', async () => {
		const ping = { id: 'x', event: 'webhook.test', data: { message: 'hi' } };
		const pingRaw = JSON.stringify(ping);
		const { context } = webhookContext({
			body: ping,
			rawBody: Buffer.from(pingRaw),
			signature: signBody(SECRET, pingRaw),
		});
		await expect(trigger.webhook.call(context)).resolves.toEqual({
			webhookResponse: { received: true },
		});
		const other = webhookContext({
			rawBody: Buffer.from(raw),
			signature: signBody(SECRET, raw),
			events: ['job.created'],
		});
		await expect(trigger.webhook.call(other.context)).resolves.toEqual({
			webhookResponse: { received: true },
		});
	});

	it('refuses deliveries when no secret is stored', async () => {
		const { context, response } = webhookContext({
			rawBody: Buffer.from(raw),
			signature: signBody(SECRET, raw),
			secret: '',
		});
		await expect(trigger.webhook.call(context)).resolves.toEqual({ noWebhookResponse: true });
		expect(response.statusCode).toBe(401);
	});
});
