import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

export const SESSION_COOKIE = "portal_session";
const MAX_AGE = 60 * 60 * 8; // 8 horas

export interface SessionPayload {
  sub: string; // user id
  name: string;
  email: string;
  role: Role;
  org: string | null; // organizationId (null para SUPER_ADMIN)
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET não definido no ambiente (.env).");
  }
  return new TextEncoder().encode(secret);
}

/** Assina um JWT de sessão. Funciona em Edge e Node. */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());
}

/** Verifica um JWT de sessão; retorna o payload ou null. */
export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as Role,
      org: payload.org ? String(payload.org) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna a organização da sessão atual ou null. Use em Server Components/Actions
 * para escopar consultas. SUPER_ADMIN não tem org (gerencia a plataforma).
 */
export async function getOrgId(): Promise<string | null> {
  const session = await getSession();
  return session?.org ?? null;
}

/** Lê a sessão atual a partir do cookie (Server Components / Actions). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** Grava o cookie de sessão. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Remove o cookie de sessão (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
