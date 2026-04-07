# Jogo de Perguntas Eliminatórias

Aplicativo web simples para um jogo em grupo:

- uma pessoa fica com o celular
- o grupo escolhe um tema e um subtema
- a IA gera uma pergunta interessante com 4 alternativas
- o coordenador revela a resposta correta
- quem errar sai do jogo
- vence o último jogador restante

## Estrutura

- `server.js`: backend Express que chama a API da OpenAI
- `public/index.html`: interface do jogo
- `public/style.css`: estilo visual
- `public/app.js`: lógica do frontend
- `.env.example`: exemplo das variáveis de ambiente

## Como usar

1. Instale o Node.js.
2. Abra a pasta do projeto no terminal.
3. Instale as dependências:

```bash
npm install
```

4. Crie o arquivo `.env` com base no `.env.example`.
5. Coloque sua chave da OpenAI em `OPENAI_API_KEY`.
6. Rode o servidor:

```bash
npm start
```

7. Abra no navegador:

```text
http://localhost:3000
```

## Observações

- o estado do jogo fica salvo no `localStorage`
- a chave da OpenAI deve ficar apenas no backend
- você pode depois evoluir isso para ranking, cronômetro, categorias prontas, voz e placar
