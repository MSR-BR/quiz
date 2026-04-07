export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on Vercel.' });
  }

  try {
    const { category, subtopic, difficulty, previousQuestions = [] } = req.body || {};

    const prompt = `You are creating trivia questions for an in-person elimination party game in Brazilian Portuguese.

Return exactly one multiple-choice question as strict JSON with this structure:
{
  "question": "...",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "..."
}

Rules:
- Topic category: ${category || 'Tema livre'}
- Specific subtopic: ${subtopic || 'Sem subtema informado'}
- Difficulty: ${difficulty || 'medium'}
- Language: Brazilian Portuguese
- Create an interesting, non-obvious, intellectually engaging question.
- Avoid trivial facts or overly basic schoolbook questions.
- Avoid ambiguous alternatives.
- Exactly 4 answer options.
- Only one correct option.
- Keep the explanation concise.
- Do not repeat or closely paraphrase any of these previous questions: ${JSON.stringify(previousQuestions).slice(0, 1500)}
- Output JSON only, no markdown.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'trivia_question',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                question: { type: 'string' },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 4,
                  maxItems: 4
                },
                correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
                explanation: { type: 'string' }
              },
              required: ['question', 'options', 'correctIndex', 'explanation']
            }
          }
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const content = data.output_text;
    const parsed = JSON.parse(content);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown error generating question.' });
  }
}
