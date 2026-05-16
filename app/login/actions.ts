"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getSiteUrl() {
  // Prefer the actual request origin so a misconfigured env var can't
  // silently send OAuth redirects to the wrong host. Fall back to the
  // env var, then localhost.
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || null;
    const proto =
      h.get("x-forwarded-proto") ||
      (host && host.startsWith("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`;
  } catch {
    /* fall through */
  }

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (envUrl) {
    return /^https?:\/\//.test(envUrl) ? envUrl : `https://${envUrl}`;
  }
  return "http://localhost:3000";
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const siteUrl = await getSiteUrl();
  // Forward ?next from the login page through OAuth so the callback can
  // send the user back where they started (e.g. / after they got bounced
  // from "Generate website" or "Copy website URL").
  const nextRaw = String(formData.get("next") || "/");
  const next = nextRaw.startsWith("/") ? nextRaw : "/";
  const callback = new URL(`${siteUrl}/auth/callback`);
  callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data?.url) {
    redirect(data.url);
  }
  redirect("/login?error=oauth_no_url");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Magic-link sign-in. Returns a plain object instead of redirecting so the
// caller (a client modal) can render success/error state in place rather
// than navigating away.
export async function sendMagicLink(
  email: string,
  next: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = (email || "").trim();
  if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  const siteUrl = await getSiteUrl();
  const safeNext = next && next.startsWith("/") ? next : "/";
  const callback = new URL(`${siteUrl}/auth/callback`);
  callback.searchParams.set("next", safeNext);

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
