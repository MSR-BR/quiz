import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4';

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

function buildPrompt({ theme, subtheme, difficulty, previousQuestions = [] }) {
  const blocked = previousQuestions.length
    ? `Evite repetir ideias já usadas nestas perguntas anteriores: ${previousQuestions.join(' | ')}`
    : 'Ainda não houve perguntas anteriores.';

  return `
Você é um criador de perguntas de quiz para um jogo presencial de eliminação.

Crie EXATAMENTE 1 pergunta de múltipla escolha, em português do Brasil, sobre o tema "${theme}" e o subtema "${subtheme}".
Nível de dificuldade: ${difficulty}.

Regras obrigatórias:
1. A pergunta precisa ser interessante, específica e não trivial.
2. Evite fatos óbvios e perguntas infantis.
3. A pergunta deve funcionar bem em grupo, em voz alta.
4. Gere 4 alternativas plausíveis.
5. Apenas 1 alternativa deve ser correta.
6. Inclua uma explicação curta da resposta correta.
7. Não use pegadinhas mal formuladas.
8. ${blocked}
9. Responda APENAS em JSON válido, sem markdown, sem comentários.

Formato obrigatório do JSON:
{
  "question": "texto da pergunta",
  "options": [
    { "id": "A", "text": "alternativa A" },
    { "id": "B", "text": "alternativa B" },
    { "id": "C", "text": "alternativa C" },
    { "id": "D", "text": "alternativa D" }
  ],
  "correctOptionId": "A",
  "explanation": "explicação curta"
}
`.trim();
}

function sanitizeQuestion(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida da IA.');
  }

  const { question, options, correctOptionId, explanation } = payload;

  if (typeof question !== 'string' || !Array.isArray(options) || options.length !== 4) {
    throw new Error('Estrutura de pergunta inválida.');
  }

  const validIds = ['A', 'B', 'C', 'D'];
  const seenIds = new Set();
  const cleanedOptions = options.map((opt) => {
    if (!opt || typeof opt !== 'object') throw new Error('Alternativa inválida.');
    const id = String(opt.id || '').trim().toUpperCase();
    const text = String(opt.text || '').trim();
    if (!validIds.includes(id) || !text) throw new Error('Alternativa malformada.');
    if (seenIds.has(id)) throw new Error('Alternativa duplicada.');
    seenIds.add(id);
    return { id, text };
  });

  if (!validIds.includes(String(correctOptionId).trim().toUpperCase())) {
    throw new Error('Resposta correta inválida.');
  }

  return {
    question: question.trim(),
    options: cleanedOptions,
    correctOptionId: String(correctOptionId).trim().toUpperCase(),
    explanation: String(explanation || '').trim()
  };
}

app.post('/api/question', async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'A variável OPENAI_API_KEY não foi configurada no servidor.'
      });
    }

    const { theme, subtheme, difficulty, previousQuestions } = req.body || {};

    if (!theme || !subtheme) {
      return res.status(400).json({ error: 'Informe o tema e o subtema.' });
    }

    const prompt = buildPrompt({
      theme,
      subtheme,
      difficulty: difficulty || 'médio',
      previousQuestions: Array.isArray(previousQuestions) ? previousQuestions : []
    });

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: prompt,
        max_output_tokens: 700
      })
    });

    const data = await openAiResponse.json();

    if (!openAiResponse.ok) {
      return res.status(openAiResponse.status).json({
        error: data?.error?.message || 'Falha ao gerar pergunta com a IA.',
        details: data
      });
    }

    const text = data?.output_text?.trim();
    if (!text) {
      return res.status(502).json({ error: 'A IA não retornou texto utilizável.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return res.status(502).json({
        error: 'A IA retornou um formato inesperado.',
        raw: text
      });
    }

    const question = sanitizeQuestion(parsed);
    return res.json(question);
  } catch (error) {
    return res.status(500).json({
      error: 'Erro interno ao gerar a pergunta.',
      details: error.message
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
