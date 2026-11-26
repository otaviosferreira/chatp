import Link from "next/link";
import { RecoveryForm } from "./recovery-form";

export default async function PasswordRecoveryPage({ searchParams }: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="auth-card">
        <span className="auth-eyebrow">Recuperação de acesso</span>
        <h2>Esqueceu sua senha?</h2>
        <p className="auth-subtitle">
          Informe seu e-mail corporativo cadastrado. Se a conta existir, enviaremos um link individual para você criar uma nova senha, sem precisar solicitar à TI.
        </p>
        {params.sent === "1" ? (
          <p className="notice" role="status">
            Se o endereço estiver cadastrado, você receberá um link de recuperação. Verifique também a caixa de spam.
          </p>
        ) : null}
        {params.error === "email" ? (
          <p className="notice" role="alert">Informe um endereço de e-mail válido.</p>
        ) : null}
        {params.error === "config" ? (
          <p className="notice" role="alert">A recuperação ainda não está configurada para este ambiente. Procure o suporte do sistema.</p>
        ) : null}
        <RecoveryForm />
        <p className="muted">
          O link é individual e temporário. Nunca compartilhe esse link. Depois de abri-lo, você poderá cadastrar sua nova senha.
        </p>
        <Link className="admin-entry-link" href="/login">Voltar para entrar</Link>
      </section>
    </main>
  );
}
