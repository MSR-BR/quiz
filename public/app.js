const THEMES = [
  "Digite o tema",
  "Futebol",
  "História",
  "Física",
  "Geografia",
  "Matemática",
  "Direito",
  "Biologia",
  "Química",
  "Literatura",
  "Tecnologia",
  "Cinema",
  "Música",
  "Games",
  "Astronomia",
  "Política",
  "Artes",
  "Idiomas",
  "Culinária",
  "Economia",
  "Medicina",
  "Mitologia",
  "Empreendedorismo",
  "Séries",
];

const DIFFICULTIES = [
  {
    id: "facil",
    label: "Fácil",
    copy: "Perguntas diretas para aquecer o jogo.",
  },
  {
    id: "medio",
    label: "Médio",
    copy: "Mistura equilíbrio, memória e raciocínio.",
  },
  {
    id: "dificil",
    label: "Difícil",
    copy: "Mais exigente e ótimo para desempate.",
  },
];

const STORAGE_KEY = "ultimo-sobrevivente-v1";
const EMPTY_SELECTION = "";
const CUSTOM_THEME = "Digite o tema";
const APP_SESSION_ID = createId();
const buildApiUrl = window.ultimoSobreviventeConfig?.buildApiUrl || ((path) => path);
const APP_PUBLIC_URL = getPublicShareUrl();

const state = loadState();
const app = document.querySelector("#app");

app.addEventListener("click", onClick);
app.addEventListener("submit", onSubmit);
app.addEventListener("change", onChange);
window.addEventListener("online", handleConnectivityChange);
window.addEventListener("offline", handleConnectivityChange);

render();

function onClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const { action } = target.dataset;

  if (action === "remove-player") {
    removePlayer(target.dataset.playerId);
    return;
  }

  if (action === "select-theme") {
    state.selectedTheme = target.dataset.theme || CUSTOM_THEME;
    state.error = "";
    sync();
    if (state.selectedTheme === CUSTOM_THEME) {
      window.requestAnimationFrame(() => {
        document.querySelector("#custom-theme-input")?.focus();
      });
    }
    return;
  }

  if (action === "select-difficulty") {
    state.difficulty = target.dataset.difficulty || "medio";
    state.error = "";
    sync();
    return;
  }

  if (action === "start-game") {
    void startGame();
    return;
  }

  if (action === "reset-setup") {
    const shouldReset = window.confirm("Apagar jogadores, tema e nível e voltar ao estado inicial?");
    if (shouldReset) {
      resetAll();
    }
    return;
  }

  if (action === "show-answer") {
    state.revealAnswer = true;
    sync();
    return;
  }

  if (action === "toggle-hint") {
    state.showHint = !state.showHint;
    sync();
    return;
  }

  if (action === "retry-question") {
    void fetchQuestion();
    return;
  }

  if (action === "swap-question") {
    void fetchQuestion();
    return;
  }

  if (action === "mark-correct") {
    void finishTurn(false);
    return;
  }

  if (action === "mark-wrong") {
    void finishTurn(true);
    return;
  }

  if (action === "continue-next-turn") {
    void advanceToNextTurn();
    return;
  }

  if (action === "play-again") {
    void startGame();
    return;
  }

  if (action === "restart-match") {
    const shouldRestart = window.confirm("Recomeçar a partida com os mesmos jogadores e configurações?");
    if (shouldRestart) {
      void restartMatch();
    }
    return;
  }

  if (action === "restart-all") {
    const shouldRestart = window.confirm("Apagar jogadores, tema e nível e voltar ao estado inicial?");
    if (shouldRestart) {
      resetAll();
    }
    return;
  }

  if (action === "share-app") {
    void shareApp();
    return;
  }

  if (action === "share-result") {
    void shareResult();
    return;
  }

  if (action === "dismiss-flash") {
    state.flashMessage = null;
    sync();
    return;
  }

  if (action === "back-to-setup") {
    state.status = "setup";
    state.currentQuestion = null;
    state.loadingQuestion = false;
    state.revealAnswer = false;
    state.showHint = false;
    state.error = "";
    sync();
  }
}

function onSubmit(event) {
  if (event.target.id === "player-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    const rawName = String(formData.get("playerName") || "").trim();

    if (!rawName) {
      state.error = "Digite um nome antes de adicionar o jogador.";
      sync();
      return;
    }

    const alreadyExists = state.players.some(
      (player) => player.name.toLowerCase() === rawName.toLowerCase()
    );

    if (alreadyExists) {
      state.error = "Esse nome já está na lista.";
      sync();
      return;
    }

    state.players.push({
      id: createId(),
      name: rawName.slice(0, 30),
    });
    state.error = "";
    event.target.reset();
    sync();
    return;
  }
}

function onChange(event) {
  if (event.target.name === "customTheme") {
    state.customTheme = event.target.value.trim();
    sync();
  }
}

function removePlayer(playerId) {
  state.players = state.players.filter((player) => player.id !== playerId);
  state.error = "";
  sync();
}

function handleConnectivityChange() {
  const isOnline = window.navigator.onLine !== false;
  state.isOnline = isOnline;

  if (isOnline) {
    state.flashMessage = {
      tone: "success",
      text: "Conexão restabelecida. Você já pode gerar perguntas novamente.",
    };
  } else {
    state.flashMessage = null;
  }

  sync();
}

function resetSetup() {
  state.players = [];
  state.selectedTheme = "Futebol";
  state.customTheme = "";
  state.difficulty = "medio";
  state.activePlayers = [];
  state.currentPlayerIndex = 0;
  state.currentQuestion = null;
  state.eliminatedPlayers = [];
  state.error = "";
  state.loadingQuestion = false;
  state.recentQuestions = [];
  state.revealAnswer = false;
  state.round = 1;
  state.showHint = false;
  state.status = "setup";
  state.turnFeedback = null;
  state.timeline = [];
  state.winner = null;
  state.flashMessage = null;
  sync();
}

async function startGame() {
  syncCustomThemeInput();

  if (state.players.length < 2) {
    state.error = "Adicione pelo menos 2 jogadores para começar.";
    sync();
    return;
  }

  if (!getSelectedTheme()) {
    state.error = "Selecione um tema ou informe um tema personalizado.";
    sync();
    return;
  }

  if (!state.difficulty) {
    state.error = "Escolha o nível da partida.";
    sync();
    return;
  }

  state.status = "playing";
  state.round = 1;
  state.currentPlayerIndex = 0;
  state.activePlayers = state.players.map((player) => ({ ...player }));
  state.eliminatedPlayers = [];
  state.timeline = [];
  state.currentQuestion = null;
  state.revealAnswer = false;
  state.showHint = false;
  state.loadingQuestion = false;
  state.processingTurn = false;
  state.turnFeedback = null;
  state.winner = null;
  state.error = "";
  state.flashMessage = null;
  state.recentQuestions = [];
  sync();
  void trackProductEvent("partida_iniciada", {
    difficulty: state.difficulty,
    players_count: state.players.length,
    session_id: APP_SESSION_ID,
    theme: getSelectedTheme() || "Tema livre",
  });

  await fetchQuestion();
}

async function restartMatch() {
  await startGame();
}

function resetAll() {
  state.players = [];
  state.selectedTheme = EMPTY_SELECTION;
  state.customTheme = "";
  state.difficulty = EMPTY_SELECTION;
  state.activePlayers = [];
  state.currentPlayerIndex = 0;
  state.currentQuestion = null;
  state.eliminatedPlayers = [];
  state.error = "";
  state.loadingQuestion = false;
  state.recentQuestions = [];
  state.revealAnswer = false;
  state.round = 1;
  state.showHint = false;
  state.status = "setup";
  state.turnFeedback = null;
  state.timeline = [];
  state.winner = null;
  state.flashMessage = null;
  sync();
}

async function fetchQuestion() {
  const currentPlayer = state.activePlayers[state.currentPlayerIndex];
  if (!currentPlayer) {
    return;
  }

  if (!state.isOnline) {
    state.error = "Você está sem internet. Conecte o aparelho para gerar a próxima pergunta.";
    void trackProductEvent("erro", {
      difficulty: state.difficulty,
      reason: "offline",
      round: state.round,
      scope: "question_request",
      session_id: APP_SESSION_ID,
      theme: getSelectedTheme() || "Tema livre",
    });
    sync();
    return;
  }

  state.loadingQuestion = true;
  state.processingTurn = false;
  state.error = "";
  state.revealAnswer = false;
  state.showHint = false;
  sync();

  try {
    const { payload, response } = await requestJson(buildApiUrl("/api/questions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        difficulty: state.difficulty,
        playerName: currentPlayer.name,
        recentQuestions: state.recentQuestions.slice(-10),
        theme: getSelectedTheme(),
      }),
    });

    if (!response.ok) {
      throw new Error(payload.error || "Não foi possível gerar a pergunta.");
    }

    state.currentQuestion = payload;
    state.recentQuestions = [...state.recentQuestions.slice(-9), payload.question];
    if (payload.source === "fallback" && payload.fallbackReason) {
      void trackProductEvent("erro", {
        difficulty: state.difficulty,
        reason: payload.fallbackReason,
        round: state.round,
        scope: "ia",
        session_id: APP_SESSION_ID,
        theme: getSelectedTheme() || "Tema livre",
      });
    }
    void trackProductEvent("pergunta_gerada", {
      difficulty: payload.difficulty || state.difficulty,
      provider: payload.provider || "unknown",
      round: state.round,
      session_id: APP_SESSION_ID,
      source: payload.source || "unknown",
      theme: payload.theme || getSelectedTheme() || "Tema livre",
    });
  } catch (error) {
    state.currentQuestion = null;
    state.error = error instanceof Error ? error.message : "Falha inesperada.";
    void trackProductEvent("erro", {
      difficulty: state.difficulty,
      reason: state.error,
      round: state.round,
      scope: "question_request",
      session_id: APP_SESSION_ID,
      theme: getSelectedTheme() || "Tema livre",
    });
  } finally {
    state.loadingQuestion = false;
    sync();
  }
}

async function finishTurn(eliminatePlayer) {
  const currentPlayer = state.activePlayers[state.currentPlayerIndex];
  if (!currentPlayer || !state.currentQuestion || state.processingTurn) {
    return;
  }

  state.processingTurn = true;

  const roundLabel = `Rodada ${state.round}`;
  const questionTheme = state.currentQuestion.theme || getSelectedTheme();
  const resolvedAnswer = state.currentQuestion.answer;
  const resolvedExplanation = state.currentQuestion.explanation;
  const currentQuestionText = state.currentQuestion.question;
  let nextPlayerName = "";
  let turnFeedbackTone = eliminatePlayer ? "danger" : "success";
  let feedbackTitle = "";
  let feedbackCopy = "";
  let feedbackBadge = "";

  if (eliminatePlayer) {
    state.timeline.unshift({
      id: createId(),
      kind: "danger",
      title: `${roundLabel}: ${currentPlayer.name} foi eliminado`,
      copy: `Tema ${questionTheme}. A resposta correta era: ${resolvedAnswer}.`,
    });

    const [removedPlayer] = state.activePlayers.splice(state.currentPlayerIndex, 1);
    state.eliminatedPlayers.unshift({
      ...removedPlayer,
      round: state.round,
    });

    feedbackTitle = `${currentPlayer.name} saiu da partida`;
    feedbackCopy = `A resposta correta era ${resolvedAnswer}. ${state.activePlayers.length > 1 ? "O jogo continua com o próximo participante." : ""}`.trim();
    feedbackBadge = "Eliminado";
  } else {
    state.timeline.unshift({
      id: createId(),
      kind: "success",
      title: `${roundLabel}: ${currentPlayer.name} acertou`,
      copy: `Tema ${questionTheme}. Seguimos para a próxima pergunta.`,
    });

    state.currentPlayerIndex += 1;

    feedbackTitle = `${currentPlayer.name} acertou`;
    feedbackCopy = `A resposta correta era ${resolvedAnswer}. Vamos girar para o próximo jogador.`;
    feedbackBadge = "Acerto";
  }

  if (state.activePlayers.length === 1) {
    state.winner = state.activePlayers[0];
    state.status = "finished";
    state.currentQuestion = null;
    state.processingTurn = false;
    state.revealAnswer = false;
    state.showHint = false;
    state.turnFeedback = null;

    state.timeline.unshift({
      id: createId(),
      kind: "winner",
      title: `${state.winner.name} venceu a partida`,
      copy: `Sobrou apenas um jogador depois de ${state.round} rodada(s).`,
    });
    void trackProductEvent("partida_finalizada", {
      difficulty: state.difficulty,
      eliminated_players: state.eliminatedPlayers.length,
      rounds: state.round,
      session_id: APP_SESSION_ID,
      theme: getSelectedTheme() || "Tema livre",
    });
    triggerHaptic([90, 50, 120]);

    sync();
    return;
  }

  if (state.currentPlayerIndex >= state.activePlayers.length) {
    state.currentPlayerIndex = 0;
    state.round += 1;
  }

  nextPlayerName = state.activePlayers[state.currentPlayerIndex]?.name || "";
  state.currentQuestion = null;
  state.revealAnswer = false;
  state.showHint = false;
  state.turnFeedback = {
    badge: feedbackBadge,
    copy: feedbackCopy,
    explanation: resolvedExplanation,
    nextPlayerName,
    questionTheme,
    questionText: currentQuestionText,
    title: feedbackTitle,
    tone: turnFeedbackTone,
  };
  triggerHaptic(eliminatePlayer ? [120, 40, 120] : 50);
  sync();
}

async function advanceToNextTurn() {
  if (state.loadingQuestion) {
    return;
  }

  state.turnFeedback = null;
  sync();
  await fetchQuestion();
}

function getSelectedTheme() {
  if (state.selectedTheme === CUSTOM_THEME || state.selectedTheme === "Outro tema") {
    return state.customTheme.trim();
  }

  return state.selectedTheme;
}

function syncCustomThemeInput() {
  const customThemeInput = document.querySelector("#custom-theme-input");
  if (customThemeInput) {
    state.customTheme = customThemeInput.value.trim();
  }
}

function sync() {
  persistState();
  render();
}

function render() {
  if (state.turnFeedback) {
    app.innerHTML = renderTurnFeedback();
    return;
  }

  if (state.status === "playing") {
    app.innerHTML = renderGame();
    return;
  }

  if (state.status === "finished") {
    app.innerHTML = renderFinished();
    return;
  }

  app.innerHTML = renderSetup();
}

function renderSetup() {
  const selectedTheme = getSelectedTheme() || "Escolha um tema";
  const selectedDifficulty = state.difficulty ? formatDifficulty(state.difficulty) : "Escolha o nível";
  const canStart = state.players.length >= 2 && Boolean(getSelectedTheme());

  return `
    <section class="screen">
      <section class="hero-card">
        <div class="hero-topbar">
          <div class="eyebrow">Jogo de perguntas</div>
          <button
            type="button"
            class="icon-button"
            data-action="share-app"
            aria-label="Compartilhar jogo"
            title="Compartilhar jogo"
          >
            ${renderShareIcon()}
          </button>
        </div>
        <h1 class="hero-title">Último<br />Sobrevivente</h1>
        <p class="hero-copy">
          Um jogador segura o celular, lê a pergunta em voz alta e elimina quem errar.
          A rodada gira até restar só um.
        </p>
      </section>

      ${renderRuntimeAlerts()}

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">Jogadores</h2>
          <span class="section-note">${state.players.length} inscritos</span>
        </div>
        <p class="section-copy">Cadastre quem vai responder. O anfitrião pode ficar só com o celular na mão.</p>

        <form id="player-form" class="player-form">
          <div class="field-row">
            <input
              class="text-input"
              type="text"
              name="playerName"
              maxlength="30"
              placeholder="Ex.: Ana"
              autocomplete="off"
            />
            <button class="button button-primary button-small" type="submit">Adicionar</button>
          </div>
        </form>

        ${
          state.players.length
            ? `<div class="player-list">${state.players
                .map(
                  (player) => `
                    <div class="player-pill">
                      <div>
                        <strong>${escapeHtml(player.name)}</strong>
                        <span>Participante ativo</span>
                      </div>
                      <button
                        type="button"
                        class="button button-secondary button-small"
                        data-action="remove-player"
                        data-player-id="${player.id}"
                      >
                        Remover
                      </button>
                    </div>
                  `
                )
                .join("")}</div>`
            : `<div class="empty-state">
                <p class="empty-copy">Adicione pelo menos dois nomes para liberar o início da partida.</p>
              </div>`
        }
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">Tema da partida</h2>
          <span class="section-note">${escapeHtml(selectedTheme)}</span>
        </div>
        <div class="theme-grid">
          ${THEMES.map((theme) => renderThemeChip(theme)).join("")}
        </div>
        ${
          state.selectedTheme === CUSTOM_THEME || state.selectedTheme === "Outro tema"
            ? `
              <div class="custom-theme-wrap">
                <input
                  id="custom-theme-input"
                  class="text-input"
                  type="text"
                  name="customTheme"
                  maxlength="40"
                  value="${escapeAttribute(state.customTheme)}"
                  placeholder="Ex.: Animes, Fórmula 1, Cultura pop..."
                />
              </div>
            `
            : ""
        }
      </section>

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">Nível</h2>
          <span class="section-note">${escapeHtml(selectedDifficulty)}</span>
        </div>
        <div class="difficulty-grid">
          ${DIFFICULTIES.map((difficulty) => renderDifficultyChip(difficulty)).join("")}
        </div>
      </section>

      <section class="section-card">
        <div class="rules-box">
          <div class="section-head">
            <h2 class="section-title">Como funciona</h2>
          </div>
          <ol class="rule-list">
            <li class="rule-item">
              <strong>1. O anfitrião lê a pergunta.</strong>
              <span>Cada vez vai para um jogador diferente.</span>
            </li>
            <li class="rule-item">
              <strong>2. Revele a resposta quando quiser.</strong>
              <span>Se o jogador errar, ele sai da partida na hora.</span>
            </li>
            <li class="rule-item">
              <strong>3. O ciclo continua até sobrar um.</strong>
              <span>Quem restar por último vence.</span>
            </li>
          </ol>
        </div>
      </section>

      ${
        state.error
          ? `<section class="section-card inline-error">
              <strong>Atenção</strong>
              <p class="section-copy">${escapeHtml(state.error)}</p>
            </section>`
          : ""
      }

      <div class="footer-actions">
        <button
          type="button"
          class="button button-primary button-large"
          data-action="start-game"
          ${canStart && state.difficulty ? "" : "disabled"}
        >
          Começar jogo
        </button>
        ${
          state.players.length || state.customTheme || state.selectedTheme || state.difficulty
            ? `
              <button
                type="button"
                class="button button-ghost"
                data-action="reset-setup"
              >
                Recomeçar tudo
              </button>
            `
            : ""
        }
      </div>

      ${renderFooterLinks()}
    </section>
  `;
}

function renderGame() {
  const currentPlayer = state.activePlayers[state.currentPlayerIndex];
  const activeQuestionSource = state.currentQuestion?.source === "fallback"
    ? "Pergunta reserva"
    : state.currentQuestion?.source === "cache"
      ? "Pergunta pronta"
      : "Pergunta da vez";

  return `
    <section class="screen">
      <section class="hero-card">
        <div class="eyebrow">Partida em andamento</div>
        <div class="split-head">
          <div>
            <h1 class="hero-title">${escapeHtml(getSelectedTheme() || "Tema livre")}</h1>
            <p class="hero-copy">Nível ${escapeHtml(formatDifficulty(state.difficulty))}. O anfitrião só precisa seguir o fluxo abaixo.</p>
          </div>
        </div>
        <div class="meta-row">
          <span class="meta-pill meta-pill--primary">Rodada ${state.round}</span>
          <span class="meta-pill">${state.activePlayers.length} vivos</span>
          <span class="meta-pill meta-pill--accent">${state.eliminatedPlayers.length} eliminados</span>
        </div>
      </section>

      ${renderRuntimeAlerts()}

      <section class="status-grid">
        <article class="status-card">
          <strong>${state.round}</strong>
          <span>Rodada atual</span>
        </article>
        <article class="status-card">
          <strong>${state.activePlayers.length}</strong>
          <span>Jogadores vivos</span>
        </article>
        <article class="status-card">
          <strong>${state.eliminatedPlayers.length}</strong>
          <span>Já saíram</span>
        </article>
      </section>

      <section class="question-card">
        <div class="question-label">${escapeHtml(activeQuestionSource)}</div>
        <h2 class="question-player">${escapeHtml(currentPlayer?.name || "Jogador")}</h2>
        <p class="question-turn-copy">Quem segura o celular lê em voz alta. Depois marque se a resposta estava certa ou errada.</p>
        ${
          state.loadingQuestion
            ? `
              <div class="skeleton">
                <div class="skeleton-bar is-medium"></div>
                <div class="skeleton-bar is-long"></div>
                <div class="skeleton-bar is-long"></div>
                <div class="skeleton-bar is-short"></div>
              </div>
            `
            : state.currentQuestion
              ? `
                <p class="question-text">${escapeHtml(state.currentQuestion.question)}</p>
                <div class="question-meta">
                  <span class="meta-pill meta-pill--gold">${escapeHtml(formatDifficulty(state.currentQuestion.difficulty))}</span>
                  <span class="meta-pill">${escapeHtml(state.currentQuestion.theme)}</span>
                </div>
                ${
                  state.currentQuestion.hint
                    ? `
                      <div class="button-row">
                        <button
                          type="button"
                          class="button button-warning button-small"
                          data-action="toggle-hint"
                        >
                          ${state.showHint ? "Esconder dica" : "Mostrar dica"}
                        </button>
                      </div>
                      ${
                        state.showHint
                          ? `<div class="hint-box"><p>${escapeHtml(state.currentQuestion.hint)}</p></div>`
                          : ""
                      }
                    `
                    : ""
                }
                ${
                  state.revealAnswer
                    ? `
                      <div class="answer-panel">
                        <strong>Resposta</strong>
                        <p class="answer-copy">${escapeHtml(state.currentQuestion.answer)}</p>
                        <strong style="margin-top: 12px;">Explicação</strong>
                        <p class="answer-copy">${escapeHtml(state.currentQuestion.explanation)}</p>
                      </div>
                    `
                    : `
                      <div class="answer-locked">
                        <p>A resposta fica escondida até você tocar em “Mostrar resposta”.</p>
                      </div>
                    `
                }
              `
              : `
                <div class="empty-state">
                  <p class="empty-copy">Ainda não conseguimos carregar a pergunta desta vez.</p>
                </div>
              `
        }
      </section>

      ${
        state.error
          ? `
            <section class="error-card">
              <strong>Falha ao buscar a pergunta</strong>
              <p class="section-copy">${escapeHtml(formatQuestionError(state.error))}</p>
            </section>
          `
          : ""
      }

      <div class="game-actions">
        ${
          state.loadingQuestion
            ? ""
            : state.currentQuestion && !state.revealAnswer
              ? `
                <button type="button" class="button button-primary button-large" data-action="show-answer">
                  Mostrar resposta
                </button>
                <button type="button" class="button button-secondary" data-action="swap-question">
                  Trocar pergunta
                </button>
              `
              : state.currentQuestion
                ? `
                  <button type="button" class="button button-primary button-large" data-action="mark-correct">
                    Respondeu certo
                  </button>
                  <button type="button" class="button button-danger button-large" data-action="mark-wrong">
                    Errou e sai
                  </button>
                  <button type="button" class="button button-secondary" data-action="swap-question">
                    Gerar outra pergunta
                  </button>
                `
                : `
                  <button type="button" class="button button-primary button-large" data-action="retry-question">
                    Tentar novamente
                  </button>
                `
        }
      </div>

      <section class="order-card">
        <div class="section-head">
          <h2 class="section-title">Ordem da rodada</h2>
          <span class="section-note">${escapeHtml(currentPlayer?.name || "-")}</span>
        </div>
        <div class="order-list">
          ${state.activePlayers
            .map(
              (player, index) => `
                <div class="order-item ${index === state.currentPlayerIndex ? "is-current" : ""}">
                  <div>
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>${index === state.currentPlayerIndex ? "Respondendo agora" : "Na fila"}</span>
                  </div>
                  <span class="turn-chip">${index + 1}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </section>

      <section class="timeline-card">
        <div class="section-head">
          <h2 class="section-title">Histórico</h2>
          <span class="section-note">${state.timeline.length} eventos</span>
        </div>
        ${
          state.timeline.length
            ? `<div class="timeline-list">${state.timeline
                .map(
                  (item) => `
                    <div class="timeline-item">
                      <div class="meta-row" style="margin-top: 0;">
                        <span class="timeline-tag ${
                          item.kind === "danger"
                            ? "timeline-tag--danger"
                            : item.kind === "success"
                              ? "timeline-tag--success"
                              : "meta-pill--gold"
                        }">
                          ${item.kind === "danger" ? "Eliminação" : item.kind === "success" ? "Acerto" : "Vitória"}
                        </span>
                      </div>
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.copy)}</span>
                    </div>
                  `
                )
                .join("")}</div>`
            : `<div class="empty-state"><p class="empty-copy">Os eventos da partida aparecem aqui conforme o jogo avança.</p></div>`
        }
      </section>

      ${renderMatchControls("Ajustes da partida")}
      ${renderFooterLinks()}
    </section>
  `;
}

function renderTurnFeedback() {
  const feedback = state.turnFeedback;
  const toneClass = feedback?.tone === "danger" ? "turn-card--danger" : "turn-card--success";

  return `
    <section class="screen">
      <section class="hero-card">
        <div class="eyebrow">Resultado da rodada</div>
        <h1 class="hero-title">${escapeHtml(feedback?.title || "Próxima rodada")}</h1>
        <p class="hero-copy">${escapeHtml(feedback?.copy || "")}</p>
        <div class="meta-row">
          <span class="meta-pill meta-pill--primary">Rodada ${state.round}</span>
          <span class="meta-pill">${escapeHtml(feedback?.questionTheme || getSelectedTheme() || "Tema livre")}</span>
          <span class="meta-pill meta-pill--accent">${escapeHtml(feedback?.badge || "Atualização")}</span>
        </div>
      </section>

      ${renderRuntimeAlerts()}

      <section class="turn-card ${toneClass}">
        <div class="turn-card__label">Próximo passo</div>
        <h2 class="turn-card__title">${escapeHtml(feedback?.nextPlayerName || "Continuar a partida")}</h2>
        <p class="turn-card__copy">
          ${feedback?.nextPlayerName
            ? `${escapeHtml(feedback.nextPlayerName)} será o próximo a responder.`
            : "A partida continua na próxima jogada."}
        </p>
        <div class="turn-card__answer">
          <strong>Resposta confirmada</strong>
          <p>${escapeHtml(feedback?.explanation || "")}</p>
        </div>
        <div class="meta-row turn-card__stats">
          <span class="meta-pill meta-pill--primary">${state.activePlayers.length} vivos</span>
          <span class="meta-pill meta-pill--accent">${state.eliminatedPlayers.length} eliminados</span>
        </div>
      </section>

      <div class="game-actions">
        <button type="button" class="button button-primary button-large" data-action="continue-next-turn">
          Continuar para o próximo jogador
        </button>
      </div>

      ${renderMatchControls("Se quiser reiniciar")}
      ${renderFooterLinks()}
    </section>
  `;
}

function renderFinished() {
  return `
    <section class="screen winner-grid">
      <section class="winner-card">
        <div class="winner-badge">Campeão</div>
        <h1 class="winner-name">${escapeHtml(state.winner?.name || "Sem vencedor")}</h1>
        <p class="winner-copy">
          A partida terminou após ${state.round} rodada(s). Quem ficou de pé por último levou o jogo.
        </p>
        <div class="winner-meta">
          <span class="meta-pill meta-pill--gold">${escapeHtml(getSelectedTheme() || "Tema livre")}</span>
          <span class="meta-pill">${escapeHtml(formatDifficulty(state.difficulty))}</span>
          <span class="meta-pill meta-pill--accent">${state.eliminatedPlayers.length} eliminações</span>
        </div>
      </section>

      ${renderRuntimeAlerts()}

      <section class="section-card">
        <div class="section-head">
          <h2 class="section-title">Resumo final</h2>
        </div>
        <ul class="summary-list">
          <li class="summary-item">
            <div>
              <strong>Vencedor</strong>
              <span>Último jogador restante</span>
            </div>
            <strong>${escapeHtml(state.winner?.name || "-")}</strong>
          </li>
          <li class="summary-item">
            <div>
              <strong>Rodadas</strong>
              <span>Total jogado</span>
            </div>
            <strong>${state.round}</strong>
          </li>
          <li class="summary-item">
            <div>
              <strong>Eliminados</strong>
              <span>Quem saiu pelo caminho</span>
            </div>
            <strong>${state.eliminatedPlayers.length}</strong>
          </li>
        </ul>
      </section>

      <section class="timeline-card">
        <div class="section-head">
          <h2 class="section-title">Ordem de eliminação</h2>
        </div>
        ${
          state.eliminatedPlayers.length
            ? `<div class="eliminated-list">
                ${state.eliminatedPlayers
                  .map(
                    (player) => `
                      <div class="order-item is-eliminated">
                        <div>
                          <strong>${escapeHtml(player.name)}</strong>
                          <span>Saiu na rodada ${player.round}</span>
                        </div>
                        <span class="turn-chip">Fora</span>
                      </div>
                    `
                  )
                  .join("")}
              </div>`
            : `<div class="empty-state"><p class="empty-copy">Nenhuma eliminação registrada.</p></div>`
        }
      </section>

      <section class="hero-card winner-highlight">
        <div class="eyebrow">Fechamento</div>
        <h2 class="section-title">Partida encerrada</h2>
        <p class="hero-copy">
          Tema ${escapeHtml(getSelectedTheme() || "livre")} em nível ${escapeHtml(formatDifficulty(state.difficulty))}. 
          ${escapeHtml(state.winner?.name || "O vencedor")} foi o último a ficar em pé.
        </p>
      </section>

      <div class="winner-actions">
        <button type="button" class="button button-primary button-large" data-action="play-again">
          Reiniciar com mesmos jogadores
        </button>
        <button type="button" class="button button-secondary" data-action="share-result">
          Compartilhar resultado
        </button>
        <button type="button" class="button button-ghost" data-action="restart-all">
          Reiniciar geral
        </button>
      </div>

      ${renderFooterLinks()}
    </section>
  `;
}

function renderMatchControls(title = "Controles da partida") {
  return `
    <section class="section-card control-card">
      <div class="section-head">
        <h2 class="section-title">${escapeHtml(title)}</h2>
      </div>
      <p class="section-copy">Use estes controles só se quiser zerar a rodada atual ou voltar ao começo.</p>
      <div class="control-actions">
        <button type="button" class="button button-secondary" data-action="restart-match">
          Reiniciar com mesmos jogadores
        </button>
        <button type="button" class="button button-ghost" data-action="restart-all">
          Reiniciar geral
        </button>
      </div>
    </section>
  `;
}

function renderRuntimeAlerts() {
  const parts = [];

  if (!state.isOnline) {
    parts.push(`
      <section class="runtime-banner runtime-banner--warning">
        <strong>Você está sem internet</strong>
        <p>O jogo continua aberto, mas novas perguntas e eventos só voltam a funcionar quando a conexão retornar.</p>
      </section>
    `);
  }

  if (state.flashMessage?.text) {
    parts.push(`
      <section class="runtime-banner runtime-banner--${escapeAttribute(state.flashMessage.tone || "success")}">
        <div class="runtime-banner__content">
          <strong>${escapeHtml(state.flashMessage.tone === "success" ? "Tudo certo" : "Aviso")}</strong>
          <p>${escapeHtml(state.flashMessage.text)}</p>
        </div>
        <button type="button" class="runtime-banner__close" data-action="dismiss-flash" aria-label="Fechar aviso">
          Fechar
        </button>
      </section>
    `);
  }

  return parts.join("");
}

function renderFooterLinks() {
  return `
    <footer class="screen-footer">
      <a class="footer-link" href="/">Início</a>
      <a class="footer-link" href="/privacy.html">Privacidade</a>
      <a class="footer-link" href="/support.html">Suporte</a>
    </footer>
  `;
}

function renderShareIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 3l4 4m-4-4L8 7m4-4v11m-6 1v4h12v-4"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
      />
    </svg>
  `;
}

function renderThemeChip(theme) {
  const selected = state.selectedTheme === theme;

  return `
    <button
      type="button"
      class="select-chip ${selected ? "is-selected" : ""}"
      data-action="select-theme"
      data-theme="${escapeAttribute(theme)}"
    >
      <strong>${escapeHtml(theme)}</strong>
    </button>
  `;
}

function renderDifficultyChip(difficulty) {
  const selected = state.difficulty === difficulty.id;

  return `
    <button
      type="button"
      class="select-chip ${selected ? "is-selected" : ""}"
      data-action="select-difficulty"
      data-difficulty="${difficulty.id}"
    >
      <strong>${escapeHtml(difficulty.label)}</strong>
    </button>
  `;
}

function formatDifficulty(value) {
  if (value === "facil") {
    return "Fácil";
  }

  if (value === "dificil") {
    return "Difícil";
  }

  return "Médio";
}

function loadState() {
  const fallback = {
    activePlayers: [],
    currentPlayerIndex: 0,
    currentQuestion: null,
    customTheme: "",
    difficulty: EMPTY_SELECTION,
    eliminatedPlayers: [],
    error: "",
    flashMessage: null,
    isOnline: window.navigator.onLine !== false,
    loadingQuestion: false,
    processingTurn: false,
    players: [],
    recentQuestions: [],
    revealAnswer: false,
    round: 1,
    selectedTheme: EMPTY_SELECTION,
    showHint: false,
    status: "setup",
    turnFeedback: null,
    timeline: [],
    winner: null,
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const { localAiConfig: _legacyLocalAiConfig, ...storedState } = parsed;
    if (storedState.selectedTheme === "Outro tema") {
      storedState.selectedTheme = CUSTOM_THEME;
    }

    return {
      ...fallback,
      ...storedState,
      activePlayers: [],
      currentPlayerIndex: 0,
      currentQuestion: null,
      eliminatedPlayers: [],
      error: "",
      flashMessage: null,
      isOnline: window.navigator.onLine !== false,
      loadingQuestion: false,
      processingTurn: false,
      recentQuestions: [],
      revealAnswer: false,
      round: 1,
      showHint: false,
      status: "setup",
      turnFeedback: null,
      timeline: [],
      winner: null,
    };
  } catch {
    return fallback;
  }
}

function persistState() {
  const snapshot = {
    ...state,
    error: "",
    flashMessage: null,
    isOnline: window.navigator.onLine !== false,
    loadingQuestion: false,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function formatQuestionError(message) {
  const normalizedMessage = String(message || "").trim();

  if (!normalizedMessage) {
    return "Houve um problema ao buscar a próxima pergunta.";
  }

  if (/load failed|failed to fetch|networkerror|network request failed/i.test(normalizedMessage)) {
    return "Não conseguimos falar com o servidor agora. Recarregue a página e tente novamente.";
  }

  if (/missing_api_key|invalid_api_key|quota|billing|rate_limit|timeout|fallback/i.test(normalizedMessage)) {
    return "A próxima rodada usou o modo de segurança para não travar a partida. Você ainda pode continuar jogando normalmente.";
  }

  return normalizedMessage;
}

async function requestJson(url, options = {}, retries = 1) {
  try {
    const response = await fetch(url, options);
    const payload = await response.json();
    return { payload, response };
  } catch (error) {
    if (retries > 0 && isRecoverableNetworkError(error)) {
      await wait(250);
      return requestJson(url, options, retries - 1);
    }

    throw error;
  }
}

function isRecoverableNetworkError(error) {
  const message = String(error instanceof Error ? error.message : error || "");
  return /load failed|failed to fetch|networkerror|network request failed/i.test(message);
}

function wait(delayMs) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

async function shareApp() {
  const themeLabel = getSelectedTheme() || "qualquer tema";
  const text = `Experimente o Último Sobrevivente. Escolha o tema, gire as rodadas e veja quem sobra até o fim. Tema atual: ${themeLabel}. ${APP_PUBLIC_URL}`;
  await shareText({
    text,
    title: "Último Sobrevivente",
    trackName: "compartilhamento_app",
  });
}

async function shareResult() {
  const winnerName = state.winner?.name || "Um campeão";
  const text = `${winnerName} venceu no Último Sobrevivente após ${state.round} rodada(s) em ${getSelectedTheme() || "tema livre"} no nível ${formatDifficulty(state.difficulty)}. Teste aqui: ${APP_PUBLIC_URL}`;
  await shareText({
    text,
    title: "Resultado do Último Sobrevivente",
    trackName: "compartilhamento_resultado",
  });
}

async function shareText({ text, title, trackName }) {
  try {
    await copyTextSilently(text);

    if (navigator.share) {
      await navigator.share({
        text,
        title,
        url: APP_PUBLIC_URL,
      });
    } else {
      state.flashMessage = {
        tone: "warning",
        text: "O texto foi copiado, mas este navegador não consegue abrir o menu de compartilhamento do telefone. Em HTTPS ou no app instalado isso funciona melhor.",
      };
      sync();
    }

    triggerHaptic(35);
    void trackProductEvent(trackName, {
      session_id: APP_SESSION_ID,
      theme: getSelectedTheme() || "Tema livre",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }

    state.flashMessage = {
      tone: "warning",
      text: "Não conseguimos abrir o compartilhamento agora.",
    };
    sync();
  }
}

async function copyTextSilently(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Cai para o fallback abaixo.
    }
  }

  copyWithSelectionFallback(text);
}

function copyWithSelectionFallback(text) {
  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("readonly", "true");
  helper.style.position = "absolute";
  helper.style.left = "-9999px";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  document.body.removeChild(helper);
}

function triggerHaptic(pattern) {
  if (typeof navigator.vibrate !== "function") {
    return;
  }

  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignora dispositivos sem suporte real a vibração.
  }
}

function getPublicShareUrl() {
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = String(canonicalLink?.getAttribute("href") || "").trim();

  if (canonicalUrl) {
    return canonicalUrl;
  }

  return "https://quiz-ashy-five.vercel.app/";
}

function trackProductEvent(name, properties = {}) {
  const payload = JSON.stringify({
    name,
    properties,
  });

  try {
    void fetch(buildApiUrl("/api/events"), {
      body: payload,
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "POST",
    });
  } catch {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(buildApiUrl("/api/events"), new Blob([payload], { type: "application/json" }));
    }
  }
}
