import { trackServerEvent } from "../lib/server-analytics.mjs";
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
    const name = sanitizeText(body?.name, 80);

    if (!name) {
      return sendJson(req, res, 400, { error: "Evento inválido." });
    }

    await trackServerEvent(name, sanitizeProperties(body?.properties));
    return sendJson(req, res, 202, { ok: true });
  } catch (error) {
    console.error("[api/events] unexpected error", error);
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
    if (totalSize > 250_000) {
      throw new Error("Payload muito grande.");
    }
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function sanitizeProperties(value) {
  const source = value && typeof value === "object" ? value : {};
  const entries = Object.entries(source).slice(0, 20);

  return Object.fromEntries(
    entries.map(([key, propertyValue]) => [sanitizeText(key, 60), normalizePropertyValue(propertyValue)])
  );
}

function normalizePropertyValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return sanitizeText(value, 180);
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
