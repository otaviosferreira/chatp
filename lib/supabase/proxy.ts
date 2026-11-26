import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/configuracao") return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/configuracao", request.url));

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const isProtected = path.startsWith("/app");
  const isPasswordSetup = path === "/auth/definir-senha";

  if (claims) {
    const appMetadata = claims.app_metadata as Record<string, unknown> | undefined;
    const mustChangePassword = appMetadata?.force_password_change === true;
    if (mustChangePassword && isProtected) {
      return NextResponse.redirect(new URL("/auth/definir-senha?mode=first", request.url));
    }
    if (mustChangePassword && path === "/login") {
      return NextResponse.redirect(new URL("/auth/definir-senha?mode=first", request.url));
    }
    if (mustChangePassword && !isPasswordSetup && path !== "/auth/confirm") {
      // Keep the authenticated first-access session restricted to the password form.
      return NextResponse.redirect(new URL("/auth/definir-senha?mode=first", request.url));
    }
  }

  if (isProtected && claims) {
    const userId = typeof claims.sub === "string" ? claims.sub : null;
    const { data: profile, error } = userId
      ? await supabase.from("profiles").select("status").eq("id", userId).maybeSingle()
      : { data: null, error: new Error("Sessão sem identificador de usuário") };
    if (error || profile?.status !== "active") {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("reason", "inactive");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isProtected && !claims) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", "/app");
    return NextResponse.redirect(redirectUrl);
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
