import type { APIRoute } from "astro";

export const prerender = false;

// API to get donor counter
export const GET: APIRoute = async ({ locals }) => {
  const runtime = locals.runtime;
  const env = runtime.env;

  try {
    // Count unique people (by email), not the number of contributions: if a
    // person donates 10 times they still count as one joined person. The
    // amount stays a full sum of every completed contribution.
    const result = await env.DB.prepare(
      `SELECT
        COUNT(DISTINCT LOWER(TRIM(email))) as total,
        COALESCE(SUM(amount), 0) as total_amount
       FROM donors
       WHERE status = 'completed'`
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
