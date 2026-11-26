"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DOMAIN = (process.env.CORPORATE_EMAIL_DOMAIN || "ulife.com.br").toLowerCase().replace(/^@/, "");
const RECOVERY_COOKIE = "chatp_admin_recovery_link";
const TEMPORARY_PASSWORD = "123456";

async function requireItAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
  if (!profile || profile.status !== "active" || profile.role !== "it_admin") redirect("/app?error=forbidden");
  return { user, supabase };
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.toLowerCase().endsWith(`@${DOMAIN}`);
}

function getPublicSiteUrl() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const deploymentHost = process.env.VERCEL_URL?.trim();
  const host = process.env.VERCEL_ENV === "production"
    ? productionHost || deploymentHost
    : deploymentHost;
  if (host) {
    try {
      const parsed = new URL(host.includes("://") ? host : `https://${host}`);
      if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) return null;
      return parsed.origin;
    } catch { return null; }
  }
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) return null;
  try {
    const parsed = new URL(configuredUrl);
    if (process.env.VERCEL && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) return null;
    return parsed.origin;
  } catch { return null; }
}

function forcePublicRedirect(actionLink: string, siteUrl: string) {
  const parsed = new URL(actionLink);
  parsed.searchParams.set("redirect_to", `${siteUrl}/auth/confirm`);
  return parsed.toString();
}

async function writeAudit(actorId: string, action: string, targetId: string, metadata: Record<string, string>) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId, action, target_type: "profile", target_id: targetId, metadata,
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

  const admin = createAdminClient();
  const { data: generated, error: inviteError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { full_name: fullName } },
  });

  if (inviteError || !generated.user) {
    const providerCode = String(inviteError?.code ?? "");
    const providerMessage = String(inviteError?.message ?? "").toLowerCase();
    if (providerCode === "email_exists" || providerMessage.includes("already been registered") || providerMessage.includes("already exists")) {
      redirect("/app/admin/funcionarios?error=email-existente");
    }
    redirect("/app/admin/funcionarios?error=convite");
  }

  // DEMO ONLY: conta recebe senha temporária compartilhada e é obrigada a trocá-la no primeiro login.
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(generated.user.id, {
    password: TEMPORARY_PASSWORD,
    email_confirm: true,
    app_metadata: { ...generated.user.app_metadata, force_password_change: true },
  });
  if (authUpdateError) redirect("/app/admin/funcionarios?error=credencial");

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles").select("id,email").eq("id", generated.user.id).maybeSingle();
  if (existingProfileError || (existingProfile && existingProfile.email.toLowerCase() !== email)) {
    redirect("/app/admin/funcionarios?error=perfil");
  }

  const profileWrite = existingProfile
    ? await admin.from("profiles").update({
        full_name: fullName, department: department || null, role: "employee", status: "active",
        updated_at: new Date().toISOString(),
      }).eq("id", generated.user.id)
    : await admin.from("profiles").insert({
        id: generated.user.id, full_name: fullName, email, department: department || null,
        role: "employee", status: "active",
      });
  if (profileWrite.error) redirect("/app/admin/funcionarios?error=perfil");

  await writeAudit(user.id, "employee.invited", generated.user.id, { email, department, onboarding: "temporary_password" });
  revalidatePath("/app/admin/funcionarios");
  redirect("/app/admin/funcionarios?success=senha-temporaria");
}

export async function clearInviteLink() {
  await requireItAdmin();
  revalidatePath("/app/admin/funcionarios");
}

export async function generatePasswordRecoveryLink(formData: FormData) {
  const { user } = await requireItAdmin();
  if (!process.env.SUPABASE_SECRET_KEY) redirect("/app/admin/funcionarios?error=secret");
  const targetId = value(formData, "user_id");
  if (!targetId) redirect("/app/admin/funcionarios?error=nao-encontrado");

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin.from("profiles")
    .select("id,email,status").eq("id", targetId).maybeSingle();
  if (targetError || !target) redirect("/app/admin/funcionarios?error=nao-encontrado");
  if (target.status !== "active") redirect("/app/admin/funcionarios?error=conta-desativada");

  const siteUrl = getPublicSiteUrl();
  if (!siteUrl) redirect("/app/admin/funcionarios?error=config");
  const cookieStore = await cookies();
  cookieStore.delete(RECOVERY_COOKIE);

  const { data: generated, error: recoveryError } = await admin.auth.admin.generateLink({
    type: "recovery", email: target.email, options: { redirectTo: `${siteUrl}/auth/confirm` },
  });
  if (recoveryError || !generated.properties?.action_link) redirect("/app/admin/funcionarios?error=recuperacao");

  await writeAudit(user.id, "employee.password_recovery_link_generated", target.id, { email: target.email });
  cookieStore.set(RECOVERY_COOKIE, forcePublicRedirect(generated.properties.action_link, siteUrl), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
    path: "/", maxAge: 10 * 60,
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
  if (!["employee", "it_admin"].includes(role) || !["active", "disabled"].includes(status)) redirect("/app/admin/funcionarios?error=dados");
  if (targetId === user.id && (role !== "it_admin" || status !== "active")) redirect("/app/admin/funcionarios?error=propria-conta");

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin.from("profiles").select("id,role,status").eq("id", targetId).maybeSingle();
  if (targetError || !target) redirect("/app/admin/funcionarios?error=nao-encontrado");

  const removesAdmin = target.role === "it_admin" && target.status === "active" && (role !== "it_admin" || status !== "active");
  if (removesAdmin) {
    const { count, error: countError } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "it_admin").eq("status", "active");
    if (countError || (count ?? 0) <= 1) redirect("/app/admin/funcionarios?error=ultimo-admin");
  }

  const { error } = await admin.from("profiles").update({
    full_name: fullName, department: department || null, role, status, updated_at: new Date().toISOString(),
  }).eq("id", targetId);
  if (error) redirect("/app/admin/funcionarios?error=atualizacao");
  await writeAudit(user.id, "employee.updated", targetId, { role, status, department });
  revalidatePath("/app/admin/funcionarios");
  revalidatePath("/app");
  redirect("/app/admin/funcionarios?success=atualizado");
}
