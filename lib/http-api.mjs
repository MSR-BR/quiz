const SAME_ORIGIN_SCHEMES = new Set(["http", "https"]);
const LOCAL_ORIGIN_PREFIXES = ["http://localhost", "http://127.0.0.1"];
const NATIVE_APP_ORIGINS = new Set(["capacitor://localhost", "ionic://localhost"]);

export function handleCors(req, res) {
  const origin = normalizeOrigin(req.headers.origin);
  const allowedOrigin = resolveAllowedOrigin(req, origin);

  if (origin && !allowedOrigin) {
    sendCorsHeaders(res, null);
    res.statusCode = 403;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ error: "Origem não autorizada." }));
    return true;
  }

  sendCorsHeaders(res, allowedOrigin);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

export function sendJson(req, res, statusCode, payload) {
  const origin = normalizeOrigin(req.headers.origin);
  const allowedOrigin = resolveAllowedOrigin(req, origin);

  sendCorsHeaders(res, allowedOrigin);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function sendCorsHeaders(res, allowedOrigin) {
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
}

function resolveAllowedOrigin(req, origin) {
  if (!origin) {
    return null;
  }

  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin && origin === requestOrigin) {
    return origin;
  }

  if (LOCAL_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix))) {
    return origin;
  }

  if (NATIVE_APP_ORIGINS.has(origin)) {
    return origin;
  }

  const extraOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  if (extraOrigins.includes(origin)) {
    return origin;
  }

  return null;
}

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const directHost = String(req.headers.host || "").trim();
  const host = forwardedHost || directHost;

  if (!host) {
    return null;
  }

  const scheme = SAME_ORIGIN_SCHEMES.has(forwardedProto) ? forwardedProto : "http";
  return `${scheme}://${host}`;
}

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}
