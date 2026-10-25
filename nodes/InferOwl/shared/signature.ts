import { createHmac, timingSafeEqual } from 'crypto';

export const SIGNATURE_HEADER = 'x-inferowl-signature';
export const TIMESTAMP_HEADER = 'x-inferowl-timestamp';
/** How far (seconds) a delivery's timestamp may be from now; older deliveries are treated as replays. */
export const TOLERANCE_SEC = 300;

/** Hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the subscription secret, as InferOwl signs deliveries. */
export function signBody(secret: string, timestamp: number, rawBody: string | Buffer): string {
	return createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
}

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

export function isValidSignature(
	secret: string,
	rawBody: string | Buffer,
	received: unknown,
	timestampHeader: unknown,
	nowMs: number = Date.now(),
): boolean {
	const signature = firstValue(received);
	const timestampText = firstValue(timestampHeader);
	if (typeof signature !== 'string' || !signature) return false;
	if (typeof timestampText !== 'string' || !/^\d+$/.test(timestampText.trim())) return false;
	const timestamp = Number(timestampText.trim());
	if (Math.abs(Math.floor(nowMs / 1000) - timestamp) > TOLERANCE_SEC) return false;
	const expected = Buffer.from(signBody(secret, timestamp, rawBody), 'utf8');
	const actual = Buffer.from(signature.trim().toLowerCase(), 'utf8');
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}
