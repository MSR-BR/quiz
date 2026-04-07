# Quiz de Eliminação com IA

Projeto pronto para subir no GitHub e publicar na Vercel, sem precisar rodar localmente.

## O que este app faz

- Cadastro de jogadores
- Escolha de tema e subtema
- Geração online de perguntas interessantes com IA
- 4 alternativas por pergunta
- Revelação da resposta correta
- Eliminação manual dos jogadores que erraram
- Definição automática do vencedor
- Salvamento do estado no navegador

## Publicação sem instalar nada no computador

### 1. Suba a pasta para um repositório no GitHub
Pode ser arrastando os arquivos pela interface web do GitHub.

### 2. Publique na Vercel
- Entre na Vercel
- Clique em **Add New Project**
- Importe o repositório do GitHub
- Em **Environment Variables**, crie:
  - `OPENAI_API_KEY` = sua chave da OpenAI
- Clique em **Deploy**

Pronto. O app ficará online com frontend + backend serverless.

## Estrutura

- `public/` → site
- `api/generate-question.js` → função serverless que chama a OpenAI
- `vercel.json` → configuração da publicação

## Observação importante

GitHub Pages sozinho não é suficiente para este caso, porque ele hospeda apenas arquivos estáticos. Como a chave da OpenAI precisa ficar protegida no servidor, a publicação recomendada aqui é **GitHub + Vercel**.
