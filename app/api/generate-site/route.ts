import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildTemplatePrompt } from "@/lib/generate-site/prompt";

// Edge runtime: V8 worker that can pass through Gemini's SSE stream without
// holding open a Node serverless function. Node functions on Vercel would
// hit FUNCTION_INVOCATION_TIMEOUT on long generations (30-90s).
export const runtime = "edge";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isPaidUser(user: any): boolean {
  const appMeta = user?.app_metadata || {};
  const userMeta = user?.user_metadata || {};
  const fromMetadata =
    appMeta?.btw_pro === true ||
    appMeta?.is_pro === true ||
    userMeta?.btw_pro === true ||
    userMeta?.is_pro === true;

  const allowlist = (process.env.PRO_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const fromAllowlist = allowlist.includes(user?.id || "");

  return fromMetadata || fromAllowlist;
}

export async function POST(req: NextRequest) {
  // Sign-in is required for Gemini generation specifically — every call to
  // this route costs us tokens, so we gate it behind an account. Search,
  // photos, and reading cached templates remain anonymous.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Sign in required to generate a website.");
  if (!isPaidUser(user)) {
    return jsonError(
      402,
      "Pro subscription required to generate websites."
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonError(500, "GEMINI_API_KEY is not set on the server.");
  }

  let body: { primaryType?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const primaryType = (body.primaryType || "business").trim();
  const model = (body.model || "gemini-3-flash-preview").trim();

  // Charge credits only when we are about to call Gemini (fresh generation).
  const { data: creditRows, error: creditErr } = await supabase.rpc(
    "consume_generation_credits",
    {
      p_user_id: user.id,
      p_cost: 100,
      p_monthly: 4000,
    }
  );
  if (creditErr) {
    return jsonError(500, `Credit system error: ${creditErr.message}`);
  }
  const creditResult = Array.isArray(creditRows) ? creditRows[0] : null;
  if (!creditResult?.ok) {
    return jsonError(
      402,
      `Insufficient credits. ${creditResult?.credits_remaining ?? 0} credits remaining.`
    );
  }

  const prompt = buildTemplatePrompt(primaryType);
  const upstreamBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 32768,
      responseMimeType: "text/plain",
    },
  });

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: upstreamBody,
    }
  );

  // Non-2xx from Gemini: forward the body so the client can decide whether
  // to retry with a different model (quota/permission errors propagate the
  // same status code).
  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
      },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
