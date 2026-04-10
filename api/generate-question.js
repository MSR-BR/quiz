export default function handler(req, res) {
  return res.status(200).json({
    question: "Teste funcionando?",
    options: ["Sim", "Não", "Talvez", "Nunca"],
    correct: 0,
    explanation: "Se você está vendo isso, a API está OK."
  });
}
