import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ from?: string; to?: string; actor?: string; action?: string; page?: string }>;

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") {
    redirect("/app?error=forbidden");
  }

  const params = await searchParams;
  const from = validDate(params.from);
  const to = validDate(params.to);
  const actor = params.actor?.trim() || "";
  const action = params.action?.trim().slice(0, 120) || "";
  const requestedPage = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = 20;

  let query = supabase.from("audit_logs")
    .select("id,actor_id,action,target_type,target_id,reason,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", new Date(`${from}T00:00:00.000Z`).toISOString());
  if (to) query = query.lte("created_at", new Date(`${to}T23:59:59.999Z`).toISOString());
  if (actor && /^[0-9a-f-]{36}$/i.test(actor)) query = query.eq("actor_id", actor);
  if (action) query = query.ilike("action", `%${action.replace(/[%_]/g, "\\$&")}%`);

  const { data: entries, error, count } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const actorIds = [...new Set((entries ?? []).map(entry => entry.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", actorIds)
    : { data: [] as { id: string; full_name: string; email: string }[] };
  const actorById = new Map((actors ?? []).map(item => [item.id, item]));
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);

  function pageHref(nextPage: number) {
    const queryParams = new URLSearchParams();
    if (from) queryParams.set("from", from);
    if (to) queryParams.set("to", to);
    if (actor) queryParams.set("actor", actor);
    if (action) queryParams.set("action", action);
    queryParams.set("page", String(nextPage));
    return `/app/admin/auditoria?${queryParams.toString()}`;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div>
          <p className="admin-header-subtitle">Auditoria e registros administrativos</p>
        </div>
        <nav className="admin-nav" aria-label="Navegação administrativa">
          <Link href="/app/admin/funcionarios">Funcionários</Link>
          <Link href="/app/admin/auditoria" aria-current="page">Auditoria</Link>
          <Link href="/app/admin/configuracoes">Configurações</Link>
          <Link href="/app">Início</Link>
        </nav>
      </header>

      <section className="admin-main">
        <div className="admin-heading">
          <div><span className="auth-eyebrow">Painel de TI</span><h1>Trilha de auditoria</h1>
            <p className="muted">Consulte as ações administrativas registradas no banco. Os registros são somente leitura e não podem ser alterados pela interface.</p></div>
          <span className="admin-count">{total} registros</span>
        </div>

        <section className="admin-card">
          <h2>Filtros</h2>
          <form method="get" action="/app/admin/auditoria" className="audit-filters">
            <label>Data inicial<input type="date" name="from" defaultValue={from} /></label>
            <label>Data final<input type="date" name="to" defaultValue={to} min={from} /></label>
            <label>ID do usuário<input name="actor" defaultValue={actor} placeholder="UUID do responsável" /></label>
            <label>Ação / evento<input name="action" defaultValue={action} maxLength={120} placeholder="Ex.: employee.updated" /></label>
            <button className="primary-button" type="submit">Aplicar filtros</button>
            <Link className="admin-entry-link" href="/app/admin/auditoria">Limpar filtros</Link>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-title-row"><h2>Eventos registrados</h2><span className="muted">Página {currentPage} de {pages}</span></div>
          {error ? <p className="notice">Não foi possível consultar os registros de auditoria.</p> : (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead><tr><th>Data e hora</th><th>Responsável</th><th>Ação</th><th>Alvo</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {(entries ?? []).map(entry => {
                    const actorProfile = entry.actor_id ? actorById.get(entry.actor_id) : undefined;
                    return <tr key={entry.id}>
                      <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(entry.created_at))}</td>
                      <td>{actorProfile ? <>{actorProfile.full_name}<small>{actorProfile.email}</small></> : "Sistema / não identificado"}</td>
                      <td><code>{entry.action}</code></td>
                      <td>{entry.target_type}{entry.target_id ? <small>{entry.target_id}</small> : null}</td>
                      <td><pre>{JSON.stringify(entry.metadata ?? {}, null, 2)}</pre>{entry.reason ? <small>{entry.reason}</small> : null}</td>
                    </tr>;
                  })}
                  {(!entries || entries.length === 0) && <tr><td colSpan={5}>Nenhum registro encontrado para os filtros informados.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="audit-pagination">
            <span className="muted">Exibindo {entries?.length ?? 0} de {total} eventos</span>
            <div>
              {currentPage > 1 && <Link className="secondary-action" href={pageHref(currentPage - 1)}>Anterior</Link>}
              {currentPage < pages && <Link className="secondary-action" href={pageHref(currentPage + 1)}>Próxima</Link>}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
