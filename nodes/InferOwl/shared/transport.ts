import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const DEFAULT_BASE_URL = 'https://api.inferowl.com';

export type InferOwlContext =
	| IExecuteFunctions
	| IHookFunctions
	| ILoadOptionsFunctions
	| IWebhookFunctions;

/** The API root for a credential: an HTTPS origin, with or without /api/v1, else production. */
export function apiBase(baseUrl: unknown): string {
	const raw = typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL;
	const url = URL.canParse(raw) ? new URL(raw) : null;
	if (!url) throw new Error(`"${raw}" is not a valid API base URL. Use ${DEFAULT_BASE_URL}.`);
	if (url.protocol !== 'https:')
		throw new Error('The InferOwl API base URL must start with https://');
	const path = url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '');
	return `${url.origin}${path}/api/v1`;
}

/** Drop empty optional values: the API validates strictly and rejects "" for typed fields. */
export function compact(input: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(input)) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && value.trim() === '') continue;
		if (Array.isArray(value) && value.length === 0) continue;
		out[key] = value;
	}
	return out;
}

/** "BLS, ACLS" or ["BLS"] → ["BLS", "ACLS"]. */
export function toList(value: unknown): string[] | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const list = Array.isArray(value) ? value : String(value).split(',');
	const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
	return cleaned.length ? cleaned : undefined;
}

/** "2026-12-01T00:00:00Z" → "2026-12-01"; the API's date columns are dates. */
export function toDate(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;
	const text = String(value);
	return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

/** Unwraps the API's { success, data } envelope. */
export function unwrap<T = unknown>(body: unknown): T {
	if (body && typeof body === 'object' && 'data' in (body as IDataObject))
		return (body as IDataObject).data as T;
	return body as T;
}

/** The record (or records) of an API call, without the { success, data } envelope. */
export async function inferOwlApiRequest(
	this: InferOwlContext,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject } = {},
): Promise<unknown> {
	return unwrap(await inferOwlApiRawRequest.call(this, method, path, options));
}

/** The whole response body, for lists whose envelope carries total / page / totalPages. */
export async function inferOwlApiRawRequest(
	this: InferOwlContext,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject } = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('inferOwlApi');
	let base: string;
	try {
		base = apiBase(credentials.baseUrl);
	} catch (error) {
		throw new NodeOperationError(this.getNode(), (error as Error).message);
	}
	const request: IHttpRequestOptions = {
		method,
		url: `${base}${path}`,
		json: true,
		headers: { Accept: 'application/json' },
	};
	if (options.qs && Object.keys(options.qs).length) request.qs = options.qs;
	if (options.body) request.body = options.body;
	return await this.helpers.httpRequestWithAuthentication.call(this, 'inferOwlApi', request);
}
