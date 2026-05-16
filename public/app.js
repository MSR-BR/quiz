const THEMES = [
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
  "Outro tema",
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

const state = loadState();
const app = document.querySelector("#app");

app.addEventListener("click", onClick);
app.addEventListener("submit", onSubmit);
app.addEventListener("change", onChange);

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
    state.selectedTheme = target.dataset.theme || "Outro tema";
    state.error = "";
    sync();
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
  state.timeline = [];
  state.winner = null;
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
  state.winner = null;
  state.error = "";
  state.recentQuestions = [];
  sync();

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
  state.timeline = [];
  state.winner = null;
  sync();
}

async function fetchQuestion() {
  const currentPlayer = state.activePlayers[state.currentPlayerIndex];
  if (!currentPlayer) {
    return;
  }

  state.loadingQuestion = true;
  state.error = "";
  state.revealAnswer = false;
  state.showHint = false;
  sync();

  try {
    const response = await fetch("/api/questions", {
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

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Não foi possível gerar a pergunta.");
    }

    state.currentQuestion = payload;
    state.recentQuestions = [...state.recentQuestions.slice(-9), payload.question];
  } catch (error) {
    state.currentQuestion = null;
    state.error = error instanceof Error ? error.message : "Falha inesperada.";
  } finally {
    state.loadingQuestion = false;
    sync();
  }
}

async function finishTurn(eliminatePlayer) {
  const currentPlayer = state.activePlayers[state.currentPlayerIndex];
  if (!currentPlayer || !state.currentQuestion) {
    return;
  }

  const roundLabel = `Rodada ${state.round}`;
  const questionTheme = state.currentQuestion.theme || getSelectedTheme();

  if (eliminatePlayer) {
    state.timeline.unshift({
      id: createId(),
      kind: "danger",
      title: `${roundLabel}: ${currentPlayer.name} foi eliminado`,
      copy: `Tema ${questionTheme}. A resposta correta era: ${state.currentQuestion.answer}.`,
    });

    const [removedPlayer] = state.activePlayers.splice(state.currentPlayerIndex, 1);
    state.eliminatedPlayers.unshift({
      ...removedPlayer,
      round: state.round,
    });
  } else {
    state.timeline.unshift({
      id: createId(),
      kind: "success",
      title: `${roundLabel}: ${currentPlayer.name} acertou`,
      copy: `Tema ${questionTheme}. Seguimos para a próxima pergunta.`,
    });

    state.currentPlayerIndex += 1;
  }

  if (state.activePlayers.length === 1) {
    state.winner = state.activePlayers[0];
    state.status = "finished";
    state.currentQuestion = null;
    state.revealAnswer = false;
    state.showHint = false;

    state.timeline.unshift({
      id: createId(),
      kind: "winner",
      title: `${state.winner.name} venceu a partida`,
      copy: `Sobrou apenas um jogador depois de ${state.round} rodada(s).`,
    });

    sync();
    return;
  }

  if (state.currentPlayerIndex >= state.activePlayers.length) {
    state.currentPlayerIndex = 0;
    state.round += 1;
  }

  state.currentQuestion = null;
  state.revealAnswer = false;
  state.showHint = false;
  sync();

  await fetchQuestion();
}

function getSelectedTheme() {
  if (state.selectedTheme === "Outro tema") {
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
        <div class="eyebrow">Jogo de perguntas</div>
        <h1 class="hero-title">Último<br />Sobrevivente</h1>
        <p class="hero-copy">
          Um jogador segura o celular, lê a pergunta em voz alta e elimina quem errar.
          A rodada gira até restar só um.
        </p>
      </section>

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
          state.selectedTheme === "Outro tema"
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
    </section>
  `;
}

function renderGame() {
  const currentPlayer = state.activePlayers[state.currentPlayerIndex];

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
        <div class="question-label">Pergunta da vez</div>
        <h2 class="question-player">${escapeHtml(currentPlayer?.name || "Jogador")}</h2>
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
              <p class="section-copy">${escapeHtml(state.error)}</p>
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
                    Acertou e continua
                  </button>
                  <button type="button" class="button button-danger button-large" data-action="mark-wrong">
                    Errou e sai do jogo
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
        <button type="button" class="button button-secondary" data-action="restart-match">
          Reiniciar com mesmos jogadores
        </button>
        <button type="button" class="button button-ghost" data-action="restart-all">
          Reiniciar geral
        </button>
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

      <div class="winner-actions">
        <button type="button" class="button button-primary button-large" data-action="play-again">
          Reiniciar com mesmos jogadores
        </button>
        <button type="button" class="button button-ghost" data-action="restart-all">
          Reiniciar geral
        </button>
      </div>
    </section>
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
    loadingQuestion: false,
    players: [],
    recentQuestions: [],
    revealAnswer: false,
    round: 1,
    selectedTheme: EMPTY_SELECTION,
    showHint: false,
    status: "setup",
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

    return {
      ...fallback,
      ...storedState,
      activePlayers: [],
      currentPlayerIndex: 0,
      currentQuestion: null,
      eliminatedPlayers: [],
      error: "",
      loadingQuestion: false,
      recentQuestions: [],
      revealAnswer: false,
      round: 1,
      showHint: false,
      status: "setup",
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
