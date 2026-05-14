#!/bin/zsh

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node nao encontrado. Instale Node 18+ e tente novamente."
  read -r "?Pressione Enter para sair..."
  exit 1
fi

if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "O app ja esta rodando na porta 3000. Abrindo no navegador..."
  open "http://localhost:3000"
  exit 0
fi

echo "Subindo o app..."
echo ""
echo "Se voce quiser usar perguntas por IA, rode depois com OPENAI_API_KEY configurada."
echo ""

node server.mjs &
SERVER_PID=$!

sleep 2
open "http://localhost:3000"

wait "$SERVER_PID"
