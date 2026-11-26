import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setInitialPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function SetInitialPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const isRecovery = params.mode === "recovery";
  const admin = createAdminClient();
  const { data: authRecord, error: authRecordError } = await admin.auth.admin.getUserById(user.id);
  if (authRecordError || !authRecord.user) redirect("/login");

  const isFirst = authRecord.user.app_metadata?.force_password_change === true;
  if (!isFirst && !isRecovery) redirect("/app");

  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="auth-card">
        <span className="auth-eyebrow">{isRecovery ? "Recuperação de acesso" : "Primeiro acesso"}</span>
        <h2>{isRecovery ? "Defina uma nova senha" : "Crie sua senha pessoal"}</h2>
        <p className="auth-subtitle">{isFirst
          ? "Seu acesso inicial foi validado. Escolha agora uma senha pessoal com pelo menos 8 caracteres. A senha temporária deixa de funcionar após esta etapa."
          : "Crie uma nova senha com pelo menos 8 caracteres para recuperar o acesso à conta corporativa."}</p>
        {params.error && <p className="notice">{params.error === "senha" ? "As senhas devem ser iguais e conter entre 8 e 72 caracteres." : "Não foi possível atualizar a senha. Tente novamente."}</p>}
        <form action={setInitialPassword}>
          <div className="field"><label htmlFor="password">Nova senha</label><input id="password" name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></div>
          <div className="field"><label htmlFor="confirmation">Confirme a senha</label><input id="confirmation" name="confirmation" type="password" minLength={8} maxLength={72} autoComplete="new-password" required /></div>
          <button className="primary-button" type="submit">Salvar minha senha</button>
        </form>
      </section>
    </main>
  );
}
