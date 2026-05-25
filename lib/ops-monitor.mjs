const MAX_RECENT_ERRORS = 12;
const MAX_RECENT_EVENTS = 24;

const store = {
  ai: {
    calls: 0,
    failures: 0,
    generated: 0,
    providers: {},
    timeouts: 0,
  },
  events: {
    erro: 0,
    partida_finalizada: 0,
    partida_iniciada: 0,
    pergunta_gerada: 0,
    suporte_recebido: 0,
  },
  questions: {
    cache: 0,
    fallback: 0,
    requests: 0,
    served: 0,
  },
  recentErrors: [],
  recentEvents: [],
  support: {
    delivered: 0,
    logged: 0,
  },
  serverStartedAt: new Date().toISOString(),
  totals: {
    estimatedCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
};

export function recordQuestionRequest() {
  store.questions.requests += 1;
}

export function recordQuestionServed({
  provider = "unknown",
  source = "unknown",
  fallbackReason = "",
  latencyMs = 0,
  usage = null,
  estimatedCostUsd = null,
}) {
  store.questions.served += 1;

  if (source === "cache") {
    store.questions.cache += 1;
  }

  if (source === "fallback") {
    store.questions.fallback += 1;
  }

  if (source === "ai") {
    store.ai.generated += 1;
  }

  if (usage?.providerCall) {
    store.ai.calls += 1;
  }

  if (provider) {
    const bucket = ensureProviderBucket(provider);
    bucket.served += 1;
    bucket.lastSource = source;
    bucket.lastLatencyMs = latencyMs;

    if (usage?.providerCall) {
      bucket.calls += 1;
    }

    if (usage?.inputTokens) {
      bucket.inputTokens += usage.inputTokens;
      store.totals.inputTokens += usage.inputTokens;
    }

    if (usage?.outputTokens) {
      bucket.outputTokens += usage.outputTokens;
      store.totals.outputTokens += usage.outputTokens;
    }

    if (usage?.totalTokens) {
      bucket.totalTokens += usage.totalTokens;
      store.totals.totalTokens += usage.totalTokens;
    }

    if (typeof estimatedCostUsd === "number" && Number.isFinite(estimatedCostUsd)) {
      bucket.estimatedCostUsd += estimatedCostUsd;
      store.totals.estimatedCostUsd += estimatedCostUsd;
    }
  }

  pushRecentEvent({
    fallbackReason,
    latencyMs,
    provider,
    source,
    type: "question_served",
  });
}

export function recordAiFailure({ provider = "unknown", latencyMs = 0, reason = "unknown" }) {
  store.ai.failures += 1;

  if (reason === "timeout") {
    store.ai.timeouts += 1;
  }

  const bucket = ensureProviderBucket(provider);
  bucket.failures += 1;
  bucket.lastError = reason;
  bucket.lastLatencyMs = latencyMs;

  pushRecentError({
    latencyMs,
    provider,
    reason,
    scope: "ai",
  });
}

export function recordFrontendEvent(name, properties = {}) {
  if (!name) {
    return;
  }

  if (!store.events[name]) {
    store.events[name] = 0;
  }

  store.events[name] += 1;
  pushRecentEvent({
    properties,
    type: name,
  });
}

export function getOpsSnapshot() {
  return {
    ai: {
      ...store.ai,
      providers: Object.fromEntries(
        Object.entries(store.ai.providers).map(([provider, bucket]) => [
          provider,
          {
            ...bucket,
            estimatedCostUsd: roundCurrency(bucket.estimatedCostUsd),
          },
        ])
      ),
    },
    events: { ...store.events },
    questions: { ...store.questions },
    recentErrors: [...store.recentErrors],
    recentEvents: [...store.recentEvents],
    support: { ...store.support },
    serverStartedAt: store.serverStartedAt,
    totals: {
      estimatedCostUsd: roundCurrency(store.totals.estimatedCostUsd),
      inputTokens: store.totals.inputTokens,
      outputTokens: store.totals.outputTokens,
      totalTokens: store.totals.totalTokens,
    },
    uptimeSeconds: Math.max(0, Math.round((Date.now() - Date.parse(store.serverStartedAt)) / 1000)),
  };
}

export function recordSupportMessage({ delivered = false } = {}) {
  store.events.suporte_recebido += 1;

  if (delivered) {
    store.support.delivered += 1;
  } else {
    store.support.logged += 1;
  }

  pushRecentEvent({
    delivered,
    type: "suporte_recebido",
  });
}

function ensureProviderBucket(provider) {
  if (!store.ai.providers[provider]) {
    store.ai.providers[provider] = {
      calls: 0,
      estimatedCostUsd: 0,
      failures: 0,
      inputTokens: 0,
      lastError: "",
      lastLatencyMs: 0,
      lastSource: "",
      outputTokens: 0,
      served: 0,
      totalTokens: 0,
    };
  }

  return store.ai.providers[provider];
}

function pushRecentError(entry) {
  store.recentErrors.unshift({
    ...entry,
    at: new Date().toISOString(),
  });
  store.recentErrors = store.recentErrors.slice(0, MAX_RECENT_ERRORS);
}

function pushRecentEvent(entry) {
  store.recentEvents.unshift({
    ...entry,
    at: new Date().toISOString(),
  });
  store.recentEvents = store.recentEvents.slice(0, MAX_RECENT_EVENTS);
}

function roundCurrency(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(6));
}
