import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inviteEmployee, updateEmployee } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string; error?: string }>;

const messages: Record<string, string> = {
  nome: "Informe um nome válido.",
  dominio: "Use um e-mail do domínio corporativo autorizado.",
  convite: "Não foi possível enviar o convite. Verifique se o e-mail já existe e a configuração de SMTP.",
  perfil: "O convite não foi concluído porque o perfil não pôde ser criado.",
  dados: "Confira os dados informados.",
  "propria-conta": "Não é permitido desativar ou rebaixar sua própria conta administrativa.",
  "nao-encontrado": "Funcionário não encontrado.",
  "ultimo-admin": "A operação bloquearia o último administrador ativo.",
  atualizacao: "Não foi possível atualizar o cadastro.",
};

export default async function EmployeesAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase.from("profiles")
    .select("role,status").eq("id", user.id).maybeSingle();
  if (!currentProfile || currentProfile.status !== "active" || currentProfile.role !== "it_admin") {
    redirect("/app?error=forbidden");
  }

  const { data: employees, error } = await supabase.from("profiles")
    .select("id,full_name,email,department,role,status,created_at")
    .order("full_name", { ascending: true });
  const params = await searchParams;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatApp</div>
          <p className="admin-header-subtitle">Administração de funcionários</p>
        </div>
        <Link className="secondary-link" href="/app">Voltar ao início</Link>
      </header>
      <section className="admin-main">
        <div className="admin-heading">
          <div><span className="auth-eyebrow">Painel de TI</span><h1>Funcionários e acessos</h1>
            <p className="muted">Convide, atualize permissões e bloqueie acessos sem apagar o histórico.</p></div>
          <span className="admin-count">{employees?.length ?? 0} cadastros</span>
        </div>

        {params.success === "convite" && <p className="success-notice">Convite enviado. O funcionário deve abrir o e-mail e definir a senha para ativar o primeiro acesso.</p>}
        {params.success === "atualizado" && <p className="success-notice">Cadastro atualizado e alteração registrada na auditoria.</p>}
        {params.error && <p className="notice">{messages[params.error] || "Não foi possível concluir a operação."}</p>}

        <section className="admin-card">
          <h2>Convidar funcionário</h2>
          <p className="muted">O sistema envia um convite por e-mail. Nenhuma senha é criada ou compartilhada pela TI.</p>
          <form action={inviteEmployee} className="admin-form">
            <label>Nome completo<input name="full_name" required minLength={2} maxLength={160} /></label>
            <label>E-mail corporativo<input name="email" type="email" required placeholder="nome@ulife.com.br" /></label>
            <label>Departamento<input name="department" maxLength={120} /></label>
            <button className="primary-button admin-submit" type="submit">Enviar convite</button>
          </form>
        </section>

        <section className="admin-card">
          <div className="section-title-row"><h2>Diretório administrativo</h2><span className="muted">Acesso restrito à TI</span></div>
          {error ? <p className="notice">Não foi possível carregar os funcionários.</p> : (
            <div className="employee-list">
              {(employees ?? []).map((employee) => (
                <form action={updateEmployee} className="employee-row" key={employee.id}>
                  <input type="hidden" name="user_id" value={employee.id} />
                  <div className="employee-identity">
                    <strong>{employee.full_name}</strong><span>{employee.email}</span>
                    <small>{employee.status === "active" ? "Acesso ativo" : "Acesso bloqueado"}</small>
                  </div>
                  <label>Nome<input name="full_name" defaultValue={employee.full_name} required minLength={2} maxLength={160} /></label>
                  <label>Departamento<input name="department" defaultValue={employee.department ?? ""} maxLength={120} /></label>
                  <label>Perfil<select name="role" defaultValue={employee.role}>
                    <option value="employee">Funcionário</option><option value="it_admin">Administrador de TI</option>
                  </select></label>
                  <label>Status<select name="status" defaultValue={employee.status}>
                    <option value="active">Ativo</option><option value="disabled">Desativado</option>
                  </select></label>
                  <button className="secondary-action" type="submit">Salvar alterações</button>
                </form>
              ))}
              {(!employees || employees.length === 0) && <p className="muted">Nenhum funcionário cadastrado.</p>}
            </div>
          )}
        </section>
        <p className="admin-footnote">Contas e históricos não são excluídos. A desativação bloqueia o acesso aos recursos; todas as alterações administrativas são registradas.</p>
      </section>
    </main>
  );
}
