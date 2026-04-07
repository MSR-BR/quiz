const state = {
  players: [],
  currentQuestion: null,
  round: 1,
  previousQuestions: []
};

const themeInput = document.getElementById('theme');
const subthemeInput = document.getElementById('subtheme');
const difficultySelect = document.getElementById('difficulty');
const generateQuestionBtn = document.getElementById('generateQuestionBtn');
const statusEl = document.getElementById('status');
const playerNameInput = document.getElementById('playerName');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const playersListEl = document.getElementById('playersList');
const playerSelectEl = document.getElementById('playerSelect');
const questionContainer = document.getElementById('questionContainer');
const questionTextEl = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const revealAnswerBtn = document.getElementById('revealAnswerBtn');
const answerRevealEl = document.getElementById('answerReveal');
const emptyStateEl = document.getElementById('emptyState');
const markCorrectBtn = document.getElementById('markCorrectBtn');
const markWrongBtn = document.getElementById('markWrongBtn');
const winnerBoxEl = document.getElementById('winnerBox');
const roundBadgeEl = document.getElementById('roundBadge');

function saveState() {
  localStorage.setItem('triviaEliminationState', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('triviaEliminationState');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.players = Array.isArray(parsed.players) ? parsed.players : [];
    state.currentQuestion = parsed.currentQuestion || null;
    state.round = Number.isInteger(parsed.round) ? parsed.round : 1;
    state.previousQuestions = Array.isArray(parsed.previousQuestions) ? parsed.previousQuestions : [];
  } catch {
    console.warn('Não foi possível restaurar o estado anterior.');
  }
}

function renderPlayers() {
  playersListEl.innerHTML = '';

  state.players.forEach((player) => {
    const chip = document.createElement('div');
    chip.className = `player-chip ${player.active ? '' : 'eliminated'}`;
    chip.innerHTML = `
      <span>${player.name}</span>
      <button class="remove-btn" data-id="${player.id}" title="Remover">✕</button>
    `;
    playersListEl.appendChild(chip);
  });

  document.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      state.players = state.players.filter((p) => p.id !== id);
      checkWinner();
      renderPlayers();
      renderPlayerSelect();
      saveState();
    });
  });
}

function renderPlayerSelect() {
  const activePlayers = state.players.filter((p) => p.active);
  playerSelectEl.innerHTML = '';

  if (!activePlayers.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Sem jogadores ativos';
    playerSelectEl.appendChild(option);
    return;
  }

  activePlayers.forEach((player) => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = player.name;
    playerSelectEl.appendChild(option);
  });
}

function renderQuestion() {
  roundBadgeEl.textContent = `Rodada ${state.round}`;

  if (!state.currentQuestion) {
    questionContainer.classList.add('hidden');
    emptyStateEl.classList.remove('hidden');
    return;
  }

  questionContainer.classList.remove('hidden');
  emptyStateEl.classList.add('hidden');
  questionTextEl.textContent = state.currentQuestion.question;
  optionsContainer.innerHTML = '';
  answerRevealEl.classList.add('hidden');
  answerRevealEl.innerHTML = '';

  state.currentQuestion.options.forEach((option) => {
    const div = document.createElement('div');
    div.className = 'option';
    div.dataset.id = option.id;
    div.innerHTML = `<strong>${option.id}.</strong> ${option.text}`;
    optionsContainer.appendChild(div);
  });
}

function revealAnswer() {
  if (!state.currentQuestion) return;
  const correctId = state.currentQuestion.correctOptionId;
  document.querySelectorAll('.option').forEach((el) => {
    if (el.dataset.id === correctId) {
      el.classList.add('correct');
    }
  });

  const correctOption = state.currentQuestion.options.find((o) => o.id === correctId);
  answerRevealEl.innerHTML = `
    <strong>Resposta correta: ${correctId}</strong><br>
    ${correctOption ? correctOption.text : ''}<br><br>
    <strong>Explicação:</strong> ${state.currentQuestion.explanation || 'Sem explicação.'}
  `;
  answerRevealEl.classList.remove('hidden');
}

function addPlayer() {
  const name = playerNameInput.value.trim();
  if (!name) return;

  state.players.push({
    id: crypto.randomUUID(),
    name,
    active: true
  });

  playerNameInput.value = '';
  renderPlayers();
  renderPlayerSelect();
  saveState();
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#fca5a5' : '#94a3b8';
}

async function generateQuestion() {
  const theme = themeInput.value.trim();
  const subtheme = subthemeInput.value.trim();
  const difficulty = difficultySelect.value;

  if (!theme || !subtheme) {
    setStatus('Preencha o tema e o subtema.', true);
    return;
  }

  generateQuestionBtn.disabled = true;
  setStatus('Gerando pergunta...');

  try {
    const response = await fetch('/api/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme,
        subtheme,
        difficulty,
        previousQuestions: state.previousQuestions.slice(-8)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Falha ao gerar pergunta.');
    }

    state.currentQuestion = data;
    state.previousQuestions.push(data.question);
    renderQuestion();
    saveState();
    setStatus('Pergunta gerada com sucesso.');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    generateQuestionBtn.disabled = false;
  }
}

function markPlayer(correct) {
  const playerId = playerSelectEl.value;
  if (!playerId) return;

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;

  if (!correct) {
    player.active = false;
  }

  renderPlayers();
  renderPlayerSelect();
  saveState();
  checkWinner();
}

function checkWinner() {
  const activePlayers = state.players.filter((p) => p.active);

  if (activePlayers.length === 1 && state.players.length > 1) {
    winnerBoxEl.textContent = `🏆 Vencedor: ${activePlayers[0].name}`;
    winnerBoxEl.classList.remove('hidden');
  } else if (activePlayers.length === 0 && state.players.length > 0) {
    winnerBoxEl.textContent = 'Todos foram eliminados. Reinicie os jogadores para uma nova partida.';
    winnerBoxEl.classList.remove('hidden');
  } else {
    winnerBoxEl.classList.add('hidden');
  }
}

function nextRoundIfPossible() {
  const activePlayers = state.players.filter((p) => p.active);
  if (activePlayers.length > 1) {
    state.round += 1;
    roundBadgeEl.textContent = `Rodada ${state.round}`;
    saveState();
  }
}

addPlayerBtn.addEventListener('click', addPlayer);
playerNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') addPlayer();
});
generateQuestionBtn.addEventListener('click', generateQuestion);
revealAnswerBtn.addEventListener('click', revealAnswer);
markCorrectBtn.addEventListener('click', () => markPlayer(true));
markWrongBtn.addEventListener('click', () => {
  markPlayer(false);
  nextRoundIfPossible();
});

loadState();
renderPlayers();
renderPlayerSelect();
renderQuestion();
checkWinner();
