import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_HEADER = 'x-inferowl-signature';

/** Hex HMAC-SHA256 of the raw body with the subscription secret, as InferOwl signs deliveries. */
export function signBody(secret: string, rawBody: string | Buffer): string {
	return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function isValidSignature(
	secret: string,
	rawBody: string | Buffer,
	received: unknown,
): boolean {
	const value = Array.isArray(received) ? received[0] : received;
	if (typeof value !== 'string' || !value) return false;
	const expected = Buffer.from(signBody(secret, rawBody), 'utf8');
	const actual = Buffer.from(value.trim().toLowerCase(), 'utf8');
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
