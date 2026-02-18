import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "completepay-token";
const LOGIN_PATH = "/auth/v2/login";

/**
 * Decodifica o payload do JWT (base64url) sem verificar assinatura.
 * Retorna null se invalido. Usado apenas para ler exp no middleware.
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as { exp?: number };
  } catch {
    return null;
  }
}

/** Verifica se o token existe e nao esta expirado (margem 60s). */
function isTokenValid(token: string | undefined): boolean {
  if (!token?.trim()) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  const exp = payload.exp;
  if (typeof exp !== "number") return true;
  return Math.floor(Date.now() / 1000) < exp - 60;
}

/**
 * Protege rotas do dashboard: exige cookie de auth com JWT valido (nao expirado).
 * Redireciona para /auth/v2/login se nao autenticado ou token expirado.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthPage = pathname.startsWith("/auth/v1") || pathname.startsWith("/auth/v2") || pathname === "/auth";
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/unauthorized") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api");

  if (isPublic || isAuthPage) {
    return NextResponse.next();
  }

  if (isDashboard) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!isTokenValid(token)) {
      const loginUrl = new URL(LOGIN_PATH, request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
