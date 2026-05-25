import { resolveQuestionRequest } from "../lib/quiz-ai.mjs";
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
    const result = await resolveQuestionRequest(body);
    return sendJson(req, res, result.status, result.payload);
  } catch (error) {
    console.error("[api/questions] unexpected error", error);

    if (error instanceof SyntaxError) {
      return sendJson(req, res, 400, { error: "JSON inválido." });
    }

    return sendJson(req, res, 500, { error: "Erro interno no servidor." });
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
    if (totalSize > 1_000_000) {
      throw new Error("Payload muito grande.");
    }
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}
