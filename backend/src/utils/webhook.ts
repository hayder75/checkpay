import axios from 'axios';
import crypto from 'crypto';
import { Transaction } from '@prisma/client';

interface WebhookPayload {
    success: boolean;
    data: {
        confirmed: boolean;
        matchType: string;
        txnId: string;
        referenceTxnId: string | null;
        amount: number;
        sender: string;
        bank: string | null;
        receivedAt: Date;
        verifiedAt: Date;
        business?: { id: string; name: string | null } | null;
        employee?: { id: string; name: string } | null;
        source: string;
    };
}

const WEBHOOK_TIMEOUT_MS = 3000;
const MAX_CONCURRENT_WEBHOOKS = Number(process.env.WEBHOOK_MAX_CONCURRENT || 50);
const RETRY_DELAYS_MS = [0, 10_000, 25_000, 60_000, 120_000, 300_000, 720_000, 1_500_000];

let activeCount = 0;
const waiters: Array<() => void> = [];

function jitterMs(baseMs: number): number {
    const min = Math.floor(baseMs * 0.8);
    const max = Math.ceil(baseMs * 1.2);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function acquireSlot() {
    if (activeCount < MAX_CONCURRENT_WEBHOOKS) {
        activeCount += 1;
        return;
    }

    await new Promise<void>((resolve) => {
        waiters.push(resolve);
    });

    activeCount += 1;
}

function releaseSlot() {
    activeCount = Math.max(0, activeCount - 1);
    const next = waiters.shift();
    if (next) next();
}

function buildPayload(
    transaction: Transaction & {
        pattern?: { name: string; bank: string | null } | null;
        business?: { id: string; name: string | null } | null;
        employee?: { id: string; name: string } | null;
    }
): WebhookPayload {
    return {
        success: true,
        data: {
            confirmed: true,
            matchType: 'exact',
            txnId: transaction.txnId,
            referenceTxnId: transaction.referenceTxnId || null,
            amount: transaction.amount,
            sender: transaction.sender,
            bank: transaction.bank || transaction.pattern?.bank || null,
            receivedAt: transaction.receivedAt,
            verifiedAt: transaction.verifiedAt || new Date(),
            business: transaction.business,
            employee: transaction.employee,
            source: transaction.source,
        },
    };
}

function createSignedHeaders(body: string, eventId: string, timestamp: string) {
    const secret = process.env.WEBHOOK_SIGNING_SECRET || process.env.JWT_SECRET || '';

    if (!secret) {
        return {
            'Content-Type': 'application/json',
            'X-CheckPay-Event-Id': eventId,
            'X-CheckPay-Timestamp': timestamp,
        };
    }

    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${eventId}.${body}`)
        .digest('hex');

    return {
        'Content-Type': 'application/json',
        'X-CheckPay-Event-Id': eventId,
        'X-CheckPay-Timestamp': timestamp,
        'X-CheckPay-Signature': signature,
    };
}

function isRetryableWebhookError(error: any): boolean {
    const status = error?.response?.status as number | undefined;

    if (!status) return true; // network / timeout / DNS
    if (status === 408 || status === 429) return true;
    if (status >= 500) return true;

    return false; // 4xx except 408/429 should not retry
}

async function attemptWebhookDelivery(
    webhookUrl: string,
    payloadJson: string,
    eventId: string,
    attempt: number
): Promise<boolean> {
    const timestamp = new Date().toISOString();
    const headers = createSignedHeaders(payloadJson, eventId, timestamp);

    await acquireSlot();
    try {
        await axios.post(webhookUrl, payloadJson, {
            timeout: WEBHOOK_TIMEOUT_MS,
            headers,
        });
        console.log(`[Webhook] Sent successfully to ${webhookUrl} (attempt ${attempt + 1})`);
        return true;
    } catch (error: any) {
        const status = error?.response?.status;
        const retryable = isRetryableWebhookError(error);
        console.error(
            `[Webhook] Failed to send to ${webhookUrl} (attempt ${attempt + 1}, status ${status || 'n/a'}, retryable=${retryable}):`,
            error?.message
        );
        if (!retryable) {
            return false;
        }
        throw error;
    } finally {
        releaseSlot();
    }
}

/**
 * Send once without retry (kept for compatibility).
 */
export async function sendVerificationWebhook(
    webhookUrl: string,
    transaction: Transaction & {
        pattern?: { name: string; bank: string | null } | null;
        business?: { id: string; name: string | null } | null;
        employee?: { id: string; name: string } | null;
    }
) {
    const payload = buildPayload(transaction);
    const payloadJson = JSON.stringify(payload);
    const eventId = crypto.randomUUID();

    try {
        return await attemptWebhookDelivery(webhookUrl, payloadJson, eventId, 0);
    } catch {
        return false;
    }
}

/**
 * Queue webhook delivery with bounded exponential backoff + jitter.
 * Fire-and-forget by design to keep API responses fast.
 */
export function queueVerificationWebhook(
    webhookUrl: string,
    transaction: Transaction & {
        pattern?: { name: string; bank: string | null } | null;
        business?: { id: string; name: string | null } | null;
        employee?: { id: string; name: string } | null;
    }
) {
    const payload = buildPayload(transaction);
    const payloadJson = JSON.stringify(payload);
    const eventId = crypto.randomUUID();

    const runAttempt = async (attempt: number) => {
        try {
            const delivered = await attemptWebhookDelivery(webhookUrl, payloadJson, eventId, attempt);
            if (delivered) return;

            // Non-retryable failure
            console.error(`[Webhook] Stopped retries for ${webhookUrl} due to non-retryable response`);
        } catch {
            if (attempt >= RETRY_DELAYS_MS.length - 1) {
                console.error(`[Webhook] Exhausted retries for ${webhookUrl}`);
                return;
            }

            const delay = jitterMs(RETRY_DELAYS_MS[attempt + 1]);
            setTimeout(() => {
                runAttempt(attempt + 1).catch((err) => {
                    console.error('[Webhook] Retry execution error:', err?.message || err);
                });
            }, delay);
        }
    };

    setTimeout(() => {
        runAttempt(0).catch((err) => {
            console.error('[Webhook] Initial execution error:', err?.message || err);
        });
    }, 0);
}
