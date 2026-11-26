import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setInitialPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function SetInitialPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const isRecovery = params.mode === "recovery";
  const isInvite = params.mode === "invite";

  // getUser() retorna o registro atualizado do Auth e sua app_metadata confiável.
  const isFirst = user.app_metadata?.force_password_change === true;
  if (!isFirst && !isRecovery && !isInvite) redirect("/app");

  const isOnboarding = isFirst || isInvite;
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="auth-card">
        <span className="auth-eyebrow">{isRecovery ? "Recuperação de acesso" : "Primeiro acesso"}</span>
        <h2>{isRecovery ? "Defina uma nova senha" : "Crie sua senha pessoal"}</h2>
        <p className="auth-subtitle">{isOnboarding
          ? "Seu acesso inicial foi validado. Escolha uma senha pessoal com pelo menos 12 caracteres."
          : "Crie uma nova senha com pelo menos 12 caracteres para recuperar o acesso à conta corporativa."}</p>
        {params.error && <p className="notice">{params.error === "senha" ? "As senhas devem ser iguais e conter entre 12 e 72 caracteres." : "Não foi possível atualizar a senha. Tente novamente."}</p>}
        <form action={setInitialPassword}>
          <div className="field"><label htmlFor="password">Nova senha</label><input id="password" name="password" type="password" minLength={12} maxLength={72} autoComplete="new-password" required /></div>
          <div className="field"><label htmlFor="confirmation">Confirme a senha</label><input id="confirmation" name="confirmation" type="password" minLength={12} maxLength={72} autoComplete="new-password" required /></div>
          <button className="primary-button" type="submit">Salvar senha e entrar</button>
        </form>
      </section>
    </main>
  );
}
