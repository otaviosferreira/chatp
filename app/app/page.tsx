import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");
  if (user.app_metadata?.force_password_change === true) redirect("/auth/definir-senha?mode=first");

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("status").eq("id", user.id).maybeSingle();
  if (profileError || !profile || profile.status !== "active") redirect("/login?reason=inactive");

  // A caixa de entrada passa a ser a tela inicial após a autenticação.
  redirect("/app/conversas");
}
