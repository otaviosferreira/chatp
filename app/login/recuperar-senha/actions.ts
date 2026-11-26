"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordRecovery(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login/recuperar-senha?error=email");
  }

  // In Preview, return to this exact deployment; never redirect to localhost.
  const deploymentHost = process.env.VERCEL_URL?.trim();
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const host = process.env.VERCEL_ENV === "production"
    ? productionHost || deploymentHost
    : deploymentHost;

  const siteUrl = host
    ? `https://${host.replace(/^https?:\/\//i, "")}`
    : configuredSite && /^https:\/\//i.test(configuredSite)
      ? configuredSite.replace(/\/$/, "")
      : process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : null;

  if (!siteUrl) redirect("/login/recuperar-senha?error=config");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?flow=recovery`,
  });

  // Keep the response generic to prevent account enumeration.
  redirect("/login/recuperar-senha?sent=1");
}
