import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") {
    redirect("/app?error=forbidden");
  }

  const domain = (process.env.CORPORATE_EMAIL_DOMAIN || "ulife.com.br").replace(/^@/, "");
  const isPreview = process.env.VERCEL_ENV === "preview";
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div>
          <p className="admin-header-subtitle">Configurações administrativas</p>
        </div>
        <nav className="admin-nav" aria-label="Navegação administrativa">
          <Link href="/app/admin/funcionarios">Funcionários</Link>
          <Link href="/app/admin/auditoria">Auditoria</Link>
          <Link href="/app/admin/configuracoes" aria-current="page">Configurações</Link>
          <Link href="/app">Início</Link>
        </nav>
      </header>
      <section className="admin-main">
        <div className="admin-heading">
          <div><span className="auth-eyebrow">Painel de TI</span><h1>Configurações do ambiente</h1>
            <p className="muted">Visão de diagnóstico sem exibir chaves, tokens ou valores secretos.</p></div>
        </div>
        <section className="admin-card">
          <h2>Políticas de acesso</h2>
          <dl className="settings-list">
            <div><dt>Domínio corporativo permitido</dt><dd>@{domain}</dd></div>
            <div><dt>Cadastro público</dt><dd>Desabilitado — provisionamento administrativo</dd></div>
            <div><dt>Exclusão de funcionários</dt><dd>Bloqueada — contas devem ser desativadas</dd></div>
            <div><dt>Plano de implantação</dt><dd>{isPreview ? "Preview (ambiente de testes)" : process.env.VERCEL_ENV === "production" ? "Production" : "Desenvolvimento"}</dd></div>
          </dl>
        </section>
        <section className="admin-card">
          <h2>Integrações</h2>
          <dl className="settings-list">
            <div><dt>Supabase URL pública</dt><dd>{process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configurada" : "Pendente"}</dd></div>
            <div><dt>Chave administrativa server-side</dt><dd>{process.env.SUPABASE_SECRET_KEY ? "Configurada (valor oculto)" : "Pendente"}</dd></div>
            <div><dt>URL pública do site</dt><dd>{process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL ? "Configurada" : "Pendente"}</dd></div>
            <div><dt>Envio automático de e-mail</dt><dd>Depende do SMTP do Supabase; não confirmado neste ambiente</dd></div>
          </dl>
          <p className="admin-footnote">As variáveis de ambiente são gerenciadas na Vercel. Esta tela é somente leitura e nunca revela o conteúdo de segredos.</p>
        </section>
      </section>
    </main>
  );
}
