import { sendSupportMessage } from "../lib/support-mailer.mjs";
import { handleCors, sendJson } from "../lib/http-api.mjs";

export default async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== "POST") {
    return sendJson(req, res, 405, { error: "Método não permitido." });
  }

  try {
    const body = await readJsonBody(req);
    const result = await sendSupportMessage(body);
    return sendJson(req, res, result.status, result.payload);
  } catch (error) {
    console.error("[api/support] unexpected error", error);
    return sendJson(req, res, 500, { error: "Não foi possível enviar sua mensagem agora." });
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);

    const totalSize = chunks.reduce((sum, part) => sum + part.length, 0);
    if (totalSize > 250_000) {
      throw new Error("Payload muito grande.");
    }
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}
