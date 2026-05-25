# Roadmap para App Store e Google Play

## Onde o projeto está hoje

- O jogo já funciona bem como web app mobile-first.
- Já existem página de privacidade e página de suporte.
- O app depende de backend para gerar perguntas com IA e para telemetria.

## Decisão técnica recomendada

Empacotar o frontend em um shell nativo e manter o backend na web.

Sugestão:

- `Capacitor` para iOS e Android
- frontend embarcado no app
- API remota apontando para a versão publicada na Vercel

Esse caminho evita depender de `localhost` e reduz o risco de rejeição por parecer só um site aberto no navegador.

## Mudanças técnicas já iniciadas

- `public/runtime-config.js`: base de API configurável
- `public/app.js`: chamadas de API centralizadas via `buildApiUrl`
- `public/ops.js`: painel operacional compatível com API remota
- `lib/http-api.mjs`: CORS e respostas JSON padronizadas
- `api/*.js` e `server.mjs`: preparados para chamadas vindas de `capacitor://localhost`, `ionic://localhost` e `localhost`
- `android/`: shell nativo inicial já gerado com Capacitor

### Bloqueio atual de iOS nesta máquina

- o shell de iOS ainda não foi criado aqui porque o Capacitor depende de CocoaPods
- o Ruby disponível nesta máquina é antigo demais para concluir a instalação do CocoaPods sem uma atualização do ambiente

## O que ainda falta antes de gerar builds

1. Integrar Capacitor no projeto.
2. Criar ícones, splash screen e nome final do app para as lojas.
3. Definir a URL de produção da API no build nativo.
4. Testar o fluxo completo em iPhone e Android reais.
5. Adicionar pelo menos alguns toques mais nativos, como:
   - vibração/haptics em acerto e eliminação
   - compartilhamento nativo
   - tratamento de offline/sem conexão

## Apple App Store

Checklist operacional:

- conta Apple Developer ativa
- app compilado no Xcode
- app submetido pelo App Store Connect
- política de privacidade publicada
- formulário de privacidade preenchido
- screenshots e ícone final

Risco principal:

- a Apple pode rejeitar apps com funcionalidade mínima ou com cara de site empacotado. O app precisa se comportar como produto mobile de verdade.

## Google Play

Checklist operacional:

- conta Google Play Console ativa
- app empacotado em Android App Bundle (`.aab`)
- ficha do app preenchida
- Data safety preenchido
- content rating preenchido
- screenshots, ícone e feature graphic

Risco principal:

- o Google também pode barrar apps com funcionalidade limitada ou que pareçam só um webview simples.

## Contas e taxas

- Apple Developer Program: taxa anual
- Google Play Console: taxa única de cadastro

## Próximo passo sugerido

1. Instalar Capacitor no projeto.
2. Gerar os shells `ios` e `android`.
3. Apontar o app nativo para a API publicada em produção.
4. Fazer os primeiros testes internos via TestFlight e Closed Testing.
