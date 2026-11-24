export default function ConfigurationPage() {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="auth-card">
        <span className="auth-eyebrow">Configuração pendente</span>
        <h1>Conexão ainda não configurada</h1>
        <p className="muted">A equipe responsável precisa definir as variáveis de ambiente do Supabase antes de liberar o acesso.</p>
      </section>
    </main>
  );
}
