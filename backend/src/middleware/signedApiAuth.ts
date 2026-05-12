import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { AuthRequest } from './auth';

const SIGNATURE_MAX_SKEW_MS = 5 * 60 * 1000;

function normalizeTimestamp(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new AppError(401, 'Invalid X-CP-Timestamp');
  }
  return raw.length <= 10 ? parsed * 1000 : parsed;
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function requireSignedApiAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const apiKey = (req.headers['x-api-key'] as string | undefined)?.trim();
  if (!apiKey) {
    throw new AppError(401, 'X-API-Key header is required');
  }

  const timestampRaw = (req.headers['x-cp-timestamp'] as string | undefined)?.trim();
  const signatureRaw = (req.headers['x-cp-signature'] as string | undefined)?.trim().toLowerCase();

  if (!timestampRaw || !signatureRaw) {
    throw new AppError(401, 'Signed request required: provide X-CP-Timestamp and X-CP-Signature headers');
  }

  const timestampMs = normalizeTimestamp(timestampRaw);
  if (Math.abs(Date.now() - timestampMs) > SIGNATURE_MAX_SKEW_MS) {
    throw new AppError(401, 'Request timestamp is too old or too far in the future');
  }

  const method = req.method.toUpperCase();
  const path = (req.originalUrl || req.url || '').split('?')[0] || '/';
  const bodyPayload = method === 'GET' ? '' : JSON.stringify(req.body || {});
  const bodyHash = sha256Hex(bodyPayload);
  const payload = method + '\n' + path + '\n' + timestampRaw + '\n' + bodyHash;
  const expected = crypto.createHmac('sha256', apiKey).update(payload).digest('hex');

  const providedBuffer = Buffer.from(signatureRaw, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new AppError(401, 'Invalid request signature');
  }

  next();
}
