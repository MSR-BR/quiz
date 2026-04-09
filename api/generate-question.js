export default async function handler(req, res) {
  return res.status(200).json({
    question: "Qual medida teve maior impacto coletivo na saúde pública no século XX?",
    options: [
      "Uso indiscriminado de antibióticos",
      "Vacinação em massa",
      "Aumento do consumo de vitaminas",
      "Repouso obrigatório semanal"
    ],
    correct: 1,
    explanation:
      "A vacinação em massa reduziu drasticamente a circulação de várias doenças infecciosas. Além de proteger o indivíduo, ela ajuda a proteger a comunidade como um todo."
  });
}
