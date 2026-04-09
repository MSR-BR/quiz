export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  return res.status(200).json({
    question: "Qual destas medidas tem maior impacto coletivo na prevenção de doenças infecciosas?",
    options: [
      "Tomar antibiótico preventivamente sem orientação",
      "Vacinação em larga escala",
      "Consumir suplementos diariamente",
      "Evitar completamente contato social por anos"
    ],
    correct: 1,
    explanation: "A vacinação em larga escala reduz a circulação de agentes infecciosos e protege também pessoas mais vulneráveis. Esse efeito coletivo é um dos pilares da saúde pública moderna."
  });
}
