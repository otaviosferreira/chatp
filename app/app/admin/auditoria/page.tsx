import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNavigation } from "../admin-navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  actor?: string;
  action?: string;
  page?: string;
}>;

const pageSize = 25;
const actionOptions = [
  ["employee.invited", "Funcionário cadastrado"],
  ["employee.updated", "Cadastro/permissões alterados"],
  ["employee.password_recovery_link_generated", "Link de recuperação gerado"],
];

function validDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") redirect("/app");

  const params = await searchParams;
  const from = validDate(params.from) ? params.from! : "";
  const to = validDate(params.to) ? params.to! : "";
  const actor = params.actor ?? "";
  const action = params.action ?? "";
  const currentPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  let query = supabase.from("audit_logs")
    .select("id,actor_id,action,target_type,target_id,reason,metadata,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lt("created_at", nextDay(to));
  if (actor) query = query.eq("actor_id", actor);
  if (action) query = query.eq("action", action);

  const [{ data: logs, count, error }, { data: employees }] = await Promise.all([
    query,
    supabase.from("profiles").select("id,full_name,email").order("full_name", { ascending: true }),
  ]);
  const actorNames = new Map((employees ?? []).map((employee) => [employee.id, employee.full_name]));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (actor) next.set("actor", actor);
    if (action) next.set("action", action);
    next.set("page", String(page));
    return `/app/admin/auditoria?${next.toString()}`;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div><div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div><p className="admin-header-subtitle">Painel de TI</p></div>
        <Link className="secondary-link" href="/app">Voltar ao início</Link>
      </header>
      <section className="admin-main">
        <AdminNavigation active="auditoria" />
        <div className="admin-heading">
          <div><span className="auth-eyebrow">Governança e segurança</span><h1>Auditoria</h1><p className="muted">Consulte ações administrativas registradas no banco. A trilha é append-only.</p></div>
          <span className="admin-count">{total} eventos</span>
        </div>

        <section className="admin-card">
          <h2>Filtrar eventos</h2>
          <form action="/app/admin/auditoria" method="get" className="audit-filters">
            <label>De<input type="date" name="from" defaultValue={from} /></label>
            <label>Até<input type="date" name="to" defaultValue={to} /></label>
            <label>Usuário
              <select name="actor" defaultValue={actor}>
                <option value="">Todos</option>
                {(employees ?? []).map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name}</option>)}
              </select>
            </label>
            <label>Ação/evento
              <select name="action" defaultValue={action}>
                <option value="">Todas</option>
                {actionOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
            <button className="primary-button" type="submit">Aplicar filtros</button>
            <Link className="secondary-link" href="/app/admin/auditoria">Limpar</Link>
          </form>
        </section>

        <section className="admin-card">
          <h2>Eventos registrados</h2>
          {error && <p className="notice" role="alert">Não foi possível consultar a trilha de auditoria.</p>}
          {!error && (!logs || logs.length === 0) && <p className="muted">Nenhum evento encontrado para os filtros informados.</p>}
          {logs && logs.length > 0 && (
            <div className="audit-table-wrap">
              <table className="audit-table">
                <thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Alvo</th><th>Detalhes</th></tr></thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                      <td>{log.actor_id ? actorNames.get(log.actor_id) || "Usuário não listado" : "Sistema"}</td>
                      <td><code>{log.action}</code></td>
                      <td>{log.target_type}{log.target_id ? <small>{log.target_id}</small> : null}</td>
                      <td><details><summary>Ver</summary><pre>{JSON.stringify(log.metadata, null, 2)}</pre>{log.reason && <p>{log.reason}</p>}</details></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="audit-pagination">
            <span className="muted">Página {currentPage} de {totalPages}</span>
            <div>
              {currentPage > 1 && <Link className="secondary-link" href={pageHref(currentPage - 1)}>Anterior</Link>}
              {currentPage < totalPages && <Link className="secondary-link" href={pageHref(currentPage + 1)}>Próxima</Link>}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
