// Helper de desenvolvimento: gera um cookie de sessão válido para testes.
// Uso: node scripts/dev-cookie.mjs            (admin da org demo)
//      node scripts/dev-cookie.mjs super       (super admin, sem org)
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const secret = (env.match(/AUTH_SECRET="?([^"\n]+)"?/) || [])[1];

const mode = process.argv[2];
const prisma = new PrismaClient();

let payload;
if (mode === "super") {
  const u = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  payload = { name: u?.name ?? "Super Admin", email: u?.email ?? "super@portal.local", role: "SUPER_ADMIN", org: null, sub: u?.id ?? "dev-super" };
} else {
  const u = await prisma.user.findFirst({ where: { role: "ADMIN" }, include: { organization: true } });
  payload = { name: u?.name ?? "Administrador", email: u?.email ?? "admin@portal.local", role: "ADMIN", org: u?.organizationId ?? null, sub: u?.id ?? "dev-admin" };
}
await prisma.$disconnect();

const token = await new SignJWT(payload)
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(payload.sub)
  .setIssuedAt()
  .setExpirationTime("8h")
  .sign(new TextEncoder().encode(secret));

console.log(token);
