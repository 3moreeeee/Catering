// =============================================================================
// ENQUIRY AND NEWSLETTER ENDPOINTS
//
// These exist because the forms in front of them were reporting success against
// nothing at all. There was no `/api/contact` route: the POST fell through to
// the Angular catch-all, which answered `200 text/html`, and the client read
// `response.ok` as confirmation and invented a reference number to show the
// visitor. A buyer was told their enquiry had been received, and given a
// reference to quote, for a message that was never sent anywhere.
//
// The contract here is deliberately strict in both directions.
//
//   - Nothing is accepted without server-side validation. The client's
//     validators are a convenience for the person typing; they are not a
//     security boundary and are not trusted here.
//   - Nothing returns `ok: true` unless the enquiry has actually been handed to
//     a delivery channel that confirmed it. With no channel configured the
//     endpoint answers 503 and says so, which is the honest outcome — the
//     visitor is told to phone or email instead of being thanked for a message
//     that went nowhere.
//   - The reference is generated here, on the server, only once delivery has
//     succeeded. The client is not permitted to make one up.
//
// Configuration is by environment variable so no key reaches the browser:
//
//   FK_ENQUIRY_WEBHOOK    URL that receives the enquiry as JSON. Any 2xx is
//                         treated as delivered.
//   FK_NEWSLETTER_WEBHOOK Same, for newsletter subscriptions.
//
// See docs/11-launch-blockers.md §4.1 and §4.2.
// =============================================================================

import type { Request, Response } from 'express';

/** Field length ceilings. Anything longer is a bot or a paste accident. */
const LIMITS = {
  name: 120,
  company: 160,
  email: 254,
  phone: 40,
  message: 4000,
  productSlug: 120,
  locale: 5,
  department: 32,
} as const;

const DEPARTMENTS = new Set(['sales', 'support', 'partnership', 'other']);
const LOCALES = new Set(['fr', 'en']);

/**
 * Deliberately permissive, deliberately bounded. Full RFC 5322 validation is a
 * famous waste of effort; what matters is that the value is plausibly an
 * address, contains no control characters, and cannot be used to inject a
 * second header if it is ever placed in one.
 */
const EMAIL = /^[^\s@<>;,"]{1,64}@[^\s@<>;,"]{1,190}\.[a-z]{2,24}$/i;

export interface EnquiryPayload {
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  department: string;
  locale: string;
  productSlug: string | null;
}

/** Strips control characters and collapses runaway whitespace. */
function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  return (
    value
      // Control characters, CR and LF included, so a submitted value can
      // never inject a second line into a mail header or a log record.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/[ \t]{3,}/g, '  ')
      .trim()
      .slice(0, max)
  );
}

export type Validated<T> = { ok: true; value: T } | { ok: false; fields: string[] };

export function validateEnquiry(raw: unknown): Validated<EnquiryPayload> {
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const value: EnquiryPayload = {
    name: clean(body['name'], LIMITS.name),
    company: clean(body['company'], LIMITS.company),
    email: clean(body['email'], LIMITS.email),
    phone: clean(body['phone'], LIMITS.phone),
    message: clean(body['message'], LIMITS.message),
    department: clean(body['department'], LIMITS.department),
    locale: clean(body['locale'], LIMITS.locale),
    productSlug: clean(body['productSlug'], LIMITS.productSlug) || null,
  };

  const fields: string[] = [];
  if (value.name.length < 2) fields.push('name');
  if (!EMAIL.test(value.email)) fields.push('email');
  if (value.message.length < 10) fields.push('message');
  if (value.department && !DEPARTMENTS.has(value.department)) fields.push('department');
  if (!LOCALES.has(value.locale)) value.locale = 'fr';
  // The consent checkbox is a legal record, not a formality.
  if (body['consent'] !== true) fields.push('consent');

  return fields.length ? { ok: false, fields } : { ok: true, value };
}

// -----------------------------------------------------------------------------
// RATE LIMITING
//
// A fixed-size sliding window per client address, held in memory. It is not a
// distributed rate limiter and does not pretend to be; it is the cheap 90% that
// stops a script hammering the form, and it needs no dependency, no key and no
// external service. A real deployment behind a CDN should also rate-limit at
// the edge.
// -----------------------------------------------------------------------------

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

export function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // Bounded memory: forget addresses that have gone quiet.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function clientKey(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first ?? req.socket.remoteAddress ?? 'unknown').trim();
}

/**
 * A reference the company can actually quote back to a caller: the date, then
 * enough randomness to be unambiguous. Generated only after delivery.
 */
function reference(prefix: string): string {
  const now = new Date();
  const day = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `${prefix}-${day}-${rand}`;
}

/** Never logs the message body or the address — only that something failed. */
function logFailure(scope: string, detail: string): void {
  console.error(`[${scope}] ${detail}`);
}

async function deliver(webhook: string, payload: unknown): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      logFailure('enquiry', `delivery endpoint returned ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    logFailure('enquiry', `delivery failed: ${(error as Error).name}`);
    return false;
  }
}

// -----------------------------------------------------------------------------
// HANDLERS
// -----------------------------------------------------------------------------

export async function handleEnquiry(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (rateLimited(clientKey(req))) {
    res.status(429).json({ ok: false, code: 'rate_limited' });
    return;
  }

  // Honeypot: a field no human sees and no human fills in.
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (typeof body['website'] === 'string' && body['website'].length > 0) {
    // Answer as though it worked. A bot that is told it failed simply retries.
    res.status(202).json({ ok: false, code: 'rejected' });
    return;
  }

  const validated = validateEnquiry(body);
  if (!validated.ok) {
    res.status(422).json({ ok: false, code: 'invalid', fields: validated.fields });
    return;
  }

  const webhook = process.env['FK_ENQUIRY_WEBHOOK'];
  if (!webhook) {
    // The honest answer. See docs/11-launch-blockers.md §4.1.
    logFailure('enquiry', 'no FK_ENQUIRY_WEBHOOK configured — enquiry not delivered');
    res.status(503).json({ ok: false, code: 'not_configured' });
    return;
  }

  const delivered = await deliver(webhook, {
    ...validated.value,
    receivedAt: new Date().toISOString(),
  });

  if (!delivered) {
    res.status(502).json({ ok: false, code: 'delivery_failed' });
    return;
  }

  res.status(201).json({ ok: true, reference: reference('FK') });
}

export async function handleNewsletter(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (rateLimited(`nl:${clientKey(req)}`)) {
    res.status(429).json({ ok: false, code: 'rate_limited' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = clean(body['email'], LIMITS.email);
  if (!EMAIL.test(email)) {
    res.status(422).json({ ok: false, code: 'invalid', fields: ['email'] });
    return;
  }

  const webhook = process.env['FK_NEWSLETTER_WEBHOOK'];
  if (!webhook) {
    logFailure('newsletter', 'no FK_NEWSLETTER_WEBHOOK configured — subscription not recorded');
    res.status(503).json({ ok: false, code: 'not_configured' });
    return;
  }

  const locale = LOCALES.has(clean(body['locale'], LIMITS.locale))
    ? clean(body['locale'], LIMITS.locale)
    : 'fr';

  const delivered = await deliver(webhook, { email, locale, receivedAt: new Date().toISOString() });
  if (!delivered) {
    res.status(502).json({ ok: false, code: 'delivery_failed' });
    return;
  }

  res.status(201).json({ ok: true, subscribed: true });
}
