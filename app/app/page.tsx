import { redirect } from "next/navigation";
import Link from "next/link";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name,email,department,role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== "active") {
    redirect("/login?reason=inactive");
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark"><span className="brand-symbol" aria-hidden="true">C</span> CALUNGA · ChatApp</div>
        <form action={signOut}><button className="secondary-button" type="submit">Sair com segurança</button></form>
      </header>
      <section className="app-main">
        <div className="welcome-card">
          <span className="auth-eyebrow">Sessão autenticada</span>
          <h1>Bem-vindo(a), {profile.full_name}.</h1>
          <p className="muted">Sua identidade foi validada pelo Supabase Auth e seu perfil está ativo no cadastro corporativo.</p>
          <p><strong>E-mail:</strong> {profile.email}</p>
          <p><strong>Departamento:</strong> {profile.department || "Não informado"}</p>
          <p><strong>Perfil de acesso:</strong> {profile.role === "it_admin" ? "Tecnologia da Informação" : "Funcionário"}</p>
          <div className="welcome-actions"><Link className="admin-entry-link" href="/app/conversas">Abrir conversas</Link>{profile.role === "it_admin" && <Link className="admin-entry-link" href="/app/admin/funcionarios">Administrar funcionários</Link>}</div>
          {profile.role === "it_admin" && <Link className="admin-entry-link" href="/app/admin/funcionarios">Abrir painel de administração de funcionários</Link>}
        </div>
      </section>
    </main>
  );
}
