import type { APIRoute } from "astro";

export const prerender = false;

// API to confirm completed donation
export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = locals.runtime;
  const env = runtime.env;

  try {
    const { id } = (await request.json()) as { id?: number };

    if (!id) {
      return new Response(JSON.stringify({ error: "Donor ID required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Update status to completed
    const result = await env.DB.prepare(
      `UPDATE donors 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND status = 'pending'`
    )
      .bind(id)
      .run();

    if (result.meta.changes === 0) {
      return new Response(
        JSON.stringify({ error: "Donor not found or already confirmed" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get total count of completed donors
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM donors WHERE status = 'completed'`
    ).first<{ total: number }>();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Donation confirmed",
        totalDonors: countResult?.total || 0,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error confirming donation:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// Handle CORS preflight
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
