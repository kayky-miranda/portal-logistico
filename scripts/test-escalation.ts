// Teste do formato padronizado de escalonamento.
//   npx tsx scripts/test-escalation.ts            -> só imprime o formato
//   npx tsx scripts/test-escalation.ts --send      -> imprime e envia por e-mail
import { readFileSync } from "node:fs";
import { buildEscalationMessage } from "@/lib/notify";
import { sendEmail } from "@/lib/notify/email";

// carrega o .env para process.env (scripts não passam pelo Next)
const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
for (const line of raw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const exemplo = {
  nivel: "RED",
  fornecedorCliente: "SCANIA",
  componenteCodigo: "1516890",
  componenteDescricao: "Prateleira High",
  origemMaterial: "ACABADO",
  motivo: "ATRASO DE ENTREGAS",
  observacao:
    "Atraso (96 peças) nas entregas ocasionado pelos frequentes gargalos produtivos no setor de injeção. Os principais detratores identificados são a falta de matéria-prima, devido a bloqueios comerciais, e as recorrentes manutenções nas máquinas, impactando diretamente a capacidade produtiva e o atendimento ao cliente.",
  consumoCmd: 134,
  estoquePlascar: 10,
  setorProdutivo: "MONTAGEM",
  coberturaCliente: 2,
  abertura: new Date(),
};

const { header, body } = buildEscalationMessage(exemplo);
console.log("======= PRÉVIA DA MENSAGEM =======\n");
console.log(body);
console.log("\n==================================");
console.log("Assunto do e-mail:", header);

if (process.argv.includes("--send")) {
  (async () => {
    const to = (process.env.SMTP_USER || "").trim();
    console.log(`\n→ Enviando para ${to}...`);
    const res = await sendEmail(to, header, body);
    console.log("Resultado:", JSON.stringify(res));
  })();
}
