import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["invite", "recovery", "signup", "email"];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const code = request.nextUrl.searchParams.get("code");
  const flow = request.nextUrl.searchParams.get("flow");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  // PKCE callbacks use a one-time code; custom OTP templates may use token_hash.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=convite-expirado", request.url));
    }
    const destination = flow === "recovery"
      ? "/auth/definir-senha?mode=recovery"
      : flow === "invite"
        ? "/auth/definir-senha?mode=invite"
        : "/app";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (!tokenHash || !type || !allowedTypes.includes(type)) {
    return NextResponse.redirect(new URL("/login?error=convite-invalido", request.url));
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=convite-expirado", request.url));
  }

  const destination = type === "invite"
    ? "/auth/definir-senha?mode=invite"
    : type === "recovery"
      ? "/auth/definir-senha?mode=recovery"
      : "/app";
  return NextResponse.redirect(new URL(destination, request.url));
}
