const state = {
  players: [],
  currentQuestion: null,
  previousQuestions: []
};

const els = {
  category: document.getElementById('category'),
  subtopic: document.getElementById('subtopic'),
  difficulty: document.getElementById('difficulty'),
  playerName: document.getElementById('playerName'),
  addPlayerBtn: document.getElementById('addPlayerBtn'),
  playersList: document.getElementById('playersList'),
  generateBtn: document.getElementById('generateBtn'),
  status: document.getElementById('status'),
  questionBox: document.getElementById('questionBox'),
  questionText: document.getElementById('questionText'),
  options: document.getElementById('options'),
  revealBtn: document.getElementById('revealBtn'),
  nextBtn: document.getElementById('nextBtn'),
  answerBox: document.getElementById('answerBox'),
  survivors: document.getElementById('survivors'),
  eliminateBtn: document.getElementById('eliminateBtn'),
  winnerBox: document.getElementById('winnerBox'),
  newGameBtn: document.getElementById('newGameBtn')
};

function saveState() {
  localStorage.setItem('triviaEliminationState', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('triviaEliminationState');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    state.players = parsed.players || [];
    state.currentQuestion = parsed.currentQuestion || null;
    state.previousQuestions = parsed.previousQuestions || [];
  } catch {}
}

function renderPlayers() {
  els.playersList.innerHTML = '';
  state.players.forEach((player) => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    chip.innerHTML = `<span>${player.name}${player.alive ? '' : ' (eliminado)'}</span>`;
    const remove = document.createElement('button');
    remove.textContent = '✕';
    remove.onclick = () => {
      state.players = state.players.filter(p => p.id !== player.id);
      renderAll();
    };
    chip.appendChild(remove);
    els.playersList.appendChild(chip);
  });
}

function renderSurvivors() {
  const alive = state.players.filter(p => p.alive);
  els.survivors.innerHTML = '';

  alive.forEach(player => {
    const item = document.createElement('label');
    item.className = 'survivor-item';
    item.innerHTML = `<input type="checkbox" data-id="${player.id}" /> <span>${player.name}</span>`;
    els.survivors.appendChild(item);
  });

  if (alive.length === 1) {
    els.winnerBox.classList.remove('hidden');
    els.winnerBox.textContent = `🏆 Vencedor: ${alive[0].name}`;
    els.generateBtn.disabled = true;
    els.eliminateBtn.disabled = true;
  } else {
    els.winnerBox.classList.add('hidden');
    els.generateBtn.disabled = alive.length === 0;
    els.eliminateBtn.disabled = alive.length === 0;
  }
}

function renderQuestion() {
  if (!state.currentQuestion) {
    els.questionBox.classList.add('hidden');
    return;
  }

  els.questionBox.classList.remove('hidden');
  els.questionText.textContent = state.currentQuestion.question;
  els.options.innerHTML = '';

  state.currentQuestion.options.forEach((option, index) => {
    const div = document.createElement('div');
    div.className = 'option';
    div.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
    els.options.appendChild(div);
  });

  els.answerBox.classList.add('hidden');
  els.answerBox.textContent = '';
  els.nextBtn.classList.add('hidden');
}

function renderAll() {
  renderPlayers();
  renderSurvivors();
  renderQuestion();
  saveState();
}

els.addPlayerBtn.onclick = () => {
  const name = els.playerName.value.trim();
  if (!name) return;
  state.players.push({ id: crypto.randomUUID(), name, alive: true });
  els.playerName.value = '';
  renderAll();
};

els.playerName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.addPlayerBtn.click();
});

els.generateBtn.onclick = async () => {
  const alive = state.players.filter(p => p.alive);
  if (alive.length < 2) {
    els.status.textContent = 'É preciso pelo menos 2 jogadores vivos para continuar.';
    return;
  }

  els.generateBtn.disabled = true;
  els.status.textContent = 'Gerando pergunta com IA...';

  try {
    const response = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: els.category.value,
        subtopic: els.subtopic.value.trim(),
        difficulty: els.difficulty.value,
        previousQuestions: state.previousQuestions
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao gerar pergunta.');

    state.currentQuestion = data;
    state.previousQuestions.push(data.question);
    els.status.textContent = 'Pergunta pronta. Leia em voz alta para o grupo.';
    renderQuestion();
    saveState();
  } catch (error) {
    els.status.textContent = `Erro: ${error.message}`;
  } finally {
    els.generateBtn.disabled = false;
  }
};

els.revealBtn.onclick = () => {
  if (!state.currentQuestion) return;
  const idx = state.currentQuestion.correctIndex;
  const letter = String.fromCharCode(65 + idx);
  const text = state.currentQuestion.options[idx];
  els.answerBox.innerHTML = `<strong>Resposta correta:</strong> ${letter}. ${text}<br><br><strong>Explicação:</strong> ${state.currentQuestion.explanation}`;
  els.answerBox.classList.remove('hidden');
  els.nextBtn.classList.remove('hidden');
};

els.nextBtn.onclick = () => {
  state.currentQuestion = null;
  renderAll();
  els.status.textContent = 'Marque quem errou e elimine antes de gerar a próxima pergunta.';
};

els.eliminateBtn.onclick = () => {
  const checked = [...document.querySelectorAll('#survivors input[type="checkbox"]:checked')].map(cb => cb.dataset.id);
  state.players = state.players.map(player => checked.includes(player.id) ? { ...player, alive: false } : player);
  renderAll();
};

els.newGameBtn.onclick = () => {
  if (!confirm('Deseja reiniciar todo o jogo?')) return;
  state.players = [];
  state.currentQuestion = null;
  state.previousQuestions = [];
  renderAll();
  els.status.textContent = 'Novo jogo iniciado.';
};

loadState();
renderAll();
