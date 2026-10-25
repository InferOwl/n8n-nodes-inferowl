import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, isValidSignature } from '../InferOwl/shared/signature';
import { inferOwlApiRequest } from '../InferOwl/shared/transport';

// The InferOwl webhook event catalog (WEBHOOK_EVENT_CATALOG in @inferowl/shared-config).
export const EVENT_OPTIONS = [
	{ name: 'Candidate Added to Job', value: 'application.created' },
	{ name: 'Candidate Created', value: 'candidate.created' },
	{ name: 'Client Interview Scheduled', value: 'interview.scheduled' },
	{ name: 'Interview Booked', value: 'interview.booked' },
	{ name: 'Interview Booking Changed', value: 'interview.status_changed' },
	{ name: 'Job Closed or Filled', value: 'job.closed' },
	{ name: 'Job Created', value: 'job.created' },
	{ name: 'Job Status Changed', value: 'job.status_changed' },
	{ name: 'Pipeline Stage Changed', value: 'application.stage_changed' },
	{ name: 'Placement Started', value: 'placement.started' },
	{ name: 'Placement Status Changed', value: 'placement.status_changed' },
	{ name: 'Submittal Created', value: 'submittal.created' },
	{ name: 'Submittal Status Changed', value: 'submittal.status_changed' },
];

interface Subscription {
	id: string;
	url: string;
	events?: string[] | null;
	is_active?: boolean | null;
	secret?: string;
}

const sameEvents = (a: string[] | null | undefined, b: string[]) =>
	Array.isArray(a) && a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

const isNotFound = (error: unknown) => {
	const candidate = error as {
		httpCode?: string | number;
		response?: { status?: number };
		statusCode?: number;
	};
	return (
		String(candidate?.httpCode ?? candidate?.response?.status ?? candidate?.statusCode ?? '') ===
		'404'
	);
};

export class InferOwlTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'InferOwl Trigger',
		name: 'inferOwlTrigger',
		icon: { light: 'file:../../icons/inferowl.svg', dark: 'file:../../icons/inferowl.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in your InferOwl workspace',
		defaults: {
			name: 'InferOwl Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'inferOwlApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENT_OPTIONS,
				required: true,
				default: ['candidate.created'],
				description: 'The InferOwl events that start the workflow',
			},
			{
				displayName:
					'InferOwl only delivers to public HTTPS addresses, and only once event delivery is enabled for the workspace (ask InferOwl support). The API key needs the webhooks:manage scope and an owner as its creator.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];
				const staticData = this.getWorkflowStaticData('node');
				// Without the secret no delivery could be verified, so a subscription we cannot match is recreated.
				if (!staticData.webhookId || !staticData.webhookSecret) return false;
				const subscriptions = ((await inferOwlApiRequest.call(this, 'GET', '/platform/webhooks')) ??
					[]) as Subscription[];
				const existing = subscriptions.find(
					(subscription) => subscription.id === staticData.webhookId,
				);
				if (
					existing &&
					existing.url === webhookUrl &&
					existing.is_active !== false &&
					sameEvents(existing.events, events)
				) {
					return true;
				}
				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const events = this.getNodeParameter('events') as string[];
				const staticData = this.getWorkflowStaticData('node');

				// The n8n URL is unique to this node: older subscriptions to it (lost secret,
				// changed events, auto-disabled) are this node's own and are replaced.
				const subscriptions = ((await inferOwlApiRequest.call(this, 'GET', '/platform/webhooks')) ??
					[]) as Subscription[];
				for (const stale of subscriptions.filter(
					(subscription) => subscription.url === webhookUrl,
				)) {
					try {
						await inferOwlApiRequest.call(
							this,
							'DELETE',
							`/platform/webhooks/${encodeURIComponent(stale.id)}`,
						);
					} catch (error) {
						if (!isNotFound(error)) throw new NodeApiError(this.getNode(), error as JsonObject);
					}
				}

				const created = (await inferOwlApiRequest.call(this, 'POST', '/platform/webhooks', {
					body: { url: webhookUrl, events },
				})) as Subscription;
				if (!created?.id || !created.secret) return false;
				staticData.webhookId = created.id;
				staticData.webhookSecret = created.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.webhookId) {
					try {
						await inferOwlApiRequest.call(
							this,
							'DELETE',
							`/platform/webhooks/${encodeURIComponent(String(staticData.webhookId))}`,
						);
					} catch (error) {
						if (!isNotFound(error)) return false;
					}
				}
				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const staticData = this.getWorkflowStaticData('node');
		const secret = typeof staticData.webhookSecret === 'string' ? staticData.webhookSecret : '';

		let rawBody: Buffer | string | undefined = request.rawBody;
		if (!rawBody && typeof request.readRawBody === 'function') {
			await request.readRawBody();
			rawBody = request.rawBody;
		}
		// InferOwl signs JSON.stringify(payload); re-serialising the parsed body is the fallback.
		const signedBody = rawBody ?? JSON.stringify(this.getBodyData());

		const headers = this.getHeaderData();
		// A missing, altered or stale (over 5 minutes) timestamp fails too: that is the replay guard.
		if (
			!secret ||
			!isValidSignature(secret, signedBody, headers[SIGNATURE_HEADER], headers[TIMESTAMP_HEADER])
		) {
			const response = this.getResponseObject();
			response.status(401).json({ message: 'Invalid or expired InferOwl signature' });
			return { noWebhookResponse: true };
		}

		const payload = this.getBodyData() as IDataObject;
		const events = this.getNodeParameter('events') as string[];
		// The "Send test" ping from Settings → Webhooks and unselected events are acknowledged, not run.
		if (typeof payload.event !== 'string' || !events.includes(payload.event)) {
			return { webhookResponse: { received: true } };
		}

		const data = (payload.data ?? {}) as IDataObject;
		return {
			workflowData: [
				this.helpers.returnJsonArray({
					id: payload.id,
					event: payload.event,
					occurred_at: payload.timestamp,
					...data,
				}),
			],
		};
	}
}
