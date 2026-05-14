const DEFAULT_AI_PROVIDER = "auto";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export function getStatusPayload(env = process.env) {
  const activeProvider = getActiveProvider(env);

  return {
    aiReady: Boolean(activeProvider.apiKey),
    model: activeProvider.model,
    provider: activeProvider.name,
  };
}

export async function resolveQuestionRequest(body, env = process.env) {
  const activeProvider = getActiveProvider(env);
  const theme = sanitizeText(body?.theme, 80) || "Tema livre";
  const difficulty = normalizeDifficulty(body?.difficulty);
  const playerName = sanitizeText(body?.playerName, 60) || "Jogador";
  const recentQuestions = Array.isArray(body?.recentQuestions)
    ? body.recentQuestions.map((item) => sanitizeText(item, 240)).filter(Boolean).slice(-10)
    : [];

  if (!activeProvider.apiKey) {
    return {
      status: 503,
      payload: {
        error: activeProvider.name === "gemini"
          ? "Configure GEMINI_API_KEY nas variáveis do servidor para gerar perguntas com Gemini."
          : "Configure OPENAI_API_KEY ou GEMINI_API_KEY nas variáveis do servidor para gerar perguntas por IA.",
      },
    };
  }

  try {
    const question = await generateQuestion({
      provider: activeProvider,
      difficulty,
      playerName,
      recentQuestions,
      theme,
    });

    return {
      status: 200,
      payload: question,
    };
  } catch (error) {
    console.error("[quiz-ai] generate question error", error);
    const message = error instanceof Error ? error.message : "Não foi possível gerar a pergunta agora.";

    return {
      status: 502,
      payload: {
        error: translateApiError(message),
      },
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

async function generateQuestion({ provider, difficulty, playerName, recentQuestions, theme }) {
  if (provider.name === "gemini") {
    return generateQuestionWithGemini({
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      difficulty,
      model: provider.model,
      playerName,
      recentQuestions,
      theme,
    });
  }

  return generateQuestionWithOpenAI({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    difficulty,
    model: provider.model,
    playerName,
    recentQuestions,
    theme,
  });
}

async function generateQuestionWithOpenAI({ apiKey, baseUrl, difficulty, model, playerName, recentQuestions, theme }) {
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

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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

async function generateQuestionWithGemini({ apiKey, baseUrl, difficulty, model, playerName, recentQuestions, theme }) {
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
    `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
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

function translateApiError(message) {
  const text = String(message || "");

  if (/resource_exhausted|quota metric|free tier/i.test(text)) {
    return "O limite do Gemini Free Tier foi atingido no momento. Espere um pouco e tente novamente.";
  }

  if (/api key not valid|invalid api key|permission denied|api key/i.test(text)) {
    return "A chave da API configurada no servidor parece inválida. Confira as variáveis do ambiente e tente novamente.";
  }

  if (/quota|billing|plan/i.test(text)) {
    return "A conta da API está sem crédito, sem billing ativo ou já atingiu o limite disponível.";
  }

  if (/rate limit/i.test(text)) {
    return "A API atingiu o limite de requisições no momento. Espere um pouco e tente novamente.";
  }

  return text || "Não foi possível gerar a pergunta agora.";
}
