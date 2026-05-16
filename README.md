# Ultimo Sobrevivente

App web mobile-first para um jogo de perguntas com eliminacao por rodada. O fluxo certo de producao e:

- GitHub guarda o codigo
- Vercel hospeda o app
- a chave da IA fica so nas variaveis do servidor
- o usuario final abre apenas a URL publica

## Estrutura do projeto

- `public/`: interface web
- `api/`: rotas serverless para Vercel
- `lib/quiz-ai.mjs`: integracao compartilhada com Gemini/OpenAI
- `server.mjs`: servidor local para desenvolvimento

## Como rodar localmente

Use Node 18+.

1. Crie um arquivo `.env` na raiz com base em `.env.example`
2. Preencha a chave
3. Rode:

```bash
node server.mjs
```

Abra:

```text
http://localhost:3000
```

Exemplo com Gemini:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-3.1-flash-lite
```

Exemplo com OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sua_chave_openai_aqui
OPENAI_MODEL=gpt-5.4-mini
```

## O que vai para o GitHub

Suba o projeto inteiro, exceto `.env`.

Arquivos importantes para o repo:

- `index.html`
- `public/`
- `api/`
- `lib/`
- `server.mjs`
- `.env.example`
- `package.json`
- `README.md`

O `.env` real nao deve subir.

## O que configurar na Vercel

Ao importar o repo na Vercel:

1. Selecione o repositório do GitHub
2. Mantenha a raiz do projeto como Root Directory
3. Em `Environment Variables`, adicione:

```text
AI_PROVIDER = gemini
GEMINI_API_KEY = sua_chave_gemini_aqui
GEMINI_MODEL = gemini-3.1-flash-lite
```

Se preferir OpenAI:

```text
AI_PROVIDER = openai
OPENAI_API_KEY = sua_chave_openai_aqui
OPENAI_MODEL = gpt-5.4-mini
```

Depois clique em `Deploy`.

## Analytics da Vercel

O projeto ja inclui a leitura basica do Vercel Web Analytics no HTML publicado.

Para ativar no painel:

1. Abra o projeto na Vercel
2. Entre em `Analytics`
3. Clique em `Enable`
4. Faça um novo deploy ou `Redeploy`

Em plano Hobby, o principal retorno sera visitantes e page views.

## Fluxo recomendado de publicacao

1. Faça `git add .`
2. Faça seu commit
3. Dê `git push`
4. A Vercel publica
5. Se trocar a chave, altere só na Vercel, sem mexer no frontend

## Variaveis opcionais

- `AI_PROVIDER`: `auto`, `gemini` ou `openai`
- `GEMINI_API_KEY`: chave da Gemini API
- `GEMINI_MODEL`: modelo Gemini. Padrao `gemini-3.1-flash-lite`
- `OPENAI_API_KEY`: chave da OpenAI API
- `OPENAI_MODEL`: modelo OpenAI. Padrao `gpt-5.4-mini`
- `OPENAI_BASE_URL`: endpoint base compativel com OpenAI
- `GEMINI_BASE_URL`: endpoint base compativel com Gemini
- `PORT`: porta local. Padrao `3000`
- `HOST`: host local. Padrao `0.0.0.0`

## Abrir com dois cliques no macOS

Voce tambem pode dar dois cliques em `abrir-app.command`.

## Abrir no celular durante testes locais

O servidor local sobe em `0.0.0.0` por padrao. Quando iniciar, o terminal mostra uma URL da rede local para abrir no celular, desde que ele esteja na mesma rede Wi-Fi.
