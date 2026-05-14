import http from "node:http";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.loadEnvFile?.(".env");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const AI_PROVIDER = String(process.env.AI_PROVIDER || "auto").trim().toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_BASE_URL = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

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
      const activeProvider = getActiveProvider();
      return sendJson(res, 200, {
        aiReady: Boolean(activeProvider.apiKey),
        model: activeProvider.model,
        provider: activeProvider.name,
      });
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
  const activeProvider = getActiveProvider();
  const body = await readJsonBody(req);
  const theme = sanitizeText(body?.theme, 80) || "Tema livre";
  const difficulty = normalizeDifficulty(body?.difficulty);
  const playerName = sanitizeText(body?.playerName, 60) || "Jogador";
  const recentQuestions = Array.isArray(body?.recentQuestions)
    ? body.recentQuestions.map((item) => sanitizeText(item, 240)).filter(Boolean).slice(-10)
    : [];

  if (!activeProvider.apiKey) {
    return sendJson(res, 503, {
      error: activeProvider.name === "gemini"
        ? "Defina GEMINI_API_KEY para gerar perguntas com Gemini."
        : "Defina OPENAI_API_KEY ou GEMINI_API_KEY para gerar perguntas por IA.",
    });
  }

  try {
    const question = await generateQuestion({
      provider: activeProvider.name,
      difficulty,
      playerName,
      recentQuestions,
      theme,
    });

    return sendJson(res, 200, question);
  } catch (error) {
    console.error("[server] generate question error", error);
    const message = error instanceof Error ? error.message : "Não foi possível gerar a pergunta agora.";

    return sendJson(res, 502, {
      error: translateApiError(message),
    });
  }
}

async function generateQuestion({ provider, difficulty, playerName, recentQuestions, theme }) {
  if (provider === "gemini") {
    return generateQuestionWithGemini({
      difficulty,
      playerName,
      recentQuestions,
      theme,
    });
  }

  return generateQuestionWithOpenAI({
    difficulty,
    playerName,
    recentQuestions,
    theme,
  });
}

async function generateQuestionWithOpenAI({ difficulty, playerName, recentQuestions, theme }) {
  const systemPrompt = [
    "Você cria perguntas curtas e claras para um jogo de eliminação em grupo.",
    "Responda sempre e apenas em JSON válido.",
    "A pergunta deve ser adequada para leitura rápida em uma tela de celular.",
    "Não use múltipla escolha.",
    "Evite perguntas ambíguas, pegadinhas injustas ou respostas com muitas variações possíveis.",
    "Adapte a dificuldade para fácil, médio ou difícil.",
    "Se houver perguntas recentes, não repita a mesma ideia.",
    "Use português do Brasil.",
    "Retorne exatamente estas chaves: question, answer, explanation, hint, theme, difficulty.",
    "question: pergunta objetiva em no máximo 220 caracteres.",
    "answer: resposta curta e precisa em no máximo 140 caracteres.",
    "explanation: explicação curta do porquê em no máximo 220 caracteres.",
    "hint: dica opcional em no máximo 140 caracteres.",
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      objective: "Gerar uma pergunta inédita para um jogo mobile de eliminação.",
      theme,
      difficulty,
      playerName,
      recentQuestions,
    },
    null,
    2
  );

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      max_output_tokens: 320,
      text: {
        format: {
          type: "json_object",
        },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || `Falha na API de IA (${response.status}).`;
    throw new Error(message);
  }

  const rawText = extractOutputText(payload);
  if (!rawText) {
    throw new Error("A API retornou uma resposta vazia.");
  }

  const parsed = JSON.parse(stripCodeFences(rawText));

  return {
    answer: sanitizeText(parsed.answer, 140) || "Resposta não informada",
    difficulty: normalizeDifficulty(parsed.difficulty || difficulty),
    explanation: sanitizeText(parsed.explanation, 220) || "Sem explicação adicional.",
    generatedAt: new Date().toISOString(),
    hint: sanitizeText(parsed.hint, 140),
    question: sanitizeText(parsed.question, 220) || "Pergunta não informada.",
    theme: sanitizeText(parsed.theme, 80) || theme,
  };
}

async function generateQuestionWithGemini({ difficulty, playerName, recentQuestions, theme }) {
  const prompt = [
    "Você cria perguntas curtas e claras para um jogo de eliminação em grupo.",
    "A pergunta deve ser adequada para leitura rápida em uma tela de celular.",
    "Não use múltipla escolha.",
    "Evite perguntas ambíguas, pegadinhas injustas ou respostas com muitas variações possíveis.",
    "Adapte a dificuldade para fácil, médio ou difícil.",
    "Se houver perguntas recentes, não repita a mesma ideia.",
    "Use português do Brasil.",
    "Gere uma pergunta inédita para este contexto de jogo:",
    JSON.stringify(
      {
        objective: "Gerar uma pergunta inédita para um jogo mobile de eliminação.",
        theme,
        difficulty,
        playerName,
        recentQuestions,
      },
      null,
      2
    ),
  ].join("\n\n");

  const response = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 320,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: {
                type: "string",
                description: "Pergunta objetiva em no máximo 220 caracteres.",
              },
              answer: {
                type: "string",
                description: "Resposta curta e precisa em no máximo 140 caracteres.",
              },
              explanation: {
                type: "string",
                description: "Explicação curta do porquê em no máximo 220 caracteres.",
              },
              hint: {
                type: ["string", "null"],
                description: "Dica opcional em no máximo 140 caracteres.",
              },
              theme: {
                type: "string",
                description: "Tema da pergunta.",
              },
              difficulty: {
                type: "string",
                enum: ["facil", "medio", "dificil", "fácil", "médio", "difícil"],
                description: "Dificuldade da pergunta.",
              },
            },
            required: ["question", "answer", "explanation", "hint", "theme", "difficulty"],
          },
        },
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.status || `Falha na API Gemini (${response.status}).`;
    throw new Error(message);
  }

  const rawText = extractGeminiText(payload);
  if (!rawText) {
    const blockReason = payload?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`A resposta foi bloqueada pelo Gemini (${blockReason}).`);
    }
    throw new Error("O Gemini retornou uma resposta vazia.");
  }

  const parsed = JSON.parse(stripCodeFences(rawText));

  return {
    answer: sanitizeText(parsed.answer, 140) || "Resposta não informada",
    difficulty: normalizeDifficulty(parsed.difficulty || difficulty),
    explanation: sanitizeText(parsed.explanation, 220) || "Sem explicação adicional.",
    generatedAt: new Date().toISOString(),
    hint: sanitizeText(parsed.hint || "", 140),
    question: sanitizeText(parsed.question, 220) || "Pergunta não informada.",
    theme: sanitizeText(parsed.theme, 80) || theme,
  };
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const chunks = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function extractGeminiText(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const chunks = [];

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      if (typeof part?.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function stripCodeFences(value) {
  return String(value)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeDifficulty(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "facil" || normalized === "fácil") {
    return "facil";
  }

  if (normalized === "dificil" || normalized === "difícil") {
    return "dificil";
  }

  return "medio";
}

function sanitizeText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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

function getActiveProvider() {
  const providers = {
    gemini: {
      name: "gemini",
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
    },
    openai: {
      name: "openai",
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
    },
  };

  if (AI_PROVIDER === "gemini") {
    return providers.gemini;
  }

  if (AI_PROVIDER === "openai") {
    return providers.openai;
  }

  if (GEMINI_API_KEY) {
    return providers.gemini;
  }

  return providers.openai;
}

function translateApiError(message) {
  const text = String(message || "");

  if (/quota|billing|plan/i.test(text)) {
    return "A conta da API está sem crédito ou sem billing ativo. Ative a cobrança na OpenAI e tente de novo.";
  }

  if (/api key/i.test(text)) {
    return "A chave da API parece inválida. Confira o arquivo .env e reinicie o servidor.";
  }

  if (/rate limit/i.test(text)) {
    return "A API atingiu o limite de requisições no momento. Espere um pouco e tente novamente.";
  }

  if (/resource_exhausted|quota metric|free tier/i.test(text)) {
    return "O limite do Gemini Free Tier foi atingido no momento. Espere um pouco ou troque de chave/provedor.";
  }

  if (/api key not valid|invalid api key|permission denied/i.test(text)) {
    return "A chave da API parece inválida. Confira o arquivo .env e reinicie o servidor.";
  }

  return text || "Não foi possível gerar a pergunta agora.";
}
