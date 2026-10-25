import { InferOwlApi } from '../credentials/InferOwlApi.credentials';
import { createHmac } from 'crypto';
import { isValidSignature, signBody, TOLERANCE_SEC } from '../nodes/InferOwl/shared/signature';
import { apiBase, compact, toDate, toList, unwrap } from '../nodes/InferOwl/shared/transport';
import packageJson from '../package.json';

describe('signature', () => {
	const NOW_MS = 1_700_000_000_000;
	const NOW = NOW_MS / 1000;

	it('signs like the InferOwl delivery worker (hex HMAC-SHA256 of `${timestamp}.${rawBody}`)', () => {
		// printf '%s' '1700000000.{"a":1}' | openssl dgst -sha256 -hmac whsec_test
		expect(signBody('whsec_test', 1700000000, '{"a":1}')).toBe(
			'38877139021993b830af32feea6e18a8da83eb2f6e49ee50bd9e4cf4ca4d3789',
		);
		expect(signBody('whsec_test', 1700000000, Buffer.from('{"a":1}'))).toBe(
			signBody('whsec_test', 1700000000, '{"a":1}'),
		);
	});

	it('accepts only the matching signature', () => {
		const good = signBody('s', NOW, 'body');
		const ts = String(NOW);
		expect(isValidSignature('s', 'body', good, ts, NOW_MS)).toBe(true);
		expect(isValidSignature('s', 'body', good.toUpperCase(), ts, NOW_MS)).toBe(true);
		expect(isValidSignature('s', 'body', [good], [ts], NOW_MS)).toBe(true);
		expect(isValidSignature('s', 'body2', good, ts, NOW_MS)).toBe(false);
		expect(isValidSignature('t', 'body', good, ts, NOW_MS)).toBe(false);
		expect(isValidSignature('s', 'body', '', ts, NOW_MS)).toBe(false);
		expect(isValidSignature('s', 'body', undefined, ts, NOW_MS)).toBe(false);
		expect(isValidSignature('s', 'body', good.slice(1), ts, NOW_MS)).toBe(false);
	});

	it('accepts a valid signature within the 5-minute tolerance, either side of now', () => {
		expect(TOLERANCE_SEC).toBe(300);
		for (const ts of [NOW - 300, NOW - 1, NOW + 60]) {
			expect(isValidSignature('s', 'body', signBody('s', ts, 'body'), String(ts), NOW_MS)).toBe(
				true,
			);
		}
	});

	it('rejects a stale timestamp even when the signature over it is valid', () => {
		for (const ts of [NOW - 301, NOW + 301]) {
			expect(isValidSignature('s', 'body', signBody('s', ts, 'body'), String(ts), NOW_MS)).toBe(
				false,
			);
		}
	});

	it('rejects a tampered, missing or malformed timestamp', () => {
		const good = signBody('s', NOW - 20, 'body');
		expect(isValidSignature('s', 'body', good, String(NOW - 10), NOW_MS)).toBe(false);
		expect(isValidSignature('s', 'body', good, undefined, NOW_MS)).toBe(false);
		expect(isValidSignature('s', 'body', good, '', NOW_MS)).toBe(false);
		expect(isValidSignature('s', 'body', good, `${NOW - 20}.5`, NOW_MS)).toBe(false);
	});

	it('rejects the old body-only signature', () => {
		const bodyOnly = createHmac('sha256', 's').update('body').digest('hex');
		expect(isValidSignature('s', 'body', bodyOnly, String(NOW), NOW_MS)).toBe(false);
	});
});

describe('transport helpers', () => {
	it('resolves the API root from the credential base URL', () => {
		expect(apiBase(undefined)).toBe('https://api.inferowl.com/api/v1');
		expect(apiBase('https://api.inferowl.com/')).toBe('https://api.inferowl.com/api/v1');
		expect(apiBase('https://staging.example.com/api/v1')).toBe(
			'https://staging.example.com/api/v1',
		);
		expect(() => apiBase('http://api.inferowl.com')).toThrow('https://');
		expect(() => apiBase('not a url')).toThrow('not a valid');
	});

	it('compacts, splits lists, trims dates and unwraps the envelope', () => {
		expect(compact({ a: '', b: ' ', c: null, d: [], e: 0, f: false, g: 'x' })).toEqual({
			e: 0,
			f: false,
			g: 'x',
		});
		expect(toList('BLS, ACLS ,')).toEqual(['BLS', 'ACLS']);
		expect(toList('')).toBeUndefined();
		expect(toDate('2026-12-01T00:00:00Z')).toBe('2026-12-01');
		expect(unwrap({ success: true, data: [1] })).toEqual([1]);
		expect(unwrap([2])).toEqual([2]);
	});
});

describe('credentials', () => {
	const credential = new InferOwlApi();

	it('sends the key as a bearer token and keeps it a password field', () => {
		expect(credential.name).toBe('inferOwlApi');
		expect(credential.authenticate).toEqual({
			type: 'generic',
			properties: { headers: { Authorization: '=Bearer {{$credentials.apiKey}}' } },
		});
		expect(credential.properties.find((property) => property.name === 'apiKey')).toMatchObject({
			typeOptions: { password: true },
			required: true,
		});
		expect(credential.properties.find((property) => property.name === 'baseUrl')).toMatchObject({
			default: 'https://api.inferowl.com',
		});
	});

	it('tests the credential against the webhook list on the configured base URL', () => {
		expect(credential.test.request).toMatchObject({ url: '/platform/webhooks', method: 'GET' });
		// Same normalisation as apiBase(): default origin, no trailing slash, /api/v1 appended once.
		expect(credential.test.request.baseURL).toBe(
			'={{(($credentials.baseUrl || "https://api.inferowl.com").replace(/\\/+$/, "").replace(/\\/api\\/v1$/, "")) + "/api/v1"}}',
		);
	});
});

describe('package', () => {
	it('is an n8n community node package listing both nodes and the credential', () => {
		expect(packageJson.keywords).toContain('n8n-community-node-package');
		expect(packageJson.n8n).toEqual({
			n8nNodesApiVersion: 1,
			strict: true,
			credentials: ['dist/credentials/InferOwlApi.credentials.js'],
			nodes: [
				'dist/nodes/InferOwl/InferOwl.node.js',
				'dist/nodes/InferOwlTrigger/InferOwlTrigger.node.js',
			],
		});
		expect(packageJson).not.toHaveProperty('dependencies');
	});
});
