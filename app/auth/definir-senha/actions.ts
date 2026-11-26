"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setInitialPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8 || password.length > 72 || password !== confirmation) {
    redirect("/auth/definir-senha?error=senha");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/definir-senha?error=atualizacao");

  if (user.app_metadata?.force_password_change === true) {
    const admin = createAdminClient();
    const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, force_password_change: false },
    });
    if (metadataError) redirect("/auth/definir-senha?error=atualizacao");
  }

  redirect("/app");
}
