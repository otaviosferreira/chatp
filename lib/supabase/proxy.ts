import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/configuracao") return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.redirect(new URL("/configuracao", request.url));
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Valida e renova a sessão antes de qualquer decisão baseada no usuário.
  const { data } = await supabase.auth.getClaims();
  const isProtected = path.startsWith("/app");

  if (isProtected && data?.claims) {
    const userId = typeof data.claims.sub === "string" ? data.claims.sub : null;
    const { data: profile, error } = userId
      ? await supabase.from("profiles").select("status").eq("id", userId).maybeSingle()
      : { data: null, error: new Error("Sessão sem identificador de usuário") };

    // Falha fechada: perfil inexistente, desabilitado ou consulta indisponível não libera a rota.
    if (error || profile?.status !== "active") {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("reason", "inactive");
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isProtected && !data?.claims) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", "/app");
    return NextResponse.redirect(redirectUrl);
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
