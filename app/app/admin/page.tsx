import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavigation } from "./admin-navigation";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("full_name,role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") redirect("/app");

  const [
    employeesResult,
    activeEmployeesResult,
    conversationsResult,
    messagesResult,
    auditResult,
    recentLogsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("conversations").select("id", { count: "exact", head: true }).is("archived_at", null),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    supabase.from("audit_logs").select("id,actor_id,action,target_type,target_id,created_at")
      .order("created_at", { ascending: false }).limit(8),
  ]);

  const recentLogs = recentLogsResult.data ?? [];
  const actorIds = [...new Set(recentLogs.map((log) => log.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", actorIds)
    : { data: [] };
  const actorNames = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]));

  const metrics = [
    { label: "Funcionários cadastrados", value: employeesResult.count, detail: "Contas no diretório", href: "/app/admin/funcionarios" },
    { label: "Acessos ativos", value: activeEmployeesResult.count, detail: "Funcionários habilitados", href: "/app/admin/funcionarios" },
    { label: "Conversas ativas", value: conversationsResult.count, detail: "Conversas não arquivadas", href: "/app/conversas" },
    { label: "Mensagens registradas", value: messagesResult.count, detail: "Somente quantidade; conteúdo não exibido", href: "/app/conversas" },
    { label: "Eventos de auditoria", value: auditResult.count, detail: "Registros administrativos", href: "/app/admin/auditoria" },
  ];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div><p className="admin-header-subtitle">Central de administração e governança</p></div>
        <Link className="secondary-link" href="/app">Voltar ao início</Link>
      </header>
      <section className="admin-main">
        <AdminNavigation active="inicio" />
        <div className="admin-heading">
          <div><span className="auth-eyebrow">Painel de TI</span><h1>Visão geral</h1><p className="muted">Olá, {profile.full_name}. Acompanhe o diretório, a comunicação e os eventos administrativos.</p></div>
        </div>

        <section className="admin-dashboard-grid" aria-label="Indicadores do sistema">
          {metrics.map((metric) => (
            <Link className="admin-card admin-metric-card" href={metric.href} key={metric.label}>
              <span className="muted">{metric.label}</span>
              <strong>{metric.value ?? "—"}</strong>
              <small>{metric.detail}</small>
            </Link>
          ))}
        </section>

        <section className="admin-card">
          <div className="admin-section-heading"><div><h2>Acesso rápido</h2><p className="muted">Atalhos para as principais ferramentas da TI.</p></div></div>
          <div className="admin-quick-links">
            <Link className="admin-entry-link" href="/app/admin/funcionarios"><strong>Funcionários e permissões</strong><span>Cadastre contas, altere perfis e gerencie acessos.</span></Link>
            <Link className="admin-entry-link" href="/app/admin/auditoria"><strong>Auditoria</strong><span>Filtre eventos por período, usuário e ação.</span></Link>
            <Link className="admin-entry-link" href="/app/admin/registros"><strong>Registros e logs</strong><span>Consulte eventos recentes e acesse os logs técnicos.</span></Link>
            <Link className="admin-entry-link" href="/app/admin/configuracoes"><strong>Configurações</strong><span>Confira o ambiente, integrações e pendências.</span></Link>
          </div>
        </section>

        <section className="admin-card">
          <h2>Atividade administrativa recente</h2>
          {!recentLogsResult.error && recentLogs.length === 0 && <p className="muted">Ainda não há eventos de auditoria registrados.</p>}
          {recentLogsResult.error && <p className="notice">Não foi possível carregar os eventos recentes. Consulte a aba Auditoria.</p>}
          {recentLogs.length > 0 && <div className="record-list">
            {recentLogs.map((log) => (
              <article className="record-row" key={log.id}>
                <div><strong>{log.action}</strong><small>{log.target_type}{log.target_id ? ` · ${log.target_id}` : ""}</small></div>
                <div><span>{log.actor_id ? actorNames.get(log.actor_id) || "Usuário" : "Sistema"}</span><small>{new Date(log.created_at).toLocaleString("pt-BR")}</small></div>
              </article>
            ))}
          </div>}
          <p><Link className="secondary-link" href="/app/admin/auditoria">Abrir auditoria completa</Link></p>
        </section>

        <p className="admin-footnote">Indicadores são consultas de leitura ao banco. O painel não mostra conteúdo de mensagens, senhas, tokens ou chaves secretas. Falhas em consultas aparecem como “—” e devem ser verificadas antes de usar os números como relatório oficial.</p>
      </section>
    </main>
  );
}
