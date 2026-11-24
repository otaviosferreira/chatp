"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DOMAIN = (process.env.CORPORATE_EMAIL_DOMAIN || "ulife.com.br").toLowerCase().replace(/^@/, "");

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
  const fullName = value(formData, "full_name");
  const email = value(formData, "email").toLowerCase();
  const department = value(formData, "department");

  if (fullName.length < 2 || fullName.length > 160) redirect("/app/admin/funcionarios?error=nome");
  if (!validEmail(email)) redirect("/app/admin/funcionarios?error=dominio");

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://chatp-ten.vercel.app"}/auth/confirm`,
  });

  if (inviteError || !invited.user) {
    redirect("/app/admin/funcionarios?error=convite");
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    full_name: fullName,
    email,
    department: department || null,
    role: "employee",
    status: "active",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    redirect("/app/admin/funcionarios?error=perfil");
  }

  await writeAudit(user.id, "employee.invited", invited.user.id, { email, department });
  revalidatePath("/app/admin/funcionarios");
  redirect("/app/admin/funcionarios?success=convite");
}

export async function updateEmployee(formData: FormData) {
  const { user } = await requireItAdmin();
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
