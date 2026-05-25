import { getMonitoringConfig, getStatusPayload } from "../lib/quiz-ai.mjs";
import { getOpsSnapshot } from "../lib/ops-monitor.mjs";
import { handleCors, sendJson } from "../lib/http-api.mjs";

export default async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== "GET") {
    return sendJson(req, res, 405, { error: "Método não permitido." });
  }

  try {
    return sendJson(req, res, 200, {
      generatedAt: new Date().toISOString(),
      monitoring: getMonitoringConfig(),
      ops: getOpsSnapshot(),
      status: getStatusPayload(),
    });
  } catch (error) {
    console.error("[api/ops] unexpected error", error);
    return sendJson(req, res, 500, { error: "Erro interno no servidor." });
  }
}
