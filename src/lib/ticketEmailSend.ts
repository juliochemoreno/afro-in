// Sends a completed ticket order's confirmation email exactly once (D19).
//
// Several paths complete an order (Bold webhook, receipt confirm, free
// checkout, admin courtesy) and the webhook and the confirm can race, so the
// send is guarded by a claim on ticket_orders.email_status, like the ticket
// issuance claim: one UPDATE moves a due order to 'sending', and only the
// caller whose UPDATE changed the row sends. Resend's Idempotency-Key covers a
// worker that died after sending but before recording it.
//
// Never throws: an email problem must not fail a payment confirmation. Logs
// carry the Bold order id and the HTTP status only (no buyer data, no link).

import { TICKETS_FROM, TICKETS_REPLY_TO, sendEmail } from "@/lib/email";
import { buildTicketEmail, ticketsPath } from "@/lib/ticketEmail";
import { getTicketOrderByBoldId, orderLocale } from "@/lib/tickets";

/** Automatic attempts per order; after that only the admin button sends. */
export const MAX_EMAIL_ATTEMPTS = 3;
/** A claim older than this is a worker that died mid-send: retry it. */
const STALE_SENDING = "-10 minutes";
/**
 * Production links always point at the canonical site, whatever host Bold or
 * the buyer used: the email is permanent. Outside production (marked by the
 * subject prefix) links follow the request host (dev, previews, local).
 */
const PRODUCTION_ORIGIN = "https://afroin.org";

export type TicketEmailStatus = "sent" | "failed" | "not_due" | "no_key";

interface EmailEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_SUBJECT_PREFIX?: string;
}

export async function sendTicketEmail(
  env: EmailEnv,
  boldOrderId: string,
  opts: { origin: string; force?: boolean }
): Promise<{ status: TicketEmailStatus; error?: string }> {
  try {
    if (!env.RESEND_API_KEY) {
      console.warn("ticket email: RESEND_API_KEY not configured, not sent", boldOrderId);
      return { status: "no_key" };
    }
    const db = env.DB;

    const claim = await db
      .prepare(
        `UPDATE ticket_orders
            SET email_status = 'sending', email_attempt_at = datetime('now'),
                email_attempts = email_attempts + 1
          WHERE bold_order_id = ?1 AND status = 'completed' AND tickets_issued = 1
            AND (?2 = 1
                 OR email_status IS NULL
                 OR (email_status = 'failed' AND email_sent_at IS NULL AND email_attempts < ?3)
                 OR (email_status = 'sending' AND email_attempts <= ?3
                     AND email_attempt_at < datetime('now', '${STALE_SENDING}')))`
      )
      .bind(boldOrderId, opts.force ? 1 : 0, MAX_EMAIL_ATTEMPTS)
      .run();
    if (!claim.meta.changes) return { status: "not_due" };

    // A failed resend of an order the buyer already received keeps it 'sent'
    // (never reopens automatic retries); only the error is recorded.
    const fail = async (error: string, status = "") => {
      await db
        .prepare(
          `UPDATE ticket_orders
              SET email_status = CASE WHEN email_sent_at IS NOT NULL THEN 'sent' ELSE 'failed' END,
                  email_error = ?
            WHERE bold_order_id = ?`
        )
        .bind(error.slice(0, 300), boldOrderId)
        .run();
      console.error("ticket email failed", boldOrderId, status);
      return { status: "failed" as const, error };
    };

    const view = await getTicketOrderByBoldId(db, boldOrderId);
    const order = view.order;
    if (!order || !view.event || view.tickets.length === 0) return fail("no tickets", "no tickets");

    const lang = orderLocale(order.locale);
    const event = view.event;
    const name =
      (lang === "en" ? event.name_en : lang === "fr" ? event.name_fr : null) || event.name_es;
    const mail = buildTicketEmail({
      lang,
      buyerName: order.buyer_name,
      event: {
        name,
        venue: event.venue,
        city: event.city,
        eventDate: event.event_date,
        endDate: event.end_date,
      },
      codes: view.tickets.map((t) => t.code),
      ticketsUrl: `${env.EMAIL_SUBJECT_PREFIX ? opts.origin : PRODUCTION_ORIGIN}${ticketsPath(lang, order.access_token)}`,
      subjectPrefix: env.EMAIL_SUBJECT_PREFIX ?? "",
    });

    // One key per order for automatic sends (a retry after a lost answer is
    // dropped by Resend); a new key per admin send, which is meant to resend.
    const attempts = await db
      .prepare(`SELECT email_attempts AS n FROM ticket_orders WHERE bold_order_id = ?`)
      .bind(boldOrderId)
      .first<{ n: number }>();
    const idempotencyKey = opts.force
      ? `ticket-email/${boldOrderId}/admin-${Number(attempts?.n ?? 0)}`
      : `ticket-email/${boldOrderId}`;

    const res = await sendEmail(
      env.RESEND_API_KEY,
      {
        from: TICKETS_FROM,
        to: order.buyer_email,
        replyTo: TICKETS_REPLY_TO,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments,
      },
      { idempotencyKey }
    );
    if (!res.ok) return fail(`${res.status}: ${res.error}`, String(res.status));

    await db
      .prepare(
        `UPDATE ticket_orders
            SET email_status = 'sent', email_sent_at = datetime('now'), email_error = NULL
          WHERE bold_order_id = ?`
      )
      .bind(boldOrderId)
      .run();
    return { status: "sent" };
  } catch (e) {
    console.error("ticket email: unexpected error", boldOrderId, String((e as Error)?.message ?? e).slice(0, 120));
    return { status: "failed", error: "unexpected error" };
  }
}
