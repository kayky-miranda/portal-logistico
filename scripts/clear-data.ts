// Limpa os DADOS OPERACIONAIS de todas as organizações para começar do zero,
// mantendo as CONTAS (organizações, usuários), os contatos salvos, as regras de
// alerta e os escalonamentos.
//
// Remove: faturamento, demanda, produção, frete, metas, uploads, alertas e
// notificações (que dependem dos dados acima).
//
// Uso:  npm run db:clear
//
// ⚠️ Ação irreversível. Faça backup do arquivo prisma/dev.db se quiser preservar.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Limpando dados operacionais...");

  const removed = {
    notificacoes: (await prisma.notification.deleteMany()).count,
    alertas: (await prisma.alert.deleteMany()).count,
    metas: (await prisma.metaFaturamento.deleteMany()).count,
    faturamento: (await prisma.faturamento.deleteMany()).count,
    demanda: (await prisma.demanda.deleteMany()).count,
    producao: (await prisma.producao.deleteMany()).count,
    frete: (await prisma.frete.deleteMany()).count,
    uploads: (await prisma.upload.deleteMany()).count,
  };

  console.log("  Removidos:");
  for (const [k, v] of Object.entries(removed)) console.log(`    • ${k}: ${v}`);

  const orgs = await prisma.organization.count();
  const users = await prisma.user.count();
  const contacts = await prisma.contact.count();
  const rules = await prisma.alertRule.count();
  console.log(
    `  Mantidos: ${orgs} organização(ões), ${users} usuário(s), ${contacts} contato(s), ${rules} regra(s) de alerta.`,
  );
  console.log("✅ Pronto — o portal está limpo. Faça novos uploads para alimentar os dados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
