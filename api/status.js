import { getStatusPayload } from "../lib/quiz-ai.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Método não permitido." });
  }

  try {
    return sendJson(res, 200, getStatusPayload());
  } catch (error) {
    console.error("[api/status] unexpected error", error);
    return sendJson(res, 500, { error: "Erro interno no servidor." });
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
