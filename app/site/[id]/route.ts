import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Slugs are lowercase alphanumerics with hyphens, no leading/trailing dashes,
// capped at 80 characters to keep URLs reasonable and to filter out garbage
// requests from crawlers before they hit the database.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (id.length > 80 || !SLUG_RE.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("published_sites")
    .select("html")
    .eq("id", id)
    .maybeSingle();

  if (error || !data?.html) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(data.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      // Belt-and-suspenders: the generated HTML can run scripts, but its
      // origin is our app domain when served directly. CSP would tighten
      // this further if/when we want to lock down what scripts can do.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
