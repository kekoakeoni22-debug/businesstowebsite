"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveApiKey(formData: FormData) {
  const key = String(formData.get("apiKey") || "").trim();
  if (!key) {
    redirect("/settings?error=API+key+cannot+be+empty");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_api_keys")
    .upsert(
      { user_id: user.id, google_maps_api_key: key },
      { onConflict: "user_id" }
    );

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/");
  redirect("/settings?notice=Key+saved");
}

export async function deleteApiKey() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/");
  redirect("/settings?notice=Key+removed");
}
