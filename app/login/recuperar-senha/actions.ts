"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordRecovery(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login/recuperar-senha?error=email");
  }

  // Preview links return to this exact deployment, not localhost or Production.
  const vercelHost = process.env.VERCEL_URL;
  const configuredSite = process.env.NEXT_PUBLIC_SITE_URL;
  const siteUrl = vercelHost
    ? `https://${vercelHost}`
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
