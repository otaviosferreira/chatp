import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearInviteLink, inviteEmployee, updateEmployee } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ success?: string; error?: string }>;

const messages: Record<string, string> = {
  nome: "Informe um nome válido.",
  dominio: "Use um e-mail do domínio corporativo autorizado.",
  convite: "Não foi possível gerar o link de primeiro acesso. Consulte os registros de Auth do Supabase.",
  "email-existente": "Este endereço já possui uma conta no Supabase Auth. Verifique o diretório ou utilize outro endereço corporativo.",
  perfil: "O cadastro não foi concluído porque o perfil não pôde ser criado.",
  dados: "Confira os dados informados.",
  "propria-conta": "Não é permitido desativar ou rebaixar sua própria conta administrativa.",
  "nao-encontrado": "Funcionário não encontrado.",
  "ultimo-admin": "A operação bloquearia o último administrador ativo.",
  atualizacao: "Não foi possível atualizar o cadastro.",
  config: "A URL pública do ChatP não está configurada no ambiente. A TI deve definir NEXT_PUBLIC_SITE_URL.",
  secret: "A chave administrativa do Supabase ainda não está configurada na Vercel. A TI deve adicionar SUPABASE_SECRET_KEY como variável secreta do servidor.",
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
  const cookieStore = await cookies();
  const inviteLink = cookieStore.get("chatp_admin_invite_link")?.value;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatP</div>
          <p className="admin-header-subtitle">Administração de funcionários</p>
        </div>
        <Link className="secondary-link" href="/app">Voltar ao início</Link>
      </header>
      <section className="admin-main">
        <div className="admin-heading">
          <div><span className="auth-eyebrow">Painel de TI</span><h1>Funcionários e acessos</h1>
            <p className="muted">Cadastre funcionários, atualize permissões e bloqueie acessos sem apagar o histórico.</p></div>
          <span className="admin-count">{employees?.length ?? 0} cadastros</span>
        </div>

        {params.success === "link" && <p className="success-notice">Funcionário cadastrado. O link individual de primeiro acesso está disponível abaixo por tempo limitado.</p>}
        {params.success === "atualizado" && <p className="success-notice">Cadastro atualizado e alteração registrada na auditoria.</p>}
        {params.error && <p className="notice">{messages[params.error] || "Não foi possível concluir a operação."}</p>}

        {inviteLink && (
          <section className="admin-card" aria-labelledby="invite-link-title">
            <h2 id="invite-link-title">Link de primeiro acesso</h2>
            <p className="muted">Copie o link e encaminhe diretamente ao funcionário por um canal corporativo autorizado. Ele permite ativar a conta e definir uma senha. Não publique nem compartilhe em grupos.</p>
            <p><a className="secondary-link" href={inviteLink} target="_blank" rel="noreferrer">Abrir link de primeiro acesso</a></p>
            <label>Link individual<input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label>
            <form action={clearInviteLink}>
              <button className="secondary-action" type="submit">Ocultar e descartar link desta tela</button>
            </form>
            <p className="admin-footnote">Por segurança, o link fica disponível nesta sessão administrativa por até 10 minutos. O prazo de validade do token é definido pelo Supabase Auth.</p>
          </section>
        )}

        <section className="admin-card">
          <h2>Adicionar funcionário</h2>
          <p className="muted">O Supabase cria a conta e gera um link individual de primeiro acesso. Nenhum e-mail é enviado e nenhuma senha é criada ou compartilhada pela TI.</p>
          <form action={inviteEmployee} className="admin-form">
            <label>Nome completo<input name="full_name" required minLength={2} maxLength={160} /></label>
            <label>E-mail corporativo<input name="email" type="email" required placeholder="nome@ulife.com.br" /></label>
            <label>Departamento<input name="department" maxLength={120} /></label>
            <button className="primary-button admin-submit" type="submit">Cadastrar e gerar link</button>
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
