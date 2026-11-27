"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string };

export async function signIn(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1) {
    return { error: "Informe um e-mail válido e sua senha." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Não foi possível entrar. Confira suas credenciais ou solicite suporte à TI." };

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("status").eq("id", data.user.id).maybeSingle();
  if (profileError || profile?.status !== "active") {
    await supabase.auth.signOut();
    return { error: "Acesso não autorizado. Se sua conta deveria estar ativa, contate a TI." };
  }

  // getUser() consulta o Auth e retorna app_metadata gerenciada pelo servidor.
  // Isso mantém o login normal funcional também em Previews sem a chave Admin.
  if (data.user.app_metadata?.force_password_change === true) {
    redirect("/auth/definir-senha?mode=first");
  }
  redirect("/app");
}
