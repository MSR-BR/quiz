export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { tema } = req.body || {};

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY não configurada" });
    }

    const prompt = `
Gere 1 pergunta de múltipla escolha, em português do Brasil, sobre o tema "${tema || "conhecimento geral"}".

Regras:
- A pergunta deve ser interessante e não trivial.
- Forneça exatamente 4 alternativas.
- Apenas 1 alternativa correta.
- Inclua uma explicação curta de 2 a 3 frases.
- Retorne SOMENTE JSON válido, sem markdown, sem bloco de código.

Formato exato:
{
  "question": "texto da pergunta",
  "options": ["opção A", "opção B", "opção C", "opção D"],
  "correct": 0,
  "explanation": "explicação curta"
}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: "Erro da OpenAI",
        details: data
      });
    }

    const text =
      data.output?.[0]?.content?.[0]?.text ||
      data.output_text ||
      "";

    if (!text) {
      return res.status(500).json({
        error: "Resposta vazia da OpenAI",
        details: data
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "Não foi possível interpretar o JSON retornado",
        raw: text
      });
    }

    if (
      !parsed.question ||
      !Array.isArray(parsed.options) ||
      parsed.options.length !== 4 ||
      typeof parsed.correct !== "number" ||
      !parsed.explanation
    ) {
      return res.status(500).json({
        error: "Formato inválido retornado pela IA",
        parsed
      });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({
      error: "Erro interno",
      message: err.message
    });
  }
}
