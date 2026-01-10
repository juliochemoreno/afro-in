import type { APIRoute } from "astro";

export const prerender = false;

interface DonorData {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  amount: number;
}

// API to register donors
export const POST: APIRoute = async ({ request, locals }) => {
  const runtime = locals.runtime;
  const env = runtime.env;

  try {
    const data: DonorData = await request.json();

    // Basic validation
    if (!data.name || !data.email || !data.amount) {
      return new Response(
        JSON.stringify({ error: "Name, email and amount are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert into database
    const result = await env.DB.prepare(
      `INSERT INTO donors (name, email, phone, country, amount, status) 
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
      .bind(
        data.name,
        data.email,
        data.phone || null,
        data.country || null,
        data.amount
      )
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        id: result.meta.last_row_id,
        message: "Donor registered",
      }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Error registering donor:", error);
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
