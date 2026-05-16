import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  signInWithGoogle,
  signInWithGitHub,
  signInWithEmail,
  signUpWithEmail,
} from "./actions";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const notice = typeof params.notice === "string" ? params.notice : null;
  const mode = params.mode === "signup" ? "signup" : "signin";

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <h1>Business Finder</h1>
        <p className="subtitle">Sign in to bring your own Google Maps API key.</p>

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error">{error}</div>}

        <form action={signInWithGoogle}>
          <button className="oauth google" type="submit">
            Continue with Google
          </button>
        </form>
        <form action={signInWithGitHub}>
          <button className="oauth github" type="submit">
            Continue with GitHub
          </button>
        </form>

        <div className="divider"><span>or</span></div>

        <form
          action={mode === "signup" ? signUpWithEmail : signInWithEmail}
          className="email-form"
        >
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          <button className="primary" type="submit">
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "signup" ? (
            <>
              Already have an account? <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              No account? <Link href="/login?mode=signup">Create one</Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
