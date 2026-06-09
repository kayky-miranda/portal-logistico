// Teste de envio de e-mail (diagnóstico do SMTP).
//
// Uso:
//   node scripts/test-email.mjs                 -> envia para o próprio SMTP_USER
//   node scripts/test-email.mjs voce@gmail.com  -> envia para o destino informado
//
// Lê as variáveis SMTP_* do arquivo .env. Não envia nada se o SMTP não
// estiver configurado.

import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";

// --- carrega o .env manualmente (scripts não passam pelo Next) -------------
function loadEnv() {
  const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const env = loadEnv();
const user = (env.SMTP_USER || "").trim();
const pass = (env.SMTP_PASSWORD || "").trim();
let host = (env.SMTP_HOST || "").trim();
if (!host && /@gmail\.com$/i.test(user)) host = "smtp.gmail.com";
const port = Number(env.SMTP_PORT || 587);
const secure = env.SMTP_SECURE === "true" || port === 465;
const from =
  env.SMTP_FROM && !/suaempresa\.com/i.test(env.SMTP_FROM) ? env.SMTP_FROM.trim() : user;
const to = (process.argv[2] || user || "").trim();

console.log("→ Configuração SMTP detectada:");
console.log(`   host=${host || "(vazio)"} port=${port} secure=${secure}`);
console.log(`   user=${user || "(vazio)"} from=${from || "(vazio)"}`);
console.log(`   destino=${to || "(vazio)"}\n`);

if (!user || !pass || !host) {
  console.error("✗ SMTP não configurado. Preencha SMTP_USER, SMTP_PASSWORD (e SMTP_HOST se não for Gmail) no .env.");
  process.exit(1);
}
if (!to) {
  console.error("✗ Sem destinatário. Passe um e-mail: node scripts/test-email.mjs voce@gmail.com");
  process.exit(1);
}

const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

try {
  console.log("→ Verificando conexão/credenciais...");
  await transporter.verify();
  console.log("✓ Conexão OK.\n");

  console.log(`→ Enviando e-mail de teste para ${to}...`);
  const info = await transporter.sendMail({
    from,
    to,
    subject: "✅ Teste — Portal Logístico",
    text:
      "Este é um e-mail de teste do Portal Logístico.\n\n" +
      "Se você recebeu esta mensagem, o envio por SMTP está funcionando.\n" +
      "As notificações de alertas e escalonamentos agora chegarão por e-mail.",
  });
  console.log(`✓ Enviado! messageId=${info.messageId}`);
  console.log("  Verifique a caixa de entrada (e também spam/promoções).");
} catch (err) {
  const msg = String(err?.message || err);
  console.error("\n✗ Falha no envio:");
  console.error(`  ${msg}`);
  if (/basic authentication is disabled/i.test(msg)) {
    console.error(
      "\n  Dica (Outlook/Microsoft): esta conta tem a autenticação básica DESLIGADA —\n" +
        "  o envio SMTP por usuário+senha não é mais permitido. Use um serviço de envio\n" +
        "  (Brevo, Resend, SendGrid) ou outra conta. App password não resolve aqui.",
    );
  } else if (/Username and Password not accepted|BadCredentials/i.test(msg)) {
    console.error(
      "\n  Dica (Gmail): use uma 'Senha de app' de 16 dígitos (não a senha normal).\n" +
        "  Ative a verificação em 2 etapas e gere em https://myaccount.google.com/apppasswords",
    );
  }
  process.exit(1);
}
