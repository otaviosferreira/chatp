import Link from "next/link";

export default function PasswordRecoveryPage() {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="auth-card">
        <span className="auth-eyebrow">Recuperação de acesso</span>
        <h2>Esqueceu sua senha?</h2>
        <p className="auth-subtitle">
          Por segurança, solicite à equipe de TI um link individual de recuperação.
          A TI gera o link no painel administrativo e o encaminha diretamente por um canal corporativo autorizado.
        </p>
        <p className="muted">
          O link é temporário, de uso individual e permite cadastrar uma nova senha.
          Não compartilhe o link com outras pessoas.
        </p>
        <Link className="admin-entry-link" href="/login">Voltar para entrar</Link>
      </section>
    </main>
  );
}
