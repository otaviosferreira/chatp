import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavigation } from "../admin-navigation";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") redirect("/app");

  const { data: records, error } = await supabase.from("audit_logs")
    .select("id,actor_id,action,target_type,target_id,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  const actorIds = [...new Set((records ?? []).map((record) => record.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]));

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div><p className="admin-header-subtitle">Painel de TI</p></div>
        <Link className="secondary-link" href="/app">Voltar ao início</Link>
      </header>
      <section className="admin-main">
        <AdminNavigation active="registros" />
        <div className="admin-heading"><div><span className="auth-eyebrow">Operação</span><h1>Registros</h1><p className="muted">Eventos recentes gerados pelas ações administrativas do ChatP.</p></div></div>
        <section className="admin-card">
          <h2>Últimos eventos da aplicação</h2>
          {error && <p className="notice">Não foi possível consultar os registros.</p>}
          {!error && (!records || records.length === 0) && <p className="muted">Ainda não existem registros.</p>}
          <div className="record-list">
            {(records ?? []).map((record) => (
              <article className="record-row" key={record.id}>
                <div><strong>{record.action}</strong><small>{record.target_type}{record.target_id ? ` · ${record.target_id}` : ""}</small></div>
                <div><span>{record.actor_id ? names.get(record.actor_id) || "Usuário" : "Sistema"}</span><small>{new Date(record.created_at).toLocaleString("pt-BR")}</small></div>
              </article>
            ))}
          </div>
          <p className="admin-footnote">Esses são eventos de auditoria da aplicação. Logs técnicos de execução, erros e requisições são mantidos pela Vercel e não são copiados para o banco do ChatP.</p>
        </section>
        <section className="admin-card">
          <h2>Logs técnicos da hospedagem</h2>
          <p className="muted">Para consultar logs de runtime, erros de funções e requisições do Preview, abra o projeto na Vercel e acesse Observability → Logs.</p>
          <a className="admin-entry-link" href="https://vercel.com/otavioferreira-5984s-projects/chatp" target="_blank" rel="noreferrer">Abrir projeto ChatP na Vercel</a>
        </section>
      </section>
    </main>
  );
}
