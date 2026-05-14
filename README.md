# Ultimo Sobrevivente

App web mobile-first para um jogo de perguntas com eliminacao por rodada. Um anfitriao segura o celular, le as perguntas e marca quem acertou ou saiu.

## Como rodar

Use Node 18+.

1. Crie um arquivo `.env` na raiz do projeto baseado em `.env.example`
2. Preencha sua chave da IA
3. Rode o servidor

```bash
node server.mjs
```

Depois abra:

```text
http://localhost:3000
```

Exemplo de `.env` com Gemini Free Tier:

```env
AI_PROVIDER=auto
GEMINI_API_KEY=sua_chave_gemini_aqui
GEMINI_MODEL=gemini-3.1-flash-lite
```

Exemplo de `.env` com OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sua_chave_openai_aqui
OPENAI_MODEL=gpt-5.4-mini
```

## Abrir com dois cliques no macOS

Voce tambem pode dar dois cliques em `abrir-app.command`.
Ele sobe o servidor e abre o navegador automaticamente.

## Abrir no celular

O servidor agora sobe em `0.0.0.0` por padrao.
Quando iniciar, o terminal mostra uma URL da rede local, como:

```text
http://192.168.0.15:3000
```

Abra essa URL no celular, desde que ele esteja na mesma rede Wi-Fi do computador.

## Variaveis opcionais

- `PORT`: porta do servidor. Padrao `3000`
- `HOST`: host do servidor. Padrao `0.0.0.0`
- `AI_PROVIDER`: `auto`, `gemini` ou `openai`
- `GEMINI_API_KEY`: chave da Gemini API
- `GEMINI_MODEL`: modelo Gemini. Padrao `gemini-3.1-flash-lite`
- `OPENAI_MODEL`: modelo usado para gerar perguntas. Padrao `gpt-5.4-mini`
- `OPENAI_BASE_URL`: endpoint base da API, caso voce use um gateway compativel

## O que a primeira versao entrega

- cadastro de varios jogadores
- escolha de tema a partir de uma lista grande ou por tema customizado
- niveis facil, medio e dificil
- rotacao automatica das rodadas
- eliminacao imediata quando alguem erra
- vencedor final quando sobra um jogador
- geracao de perguntas por API de IA no backend, sem expor a chave no navegador
- suporte a Gemini e OpenAI no mesmo backend

## Observacao importante

Se `OPENAI_API_KEY` nao estiver definida, a interface abre normalmente, mas a geracao das perguntas retorna erro ate a chave ser configurada.
