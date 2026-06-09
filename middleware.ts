import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

// Rotas públicas (não exigem login de sessão).
// /api/ingest é autenticada por API key da organização (não por cookie).
const PUBLIC_PATHS = ["/login", "/api/whatsapp/webhook", "/api/ingest"];

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  const authed = await isAuthenticated(req);

  // Usuário logado tentando acessar /login -> manda para o dashboard.
  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Rota protegida sem sessão -> manda para /login.
  if (!isPublic && !authed) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Aplica a tudo, exceto assets estáticos e internos do Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
