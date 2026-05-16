import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session cookie if expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auto-create an anonymous session for first-time visitors so the homepage
  // and all features work without seeing a sign-in wall. Requires
  // "Allow anonymous sign-ins" enabled in Supabase → Authentication.
  // If the project hasn't enabled it, the call fails silently and the
  // visitor sees the same page in a logged-out state (publishing will
  // require manually clicking Sign in).
  if (!user) {
    await supabase.auth.signInAnonymously().catch(() => {});
  }

  return response;
}
