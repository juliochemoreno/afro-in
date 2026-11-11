import type { APIRoute } from "astro";

export const prerender = false;

// API to get donor counter
export const GET: APIRoute = async ({ locals }) => {
  const runtime = locals.runtime;
  const env = runtime.env;

  try {
    // "1 Millón de Corazones" counts unique people (by email), not contributions:
    // everyone with a completed contribution plus everyone with a paid ticket
    // order. A person who does both counts once. Free and courtesy tickets
    // (amount 0) do not count. The amount stays the sum of completed contributions only.
    const result = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM (
           SELECT LOWER(TRIM(email)) AS person FROM donors
            WHERE status = 'completed'
           UNION
           SELECT LOWER(TRIM(buyer_email)) FROM ticket_orders
            WHERE status = 'completed' AND amount > 0
         ) WHERE person IS NOT NULL AND person <> '') AS total,
        (SELECT COALESCE(SUM(amount), 0) FROM donors
          WHERE status = 'completed') AS total_amount`
    ).first<{ total: number; total_amount: number }>();

    return new Response(
      JSON.stringify({
        total: result?.total || 0,
        totalAmount: result?.total_amount || 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60", // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    console.error("Error getting counter:", error);
    return new Response(JSON.stringify({ total: 0, totalAmount: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
