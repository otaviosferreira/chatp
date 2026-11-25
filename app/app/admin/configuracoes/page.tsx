import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavigation } from "../admin-navigation";

export const dynamic = "force-dynamic";

function safeHost(value?: string) {
  if (!value) return "Não configurada";
  try { return new URL(value).host; } catch { return "URL inválida"; }
}

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") redirect("/app");

  const domain = (process.env.CORPORATE_EMAIL_DOMAIN || "ulife.com.br").replace(/^@/, "");
  const preview = process.env.VERCEL_ENV === "preview";
  const secretConfigured = Boolean(process.env.SUPABASE_SECRET_KEY);
  const siteConfigured = Boolean(process.env.NEXT_PUBLIC_SITE_URL);
  const supabaseHost = safeHost(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const siteHost = safeHost(process.env.NEXT_PUBLIC_SITE_URL);

  const settings = [
    ["Domínio corporativo autorizado", `@${domain}`],
    ["Ambiente atual", process.env.VERCEL_ENV || process.env.NODE_ENV || "Desconhecido"],
    ["URL pública do ChatP", siteHost],
    ["Projeto Supabase", supabaseHost],
    ["Chave administrativa server-only", secretConfigured ? "Configurada neste ambiente" : "Não configurada neste ambiente"],
    ["URL pública configurada", siteConfigured ? "Sim" : "Não"],
    ["Envio automático de e-mail", "Desativado nesta demo; convites e recuperação usam links individuais encaminhados pela TI"],
    ["Proteção contra senhas vazadas", "Pendente no plano Free do Supabase"],
    ["Anexos e Storage", "Bloqueados até scanner antimalware real; nenhum bucket público"],
  ];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div><p className="admin-header-subtitle">Painel de TI</p></div>
        <Link className="secondary-link" href="/app">Voltar ao início</Link>
      </header>
      <section className="admin-main">
        <AdminNavigation active="configuracoes" />
        <div className="admin-heading"><div><span className="auth-eyebrow">Infraestrutura</span><h1>Configurações</h1><p className="muted">Visão de leitura das configurações ativas. Segredos nunca são exibidos nesta tela.</p></div></div>
        <section className="admin-card">
          <h2>Configuração do ambiente</h2>
          <dl className="settings-list">
            {settings.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {preview && !secretConfigured && <p className="notice">A chave administrativa não está disponível neste Preview. Ações de convite/recuperação que dependem da API Admin devem ser testadas no Preview da etapa 3 ou após configurar a variável para esta branch.</p>}
          <p className="admin-footnote">Esta página não altera variáveis. Faça mudanças de ambiente pelo painel seguro da Vercel e confirme as URLs permitidas no Supabase Auth.</p>
        </section>
        <section className="admin-card settings-links">
          <h2>Painéis dos provedores</h2>
          <a className="secondary-link" href="https://vercel.com/otavioferreira-5984s-projects/chatp" target="_blank" rel="noreferrer">Vercel — projeto ChatP</a>
          <a className="secondary-link" href="https://supabase.com/dashboard/project/xspfkbqfjgklqplkevfx" target="_blank" rel="noreferrer">Supabase — projeto de desenvolvimento</a>
        </section>
      </section>
    </main>
  );
}
