import type { IDataObject, IHttpRequestOptions, INodeExecutionData } from 'n8n-workflow';

// A made-up iow_-shaped value; never a real key.
export const FIXTURE_CREDENTIAL = `iow_${'0'.repeat(60)}`;

export interface RecordedRequest extends IHttpRequestOptions {
	credentialType: string;
}

export type Responder = (request: RecordedRequest) => unknown;

/** Answers requests from a "METHOD /path" table; an unexpected request fails the test. */
export function router(routes: Record<string, unknown | Responder>) {
	const requests: RecordedRequest[] = [];
	const httpRequestWithAuthentication = jest.fn(
		async (credentialType: string, options: IHttpRequestOptions) => {
			const request = { ...options, credentialType };
			requests.push(request);
			const key = `${options.method} ${String(options.url).split('/api/v1')[1] ?? options.url}`;
			if (!(key in routes)) throw new Error(`Unexpected request ${key}`);
			const route = routes[key];
			return typeof route === 'function' ? (route as Responder)(request) : route;
		},
	);
	return { requests, httpRequestWithAuthentication };
}

export const envelope = (data: unknown) => ({ success: true, data });

const returnJsonArray = (data: IDataObject | IDataObject[]): INodeExecutionData[] =>
	(Array.isArray(data) ? data : [data]).map((json) => ({ json }));

const constructExecutionMetaData = (
	items: INodeExecutionData[],
	options: { itemData: { item: number } },
) => items.map((item) => ({ ...item, pairedItem: options.itemData }));

/** A minimal IExecuteFunctions: parameters per item, one input item per parameter set. */
export function executeContext(
	parameterSets: IDataObject[],
	http: ReturnType<typeof router>,
	options: { continueOnFail?: boolean; credentials?: IDataObject } = {},
) {
	return {
		getInputData: () => parameterSets.map(() => ({ json: {} })),
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			const value = parameterSets[itemIndex][name];
			return value === undefined ? fallback : value;
		},
		getCredentials: async () =>
			options.credentials ?? { apiKey: FIXTURE_CREDENTIAL, baseUrl: 'https://api.inferowl.com' },
		getNode: () => ({
			id: 'node-1',
			name: 'InferOwl',
			type: 'n8n-nodes-inferowl.inferOwl',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => options.continueOnFail === true,
		helpers: {
			httpRequestWithAuthentication: http.httpRequestWithAuthentication,
			returnJsonArray,
			constructExecutionMetaData,
		},
	};
}
