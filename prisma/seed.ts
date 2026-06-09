import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { evaluateAlerts } from "@/lib/alerts/engine";

const prisma = new PrismaClient();

function lastDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

function rand(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function main() {
  console.log("🌱 Seed (multi-tenant) iniciando...");

  // ---- Limpa estado anterior (ordem respeita as FKs) ---------------------
  await prisma.notification.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.faturamento.deleteMany();
  await prisma.demanda.deleteMany();
  await prisma.producao.deleteMany();
  await prisma.frete.deleteMany();
  await prisma.metaFaturamento.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ---- Super Admin (dono da plataforma, sem organização) -----------------
  const superEmail = process.env.SEED_SUPERADMIN_EMAIL || "super@portal.local";
  const superPass = process.env.SEED_SUPERADMIN_PASSWORD || "super123";
  await prisma.user.create({
    data: {
      name: "Super Admin",
      email: superEmail,
      passwordHash: await bcrypt.hash(superPass, 10),
      role: "SUPER_ADMIN",
      organizationId: null,
    },
  });
  console.log(`  • super admin: ${superEmail} senha: ${superPass}`);

  // ---- Organização de demonstração ---------------------------------------
  const org = await prisma.organization.create({
    data: {
      name: "Plascar (Demo)",
      slug: "plascar-demo",
      apiKey: "pl_" + crypto.randomBytes(24).toString("hex"),
      active: true,
    },
  });
  console.log(`  • organização: ${org.name} (/${org.slug})`);
  console.log(`    API key (ERP): ${org.apiKey}`);

  // ---- Usuários da organização -------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@portal.local";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const adminName = process.env.SEED_ADMIN_NAME || "Administrador";
  const users = [
    { name: adminName, email: adminEmail, password: adminPass, role: "ADMIN", phone: "+5511999990000" },
    { name: "Gestor Operações", email: "gestor@portal.local", password: "gestor123", role: "GESTOR", phone: "+5511999990001" },
    { name: "Analista Dados", email: "analista@portal.local", password: "analista123", role: "ANALISTA", phone: "+5511999990002" },
    { name: "Visualizador", email: "viewer@portal.local", password: "viewer123", role: "VIEWER", phone: null },
  ];
  for (const u of users) {
    await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        role: u.role,
        phone: u.phone,
        organizationId: org.id,
      },
    });
    console.log(`  • usuário: ${u.email} (${u.role}) senha: ${u.password}`);
  }

  const oid = org.id;
  const days = lastDays(60);
  const segmentos = ["Carros", "Caminhões", "Varejo"];
  const clientesPorSegmento: Record<string, string[]> = {
    Carros: ["Toyota", "Volkswagen", "Fiat", "Honda"],
    Caminhões: ["Mercedes-Benz", "Scania", "Volvo", "DAF"],
    Varejo: ["Carrinhos Carrefour", "Carrinhos Pão de Açúcar", "Carrinhos Assaí"],
  };
  const faixaFaturamento: Record<string, [number, number]> = {
    Carros: [50000, 120000],
    Caminhões: [60000, 140000],
    Varejo: [8000, 25000],
  };
  const skus = ["SKU-001", "SKU-002", "SKU-003"];
  const linhas = ["Linha 1", "Linha 2", "Linha 3"];
  const transportadoras = ["Transp. Alfa", "Transp. Beta", "Transp. Gama"];
  const rotas = ["SP-RJ", "SP-MG", "SP-PR", "SP-BA"];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // ---- Faturamento -------------------------------------------------------
  const fatRows: { organizationId: string; data: Date; cliente: string; segmento: string; valor: number }[] = [];
  for (const data of days) {
    const isLast = data === days[days.length - 1];
    for (const segmento of segmentos) {
      const [min, max] = faixaFaturamento[segmento];
      const valor = isLast ? rand(min, min + (max - min) * 0.2) : rand(min, max);
      fatRows.push({ organizationId: oid, data, cliente: pick(clientesPorSegmento[segmento]), segmento, valor });
    }
  }
  await prisma.faturamento.createMany({ data: fatRows });

  // ---- Demanda (demanda e realizado do dia) ------------------------------
  const demRows: { organizationId: string; data: Date; sku: string; segmento: string; demanda: number; realizado: number }[] = [];
  for (const data of days) {
    const isLast = data === days[days.length - 1];
    for (const sku of skus) {
      const demanda = rand(800, 1500);
      demRows.push({
        organizationId: oid, data, sku, segmento: pick(segmentos),
        demanda, realizado: Math.round(demanda * (isLast ? 1.15 : rand(0.8, 1.15))),
      });
    }
  }
  await prisma.demanda.createMany({ data: demRows });

  // ---- Produção ----------------------------------------------------------
  const prodRows: { organizationId: string; data: Date; linha: string; produto: string; programado: number; realizado: number }[] = [];
  for (const data of days) {
    const isLast = data === days[days.length - 1];
    for (const linha of linhas) {
      const programado = rand(900, 1100);
      prodRows.push({
        organizationId: oid, data, linha, produto: `Produto ${linha.slice(-1)}`,
        programado, realizado: Math.round(programado * (isLast ? 0.88 : rand(0.82, 1.02))),
      });
    }
  }
  await prisma.producao.createMany({ data: prodRows });

  // ---- Frete (sem peso) --------------------------------------------------
  const freteRows: { organizationId: string; data: Date; transportadora: string; rota: string; custo: number }[] = [];
  for (const data of days) {
    const isLast = data === days[days.length - 1];
    for (let i = 0; i < 2; i++) {
      freteRows.push({
        organizationId: oid, data, transportadora: pick(transportadoras), rota: pick(rotas),
        custo: isLast ? rand(4800, 5200) : rand(2000, 5000),
      });
    }
  }
  await prisma.frete.createMany({ data: freteRows });

  console.log(`  • dados: ${fatRows.length} faturamento, ${demRows.length} demanda, ${prodRows.length} produção, ${freteRows.length} frete`);

  // ---- Regras de alerta (da organização) ---------------------------------
  await prisma.alertRule.createMany({
    data: [
      { organizationId: oid, name: "Faturamento diário baixo", module: "faturamento", metric: "faturamento_dia", operator: "lt", yellowThreshold: 150000, redThreshold: 120000, active: true },
      { organizationId: oid, name: "Aderência da produção", module: "producao", metric: "aderencia_producao_pct", operator: "lt", yellowThreshold: 95, redThreshold: 90, active: true },
      { organizationId: oid, name: "Variação da demanda elevada", module: "variacao", metric: "variacao_demanda_pct_abs", operator: "gt", yellowThreshold: 10, redThreshold: 20, active: true },
      { organizationId: oid, name: "Custo de frete diário alto", module: "frete", metric: "custo_frete_dia", operator: "gt", yellowThreshold: 9000, redThreshold: 12000, active: true },
    ],
  });
  console.log("  • 4 regras de alerta criadas");

  const created = await evaluateAlerts(oid);
  console.log(`  • ${created.length} alerta(s) gerado(s):`);
  for (const a of created) console.log(`     - ${a.severity}: ${a.message}`);

  console.log("✅ Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
