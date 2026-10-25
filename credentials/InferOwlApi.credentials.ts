import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class InferOwlApi implements ICredentialType {
	name = 'inferOwlApi';

	displayName = 'InferOwl API';

	icon: Icon = { light: 'file:../icons/inferowl.svg', dark: 'file:../icons/inferowl.dark.svg' };

	documentationUrl =
		'https://github.com/InferOwl/n8n-nodes-inferowl?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'An InferOwl API key (starts with iow_). Owners create keys in Settings → API Keys. The credential test needs the webhooks:manage scope.',
		},
		{
			displayName: 'API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.inferowl.com',
			description:
				'Leave as https://api.inferowl.com unless InferOwl support gave you another address',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{(($credentials.baseUrl || "https://api.inferowl.com").replace(/\\/+$/, "").replace(/\\/api\\/v1$/, "")) + "/api/v1"}}',
			url: '/platform/webhooks',
			method: 'GET',
		},
	};
}
