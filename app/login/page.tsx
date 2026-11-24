import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="ChatApp Calunga">
        <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA</div>
        <div className="brand-copy">
          <h1>Conexão segura. Comunicação interna.</h1>
          <p>Um espaço privado para aproximar equipes, compartilhar informações e manter a comunicação da Calunga organizada.</p>
        </div>
        <div className="brand-foot">Ambiente corporativo privado · Acesso monitorado</div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-eyebrow">Portal corporativo</span>
          <h2>Acesse sua conta</h2>
          <p className="auth-subtitle">Entre com as credenciais fornecidas pela equipe de TI.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
