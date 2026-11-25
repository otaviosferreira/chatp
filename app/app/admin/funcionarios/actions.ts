"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DOMAIN = (process.env.CORPORATE_EMAIL_DOMAIN || "ulife.com.br").toLowerCase().replace(/^@/, "");
const INVITE_COOKIE = "chatp_admin_invite_link";
const RECOVERY_COOKIE = "chatp_admin_recovery_link";

async function requireItAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active" || profile.role !== "it_admin") {
    redirect("/app?error=forbidden");
  }

  return { user, supabase };
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.toLowerCase().endsWith(`@${DOMAIN}`);
}

async function writeAudit(actorId: string, action: string, targetId: string, metadata: Record<string, string>) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: "profile",
    target_id: targetId,
    metadata,
  });
  if (error) throw new Error("A operação foi realizada, mas não foi possível registrar a auditoria. Acione a TI.");
}

export async function inviteEmployee(formData: FormData) {
  const { user } = await requireItAdmin();
  if (!process.env.SUPABASE_SECRET_KEY) redirect("/app/admin/funcionarios?error=secret");
  const fullName = value(formData, "full_name");
  const email = value(formData, "email").toLowerCase();
  const department = value(formData, "department");

  if (fullName.length < 2 || fullName.length > 160) redirect("/app/admin/funcionarios?error=nome");
  if (!validEmail(email)) redirect("/app/admin/funcionarios?error=dominio");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) redirect("/app/admin/funcionarios?error=config");

  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE);

  const redirectUrl = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;
  const admin = createAdminClient();

  // generateLink cria o usuário e retorna o link de ação sem disparar e-mail.
  const { data: generated, error: inviteError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { full_name: fullName },
      redirectTo: `${redirectUrl}/auth/confirm`,
    },
  });

  if (inviteError || !generated.user || !generated.properties?.action_link) {
    const providerCode = String(inviteError?.code ?? "");
    const providerMessage = String(inviteError?.message ?? "").toLowerCase();

    if (providerCode === "email_exists" || providerMessage.includes("already been registered") ||
        providerMessage.includes("already exists")) {
      redirect("/app/admin/funcionarios?error=email-existente");
    }
    redirect("/app/admin/funcionarios?error=convite");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: generated.user.id,
    full_name: fullName,
    email,
    department: department || null,
    role: "employee",
    status: "active",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(generated.user.id);
    redirect("/app/admin/funcionarios?error=perfil");
  }

  await writeAudit(user.id, "employee.invited", generated.user.id, { email, department });

  // Link temporário fica em cookie HttpOnly, disponível apenas na área administrativa.
  cookieStore.set(INVITE_COOKIE, generated.properties.action_link, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 10 * 60,
  });

  revalidatePath("/app/admin/funcionarios");
  redirect("/app/admin/funcionarios?success=link");
}

export async function clearInviteLink() {
  await requireItAdmin();
  const cookieStore = await cookies();
  cookieStore.delete(INVITE_COOKIE);
  revalidatePath("/app/admin/funcionarios");
}

export async function generatePasswordRecoveryLink(formData: FormData) {
  const { user } = await requireItAdmin();
  if (!process.env.SUPABASE_SECRET_KEY) redirect("/app/admin/funcionarios?error=secret");

  const targetId = value(formData, "user_id");
  if (!targetId) redirect("/app/admin/funcionarios?error=nao-encontrado");

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id,email,status")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !target) redirect("/app/admin/funcionarios?error=nao-encontrado");
  if (target.status !== "active") redirect("/app/admin/funcionarios?error=conta-desativada");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) redirect("/app/admin/funcionarios?error=config");

  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);
  const redirectUrl = siteUrl.endsWith("/") ? siteUrl.slice(0, -1) : siteUrl;

  // generateLink retorna um link de recuperação sem depender de SMTP.
  const { data: generated, error: recoveryError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: target.email,
    options: { redirectTo: `${redirectUrl}/auth/confirm` },
  });

  if (recoveryError || !generated.properties?.action_link) {
    redirect("/app/admin/funcionarios?error=recuperacao");
  }

  await writeAudit(user.id, "employee.password_recovery_link_generated", target.id, {
    email: target.email,
  });

  cookieStore.set(RECOVERY_COOKIE, generated.properties.action_link, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 10 * 60,
  });

  revalidatePath("/app/admin/funcionarios");
  redirect("/app/admin/funcionarios?success=recuperacao");
}

export async function clearRecoveryLink() {
  await requireItAdmin();
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);
  revalidatePath("/app/admin/funcionarios");
}

export async function updateEmployee(formData: FormData) {
  const { user } = await requireItAdmin();
  if (!process.env.SUPABASE_SECRET_KEY) redirect("/app/admin/funcionarios?error=secret");
  const targetId = value(formData, "user_id");
  const fullName = value(formData, "full_name");
  const department = value(formData, "department");
  const role = value(formData, "role");
  const status = value(formData, "status");

  if (!targetId || fullName.length < 2 || fullName.length > 160) redirect("/app/admin/funcionarios?error=dados");
  if (!["employee", "it_admin"].includes(role) || !["active", "disabled"].includes(status)) {
    redirect("/app/admin/funcionarios?error=dados");
  }
  if (targetId === user.id && (role !== "it_admin" || status !== "active")) {
    redirect("/app/admin/funcionarios?error=propria-conta");
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id,role,status")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !target) redirect("/app/admin/funcionarios?error=nao-encontrado");

  const removesAdmin = target.role === "it_admin" && target.status === "active" &&
    (role !== "it_admin" || status !== "active");

  if (removesAdmin) {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "it_admin")
      .eq("status", "active");
    if (countError || (count ?? 0) <= 1) redirect("/app/admin/funcionarios?error=ultimo-admin");
  }

  const { error } = await admin.from("profiles").update({
    full_name: fullName,
    department: department || null,
    role,
    status,
    updated_at: new Date().toISOString(),
  }).eq("id", targetId);

  if (error) redirect("/app/admin/funcionarios?error=atualizacao");

  await writeAudit(user.id, "employee.updated", targetId, { role, status, department });
  revalidatePath("/app/admin/funcionarios");
  revalidatePath("/app");
  redirect("/app/admin/funcionarios?success=atualizado");
}
