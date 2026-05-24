const DEFAULT_SUPPORT_TO_EMAIL = "mario.reis.junior@gmail.com";

export async function sendSupportMessage({ email, message, subject }, env = process.env) {
  const smtpHost = String(env.SMTP_HOST || "smtp.gmail.com").trim();
  const smtpPort = Number(env.SMTP_PORT || 465);
  const smtpSecure = String(env.SMTP_SECURE || "true").trim().toLowerCase() !== "false";
  const smtpUser = String(env.SMTP_USER || "").trim();
  const smtpPass = String(env.SMTP_PASS || "").trim();
  const supportToEmail = String(env.SUPPORT_TO_EMAIL || DEFAULT_SUPPORT_TO_EMAIL).trim();
  const supportFromEmail = String(env.SUPPORT_FROM_EMAIL || smtpUser || supportToEmail).trim();

  const normalizedEmail = sanitizeText(email, 120);
  const normalizedSubject = sanitizeText(subject, 120);
  const normalizedMessage = sanitizeMultilineText(message, 4000);

  if (!normalizedEmail || !normalizedSubject || !normalizedMessage) {
    return {
      payload: {
        error: "Preencha email, assunto e mensagem antes de enviar.",
      },
      status: 400,
    };
  }

  if (!smtpUser || !smtpPass) {
    return {
      payload: {
        error: "O envio de suporte ainda não está configurado no servidor.",
      },
      status: 503,
    };
  }

  let nodemailer;

  try {
    nodemailer = await import("nodemailer");
  } catch {
    return {
      payload: {
        error: "A dependência de email ainda não foi instalada no projeto.",
      },
      status: 503,
    };
  }

  const transporter = nodemailer.default.createTransport({
    auth: {
      pass: smtpPass,
      user: smtpUser,
    },
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
  });

  const mailSubject = `[Suporte Último Sobrevivente] ${normalizedSubject}`;
  const text = [
    "Nova mensagem enviada pela página de suporte.",
    "",
    `Email do usuário: ${normalizedEmail}`,
    `Assunto: ${normalizedSubject}`,
    "",
    "Mensagem:",
    normalizedMessage,
  ].join("\n");

  await transporter.sendMail({
    from: supportFromEmail,
    replyTo: normalizedEmail,
    subject: mailSubject,
    text,
    to: supportToEmail,
  });

  return {
    payload: {
      ok: true,
    },
    status: 202,
  };
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeMultilineText(value, maxLength) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
