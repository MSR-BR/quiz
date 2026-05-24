import { getMonitoringConfig, getStatusPayload } from "../lib/quiz-ai.mjs";
import { getOpsSnapshot } from "../lib/ops-monitor.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Método não permitido." });
  }

  try {
    return sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      monitoring: getMonitoringConfig(),
      ops: getOpsSnapshot(),
      status: getStatusPayload(),
    });
  } catch (error) {
    console.error("[api/ops] unexpected error", error);
    return sendJson(res, 500, { error: "Erro interno no servidor." });
  }
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}
