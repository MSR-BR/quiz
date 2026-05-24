import { pickFallbackQuestion } from "./fallback-questions.mjs";
import { recordAiFailure, recordQuestionRequest, recordQuestionServed } from "./ops-monitor.mjs";
import { trackServerEvent } from "./server-analytics.mjs";

const DEFAULT_AI_PROVIDER = "auto";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
const AI_BATCH_SIZE = 4;
const AI_REQUEST_TIMEOUT_MS = 6500;
const CACHE_LIMIT_PER_KEY = 10;
const STOP_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "é",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "que",
  "quem",
  "qual",
  "quais",
  "como",
  "onde",
  "quando",
  "por",
  "para",
  "ao",
  "aos",
  "à",
  "às",
  "foi",
  "são",
  "ser",
  "se",
  "seu",
  "sua",
  "seus",
  "suas",
]);
const QUESTION_CACHE = new Map();

export function getStatusPayload(env = process.env) {
  const activeProvider = getActiveProvider(env);

  return {
    aiReady: Boolean(activeProvider.apiKey),
    model: activeProvider.model,
    provider: activeProvider.name,
  };
}

export function getMonitoringConfig(env = process.env) {
  return {
    geminiPricingConfigured: hasPricingConfig("GEMINI", env),
    openAiPricingConfigured: hasPricingConfig("OPENAI", env),
  };
}

export async function resolveQuestionRequest(body, env = process.env) {
  const startedAt = Date.now();
  const activeProvider = getActiveProvider(env);
  const theme = sanitizeText(body?.theme, 80) || "Tema livre";
  const difficulty = normalizeDifficulty(body?.difficulty);
  const playerName = sanitizeText(body?.playerName, 60) || "Jogador";
  const recentQuestions = Array.isArray(body?.recentQuestions)
    ? body.recentQuestions.map((item) => sanitizeText(item, 240)).filter(Boolean).slice(-10)
    : [];
  const cacheKey = createCacheKey(theme, difficulty);
  const cachedQuestion = takeCachedQuestion(cacheKey, recentQuestions);

  recordQuestionRequest();

  if (cachedQuestion) {
    recordQuestionServed({
      latencyMs: Date.now() - startedAt,
      provider: cachedQuestion.provider || activeProvider.name,
      source: cachedQuestion.source || "cache",
    });

    return {
      status: 200,
      payload: cachedQuestion,
    };
  }

  if (!activeProvider.apiKey) {
    const fallbackPayload = buildFallbackPayload({
      difficulty,
      reason: "missing_api_key",
      recentQuestions,
      theme,
    });

    recordQuestionServed({
      fallbackReason: fallbackPayload.fallbackReason,
      latencyMs: Date.now() - startedAt,
      provider: activeProvider.name,
      source: fallbackPayload.source || "fallback",
    });

    return {
      status: 200,
      payload: fallbackPayload,
    };
  }

  try {
    const generation = await generateQuestionBatch({
      provider: activeProvider,
      difficulty,
      playerName,
      recentQuestions,
      theme,
    });
    const preparedQuestions = prepareQuestionBatch({
      difficulty,
      providerName: activeProvider.name,
      questions: generation.questions,
      recentQuestions,
      theme,
    });

    if (!preparedQuestions.length) {
      throw new Error("A IA retornou perguntas inválidas ou repetidas.");
    }

    const [currentQuestion, ...remainingQuestions] = preparedQuestions;
    storeCachedQuestions(cacheKey, remainingQuestions);
    recordQuestionServed({
      estimatedCostUsd: estimateUsageCost(activeProvider.name, generation.usage, env),
      latencyMs: Date.now() - startedAt,
      provider: activeProvider.name,
      source: currentQuestion.source || "ai",
      usage: generation.usage,
    });

    return {
      status: 200,
      payload: currentQuestion,
    };
  } catch (error) {
    console.error("[quiz-ai] generate question error", error);
    const translatedReason = error instanceof Error ? translateApiError(error.message) : "fallback_local";
    const fallbackPayload = buildFallbackPayload({
      difficulty,
      reason: translatedReason,
      recentQuestions,
      theme,
    });

    recordAiFailure({
      latencyMs: Date.now() - startedAt,
      provider: activeProvider.name,
      reason: translatedReason,
    });
    void trackServerEvent("erro", {
      difficulty,
      provider: activeProvider.name,
      reason: translatedReason,
      round: 0,
      scope: "ai",
      theme,
    });
    recordQuestionServed({
      fallbackReason: fallbackPayload.fallbackReason,
      latencyMs: Date.now() - startedAt,
      provider: activeProvider.name,
      source: fallbackPayload.source || "fallback",
    });

    return {
      status: 200,
      payload: fallbackPayload,
    };
  }
}

function getConfig(env) {
  return {
    aiProvider: String(env.AI_PROVIDER || DEFAULT_AI_PROVIDER).trim().toLowerCase(),
    geminiApiKey: String(env.GEMINI_API_KEY || "").trim(),
    geminiBaseUrl: String(env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL).replace(/\/$/, ""),
    geminiModel: String(env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
    openAiApiKey: String(env.OPENAI_API_KEY || "").trim(),
    openAiBaseUrl: String(env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, ""),
    openAiModel: String(env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL).trim(),
  };
}

function getActiveProvider(env) {
  const config = getConfig(env);
  const providers = {
    gemini: {
      name: "gemini",
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      baseUrl: config.geminiBaseUrl,
    },
    openai: {
      name: "openai",
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
      baseUrl: config.openAiBaseUrl,
    },
  };

  if (config.aiProvider === "gemini") {
    return providers.gemini;
  }

  if (config.aiProvider === "openai") {
    return providers.openai;
  }

  if (config.geminiApiKey) {
    return providers.gemini;
  }

  return providers.openai;
}

async function generateQuestionBatch({ provider, difficulty, playerName, recentQuestions, theme }) {
  if (provider.name === "gemini") {
    return generateQuestionBatchWithGemini({
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      difficulty,
      model: provider.model,
      playerName,
      recentQuestions,
      theme,
    });
  }

  return generateQuestionBatchWithOpenAI({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    difficulty,
    model: provider.model,
    playerName,
    recentQuestions,
    theme,
  });
}

async function generateQuestionBatchWithOpenAI({ apiKey, baseUrl, difficulty, model, playerName, recentQuestions, theme }) {
  const systemPrompt = buildSystemPrompt(difficulty);
  const userPrompt = JSON.stringify(
    {
      count: AI_BATCH_SIZE,
      objective: "Gerar um lote de perguntas inéditas para um jogo mobile de eliminação.",
      playerName,
      recentQuestions,
      theme,
    },
    null,
    2
  );

  const { payload, response } = await postJsonWithTimeout(`${baseUrl}/responses`, {
    body: {
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
      max_output_tokens: 900,
      model,
      temperature: 0.5,
      text: {
        format: {
          type: "json_object",
        },
      },
    },
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

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
    questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
    usage: extractOpenAiUsage(payload),
  };
}

async function generateQuestionBatchWithGemini({ apiKey, baseUrl, difficulty, model, playerName, recentQuestions, theme }) {
  const prompt = buildCombinedPrompt({
    count: AI_BATCH_SIZE,
    difficulty,
    playerName,
    recentQuestions,
    theme,
  });

  const { payload, response } = await postJsonWithTimeout(
    `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      body: {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 900,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              questions: {
                type: "array",
                minItems: AI_BATCH_SIZE,
                items: {
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
            },
            required: ["questions"],
          },
          temperature: 0.5,
        },
      },
    }
  );

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
    questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
    usage: extractGeminiUsage(payload),
  };
}

function buildSystemPrompt(difficulty) {
  const rubric = getDifficultyRubric(difficulty);

  return [
    "Você cria perguntas curtas e claras para um jogo de eliminação em grupo jogado no celular.",
    `Gere exatamente ${AI_BATCH_SIZE} perguntas diferentes entre si.`,
    "Responda sempre e apenas em JSON válido com a forma {\"questions\":[...]}",
    "Cada pergunta deve ter uma única resposta canônica, curta e objetiva.",
    "Não use múltipla escolha.",
    "Não use pegadinhas, enunciados vagos ou respostas com muitas interpretações possíveis.",
    "Não repita o mesmo subtema, entidade principal ou formulação nas perguntas do mesmo lote.",
    "Evite repetir a ideia das perguntas recentes enviadas pelo usuário.",
    "A pergunta deve caber bem em uma tela de celular e ter no máximo 220 caracteres.",
    "A resposta deve ter no máximo 140 caracteres.",
    "A explicação deve ter no máximo 220 caracteres.",
    "A dica é opcional e deve ter no máximo 140 caracteres.",
    `Régua de dificuldade para este lote: ${rubric}`,
    "Use português do Brasil.",
    "Retorne, para cada item, exatamente estas chaves: question, answer, explanation, hint, theme, difficulty.",
  ].join(" ");
}

function buildCombinedPrompt({ count, difficulty, playerName, recentQuestions, theme }) {
  return [
    buildSystemPrompt(difficulty),
    "Contexto do lote:",
    JSON.stringify(
      {
        count,
        objective: "Gerar perguntas inéditas e objetivas para um jogo mobile de eliminação.",
        playerName,
        recentQuestions,
        theme,
      },
      null,
      2
    ),
  ].join("\n\n");
}

function getDifficultyRubric(difficulty) {
  if (difficulty === "facil") {
    return "fácil = conhecimento popular do tema, resposta amplamente conhecida, sem exigir detalhe obscuro, cálculo longo ou memória muito específica.";
  }

  if (difficulty === "dificil") {
    return "difícil = detalhe menos óbvio, termo técnico, data, autor, conceito ou fato mais específico, mas ainda objetivo e verificável com resposta curta.";
  }

  return "médio = exige alguma memória ou associação sobre o tema, mas ainda sem cair em nicho extremo ou detalhe injusto.";
}

function prepareQuestionBatch({ difficulty, providerName, questions, recentQuestions, theme }) {
  const acceptedQuestions = [];
  const comparisonPool = [...recentQuestions];
  const signatures = new Set(recentQuestions.map(createQuestionSignature));

  for (const item of Array.isArray(questions) ? questions : []) {
    const normalizedItem = normalizeQuestionItem(item, {
      difficulty,
      providerName,
      theme,
    });

    if (!normalizedItem) {
      continue;
    }

    const signature = createQuestionSignature(normalizedItem.question);
    if (!signature || signatures.has(signature)) {
      continue;
    }

    if (isQuestionTooSimilar(normalizedItem.question, comparisonPool)) {
      continue;
    }

    if (isAnswerLeaked(normalizedItem.question, normalizedItem.answer)) {
      continue;
    }

    signatures.add(signature);
    comparisonPool.push(normalizedItem.question);
    acceptedQuestions.push(normalizedItem);
  }

  return acceptedQuestions;
}

function normalizeQuestionItem(item, { difficulty, providerName, theme }) {
  const question = ensureQuestionMark(sanitizeText(item?.question, 220));
  const answer = sanitizeText(item?.answer, 140);
  const explanation = sanitizeText(item?.explanation, 220);
  const hint = sanitizeText(item?.hint, 140);

  if (question.length < 18 || answer.length < 1 || explanation.length < 24) {
    return null;
  }

  return {
    answer,
    difficulty,
    explanation,
    generatedAt: new Date().toISOString(),
    hint,
    provider: providerName,
    question,
    source: "ai",
    theme: sanitizeText(item?.theme, 80) || theme,
  };
}

function buildFallbackPayload({ difficulty, reason, recentQuestions, theme }) {
  return {
    ...pickFallbackQuestion({
      difficulty,
      recentQuestions,
      theme,
    }),
    fallbackReason: reason,
  };
}

async function postJsonWithTimeout(url, { body, headers = {} }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    return {
      payload,
      response,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("timeout");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function takeCachedQuestion(cacheKey, recentQuestions) {
  const queue = QUESTION_CACHE.get(cacheKey);
  if (!Array.isArray(queue) || !queue.length) {
    return null;
  }

  while (queue.length) {
    const candidate = queue.shift();

    if (!isQuestionTooSimilar(candidate.question, recentQuestions)) {
      if (queue.length) {
        QUESTION_CACHE.set(cacheKey, queue);
      } else {
        QUESTION_CACHE.delete(cacheKey);
      }

      return {
        ...candidate,
        source: "cache",
      };
    }
  }

  QUESTION_CACHE.delete(cacheKey);
  return null;
}

function storeCachedQuestions(cacheKey, questions) {
  const freshQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
  if (!freshQuestions.length) {
    return;
  }

  const existingQueue = Array.isArray(QUESTION_CACHE.get(cacheKey)) ? QUESTION_CACHE.get(cacheKey) : [];
  const mergedQueue = [...existingQueue, ...freshQuestions].slice(0, CACHE_LIMIT_PER_KEY);

  QUESTION_CACHE.set(cacheKey, mergedQueue);
}

function createCacheKey(theme, difficulty) {
  return `${normalizeLooseText(theme)}::${difficulty}`;
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
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function ensureQuestionMark(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (/[?!.]$/.test(text)) {
    return text.endsWith("?") ? text : `${text.slice(0, -1)}?`;
  }

  return `${text}?`;
}

function isAnswerLeaked(question, answer) {
  const normalizedAnswer = normalizeLooseText(answer);
  const normalizedQuestion = normalizeLooseText(question);

  if (normalizedAnswer.length < 4 || !normalizedQuestion) {
    return false;
  }

  if (normalizedQuestion.includes(normalizedAnswer)) {
    return true;
  }

  const answerTokens = tokenizeForSimilarity(answer);
  const questionTokens = new Set(tokenizeForSimilarity(question));

  return answerTokens.length > 0 && answerTokens.every((token) => questionTokens.has(token));
}

function isQuestionTooSimilar(question, otherQuestions) {
  const baseTokens = tokenizeForSimilarity(question);
  if (!baseTokens.length) {
    return false;
  }

  const baseSet = new Set(baseTokens);
  const baseJoined = baseTokens.join(" ");

  for (const otherQuestion of otherQuestions) {
    const otherTokens = tokenizeForSimilarity(otherQuestion);
    if (!otherTokens.length) {
      continue;
    }

    const otherSet = new Set(otherTokens);
    const overlap = otherTokens.filter((token) => baseSet.has(token)).length;
    const unionSize = new Set([...baseSet, ...otherSet]).size;
    const similarityScore = unionSize ? overlap / unionSize : 0;
    const otherJoined = otherTokens.join(" ");

    if (similarityScore >= 0.68) {
      return true;
    }

    if (baseJoined && otherJoined && (baseJoined.includes(otherJoined) || otherJoined.includes(baseJoined))) {
      return true;
    }
  }

  return false;
}

function tokenizeForSimilarity(text) {
  return normalizeLooseText(text)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function createQuestionSignature(value) {
  return tokenizeForSimilarity(value).join(" ");
}

function normalizeLooseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function translateApiError(message) {
  const text = String(message || "");

  if (/timeout/i.test(text)) {
    return "timeout";
  }

  if (/resource_exhausted|quota metric|free tier/i.test(text)) {
    return "quota_gemini";
  }

  if (/api key not valid|invalid api key|permission denied|api key/i.test(text)) {
    return "invalid_api_key";
  }

  if (/quota|billing|plan/i.test(text)) {
    return "billing";
  }

  if (/rate limit/i.test(text)) {
    return "rate_limit";
  }

  return "fallback_local";
}

function extractOpenAiUsage(payload) {
  const inputTokens = Number(payload?.usage?.input_tokens || 0);
  const outputTokens = Number(payload?.usage?.output_tokens || 0);
  const totalTokens = Number(payload?.usage?.total_tokens || inputTokens + outputTokens || 0);

  return {
    inputTokens,
    outputTokens,
    providerCall: true,
    totalTokens,
  };
}

function extractGeminiUsage(payload) {
  const inputTokens = Number(payload?.usageMetadata?.promptTokenCount || 0);
  const outputTokens = Number(payload?.usageMetadata?.candidatesTokenCount || 0);
  const totalTokens = Number(payload?.usageMetadata?.totalTokenCount || inputTokens + outputTokens || 0);

  return {
    inputTokens,
    outputTokens,
    providerCall: true,
    totalTokens,
  };
}

function estimateUsageCost(providerName, usage, env) {
  if (!usage?.providerCall) {
    return null;
  }

  const prefix = providerName === "gemini" ? "GEMINI" : "OPENAI";
  const inputRate = readOptionalNumber(env[`${prefix}_INPUT_COST_PER_1M`]);
  const outputRate = readOptionalNumber(env[`${prefix}_OUTPUT_COST_PER_1M`]);

  if (inputRate === null || outputRate === null) {
    return null;
  }

  return Number(
    (
      ((usage.inputTokens || 0) / 1_000_000) * inputRate +
      ((usage.outputTokens || 0) / 1_000_000) * outputRate
    ).toFixed(6)
  );
}

function hasPricingConfig(prefix, env) {
  return readOptionalNumber(env[`${prefix}_INPUT_COST_PER_1M`]) !== null
    && readOptionalNumber(env[`${prefix}_OUTPUT_COST_PER_1M`]) !== null;
}

function readOptionalNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
