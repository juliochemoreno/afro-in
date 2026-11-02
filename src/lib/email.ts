// Transactional email through Resend's REST API (a plain fetch, no SDK).
// Pure, no "@/" imports, so the tests can load it directly. The API key is a
// Worker secret: never log it, nor the message body (it carries personal data
// and bearer links).

export const RESEND_API = "https://api.resend.com/emails";

export const TICKETS_FROM = "AFRO IN <entradas@afroin.org>";
export const TICKETS_REPLY_TO = "afroinsantamarta@gmail.com";

export interface EmailAttachment {
  filename: string;
  /** Base64 content. */
  content: string;
  /** Inline image id, referenced in the HTML as <img src="cid:...">. */
  contentId?: string;
}

export interface EmailMessage {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

/** Resend's JSON body for a message (snake_case field names). */
export function resendBody(msg: EmailMessage): Record<string, unknown> {
  const body: Record<string, unknown> = {
    from: msg.from,
    to: [msg.to],
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  };
  if (msg.replyTo) body.reply_to = msg.replyTo;
  if (msg.attachments?.length) {
    body.attachments = msg.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      ...(a.contentId ? { content_id: a.contentId } : {}),
    }));
  }
  return body;
}

/**
 * Send one email. Never throws: a network error or timeout comes back as
 * { ok: false, status: 0 }. The idempotency key makes Resend drop a repeat of
 * the same request for 24 h.
 */
export async function sendEmail(
  apiKey: string,
  msg: EmailMessage,
  opts: { idempotencyKey?: string } = {}
): Promise<SendResult> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey.slice(0, 256);
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers,
      body: JSON.stringify(resendBody(msg)),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;
    if (res.ok && data?.id) return { ok: true, id: data.id };
    return {
      ok: false,
      status: res.status,
      error: String(data?.message ?? data?.name ?? res.statusText ?? "error").slice(0, 300),
    };
  } catch (e) {
    return { ok: false, status: 0, error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}
