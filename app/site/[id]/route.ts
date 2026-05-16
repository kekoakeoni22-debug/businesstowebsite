import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  // Cheap upstream filter so we don't hit Supabase with obviously bogus
  // values from crawlers.
  if (!UUID_RE.test(id)) {
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
