import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStatusPayload, resolveQuestionRequest } from "./lib/quiz-ai.mjs";

process.loadEnvFile?.(".env");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/api/status") {
      return sendJson(res, 200, getStatusPayload());
    }

    if (req.method === "POST" && url.pathname === "/api/questions") {
      return handleQuestionRequest(req, res);
    }

    if (req.method === "GET") {
      return serveStaticFile(url.pathname, res);
    }

    return sendJson(res, 405, { error: "Método não permitido." });
  } catch (error) {
    console.error("[server] unexpected error", error);
    return sendJson(res, 500, { error: "Erro interno no servidor." });
  }
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`A porta ${PORT} ja esta em uso.`);
    console.error(`Se o app ja estiver rodando, abra uma destas URLs:`);
    for (const url of getAccessUrls()) {
      console.error(`- ${url}`);
    }
    process.exit(1);
  }

  if (error?.code === "EPERM") {
    console.error(`Sem permissao para abrir ${HOST}:${PORT}.`);
    console.error(`Tente outra porta, por exemplo: PORT=3001 node server.mjs`);
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, HOST, () => {
  console.log("Quiz mobile no ar.");
  console.log("Abra no computador:");
  console.log(`- http://localhost:${PORT}`);

  if (HOST === "0.0.0.0") {
    const lanUrls = getAccessUrls().filter((url) => !url.includes("localhost"));
    if (lanUrls.length) {
      console.log("Abra no celular, na mesma rede Wi-Fi:");
      for (const url of lanUrls) {
        console.log(`- ${url}`);
      }
    }
  } else {
    console.log(`- http://${HOST}:${PORT}`);
  }
});

async function handleQuestionRequest(req, res) {
  const body = await readJsonBody(req);
  const result = await resolveQuestionRequest(body);
  return sendJson(res, result.status, result.payload);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
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

async function serveStaticFile(requestPath, res) {
  const pathname = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = path
    .normalize(decodeURIComponent(pathname))
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Acesso negado." });
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });

    res.end(file);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return sendJson(res, 404, { error: "Arquivo não encontrado." });
    }

    throw error;
  }
}

function getAccessUrls() {
  const urls = new Set([`http://localhost:${PORT}`]);
  const networks = os.networkInterfaces();

  for (const entries of Object.values(networks)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      urls.add(`http://${entry.address}:${PORT}`);
    }
  }

  return [...urls];
}
