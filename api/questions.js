import { resolveQuestionRequest } from "../lib/quiz-ai.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Método não permitido." });
  }

  try {
    const body = await readJsonBody(req);
    const result = await resolveQuestionRequest(body);
    return sendJson(res, result.status, result.payload);
  } catch (error) {
    console.error("[api/questions] unexpected error", error);

    if (error instanceof SyntaxError) {
      return sendJson(res, 400, { error: "JSON inválido." });
    }

    return sendJson(res, 500, { error: "Erro interno no servidor." });
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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
