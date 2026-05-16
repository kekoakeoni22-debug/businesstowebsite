"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProviderColumn =
  | "google_maps_api_key"
  | "gemini_api_key"
  | "unsplash_access_key";

async function upsertKey(column: ProviderColumn, value: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_api_keys")
    .upsert(
      { user_id: user.id, [column]: value },
      { onConflict: "user_id" }
    );

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/settings");
  revalidatePath("/");
}

async function clearKey(column: ProviderColumn) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("user_api_keys")
    .update({ [column]: null })
    .eq("user_id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveGoogleMapsKey(formData: FormData) {
  const key = String(formData.get("apiKey") || "").trim();
  if (!key) {
    redirect("/settings?error=Google+Maps+key+cannot+be+empty");
  }
  await upsertKey("google_maps_api_key", key);
  redirect("/settings?notice=Google+Maps+key+saved");
}

export async function deleteGoogleMapsKey() {
  await clearKey("google_maps_api_key");
  redirect("/settings?notice=Google+Maps+key+removed");
}

export async function saveGeminiKey(formData: FormData) {
  const key = String(formData.get("apiKey") || "").trim();
  if (!key) {
    redirect("/settings?error=Gemini+key+cannot+be+empty");
  }
  await upsertKey("gemini_api_key", key);
  redirect("/settings?notice=Gemini+key+saved");
}

export async function deleteGeminiKey() {
  await clearKey("gemini_api_key");
  redirect("/settings?notice=Gemini+key+removed");
}

export async function saveUnsplashKey(formData: FormData) {
  const key = String(formData.get("apiKey") || "").trim();
  if (!key) {
    redirect("/settings?error=Unsplash+key+cannot+be+empty");
  }
  await upsertKey("unsplash_access_key", key);
  redirect("/settings?notice=Unsplash+key+saved");
}

export async function deleteUnsplashKey() {
  await clearKey("unsplash_access_key");
  redirect("/settings?notice=Unsplash+key+removed");
}
