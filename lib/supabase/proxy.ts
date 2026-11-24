import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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

  // Necessário para renovar tokens e validar a identidade da sessão no servidor.
  const { data } = await supabase.auth.getClaims();
  const isProtected = request.nextUrl.pathname.startsWith("/app");
  const isLogin = request.nextUrl.pathname === "/login";

  if (isProtected && !data?.claims) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", "/app");
    return NextResponse.redirect(redirectUrl);
  }

  if (isLogin && data?.claims) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
