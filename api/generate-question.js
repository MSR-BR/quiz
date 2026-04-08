export default async function handler(req, res) {
  const prompt = `
Crie uma pergunta inteligente (nível médio/alto) sobre um tema geral.

Formato JSON:
{
 "question": "...",
 "options": ["A","B","C","D"],
 "correct": índice (0-3),
 "explanation": "explique em 2-3 frases"
}

Evite perguntas triviais.
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

  let text = data.output[0].content[0].text;

  try {
    const json = JSON.parse(text);
    res.status(200).json(json);
  } catch {
    res.status(500).json({ error: "Erro ao gerar pergunta" });
  }
}
