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

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const siteUrl = await getSiteUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
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
