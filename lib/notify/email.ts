import nodemailer from "nodemailer";

export interface SendResult {
  status: "SENT" | "SIMULATED" | "FAILED";
  info?: string;
}

/**
 * Host SMTP efetivo. Se o usuário informar só o e-mail/senha (caso Gmail),
 * assumimos smtp.gmail.com automaticamente.
 */
function smtpHost(): string | undefined {
  const host = process.env.SMTP_HOST?.trim();
  if (host) return host;
  const user = process.env.SMTP_USER?.trim();
  if (user && /@gmail\.com$/i.test(user)) return "smtp.gmail.com";
  return undefined;
}

/**
 * SMTP está configurado quando temos usuário, senha e um host (explícito ou
 * inferido do Gmail). Sem isso, o envio roda em modo simulado.
 */
export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASSWORD?.trim() && smtpHost());
}

/** Remetente: usa SMTP_FROM se for um endereço real; senão, o próprio usuário. */
function fromAddress(): string {
  const from = process.env.SMTP_FROM?.trim();
  // ignora o placeholder do .env.example
  if (from && !/suaempresa\.com/i.test(from)) return from;
  return process.env.SMTP_USER!.trim();
}

/** Endereço de demonstração que não corresponde a uma caixa real. */
export function isPlaceholderEmail(email: string): boolean {
  return /@portal\.local$/i.test(email.trim());
}

function buildTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: smtpHost(),
    port,
    // 465 = SSL implícito (secure true); 587 = STARTTLS (secure false)
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASSWORD!.trim(),
    },
  });
}

/**
 * Envia um e-mail via SMTP. Se o SMTP não estiver configurado no .env,
 * retorna SIMULATED (sem envio real) para o portal funcionar no MVP.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<SendResult> {
  if (!smtpConfigured()) {
    console.log(`[email:SIMULADO] para=${to} assunto="${subject}" (defina SMTP_* no .env para enviar de verdade)`);
    return { status: "SIMULATED", info: "SMTP não configurado" };
  }

  // Endereços de demonstração (@portal.local) não são caixas reais.
  if (isPlaceholderEmail(to)) {
    console.warn(`[email:IGNORADO] ${to} é um endereço de demonstração (não enviado).`);
    return { status: "FAILED", info: "Endereço de demonstração (@portal.local) — sem caixa real" };
  }

  try {
    const transporter = buildTransport();
    const info = await transporter.sendMail({
      from: fromAddress(),
      to,
      subject,
      text,
    });
    console.log(`[email:ENVIADO] para=${to} id=${info.messageId}`);
    return { status: "SENT", info: info.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[email:ERRO]", msg);
    return { status: "FAILED", info: msg };
  }
}

/**
 * Valida a conexão/credenciais SMTP sem enviar e-mail. Útil em diagnósticos.
 */
export async function verifyEmail(): Promise<SendResult> {
  if (!smtpConfigured()) {
    return { status: "SIMULATED", info: "SMTP não configurado" };
  }
  try {
    await buildTransport().verify();
    return { status: "SENT", info: `Conexão OK com ${smtpHost()}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "FAILED", info: msg };
  }
}
