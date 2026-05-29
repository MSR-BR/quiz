# Android e publicacao

Este projeto usa Capacitor para empacotar a mesma interface web em um app Android.

## Estrategia

- A landing page publica fica em `/`.
- O jogo web fica em `/jogar`.
- O app Android abre o pacote local do frontend e usa a API publica configurada em `meta[name="app-api-base"]`.
- O backend continua hospedado na Vercel.

## Requisitos no computador

1. Node.js 20 ou superior.
2. Java JDK 21. O Android Studio ja inclui um JDK 21 em `Android Studio.app/Contents/jbr/Contents/Home`.
   O Java Runtime 8 nao basta, porque o build Android precisa de `javac`.
3. Android Studio com Android SDK instalado.
4. Variavel `JAVA_HOME` apontando para o JDK.
5. `android/local.properties` apontando para o SDK, normalmente:

```properties
sdk.dir=/Users/seu-usuario/Library/Android/sdk
```

Confirme o Java antes do build:

```bash
java -version
javac -version
/usr/libexec/java_home -V
```

O esperado e aparecer JDK 21, nao apenas Java 8 Runtime.

## Gerar APK de teste

```bash
npm install
npm run cap:sync
npm run android:build:debug
```

O APK de teste fica em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Use esse arquivo apenas para teste interno.

## Preparar assinatura de producao

Crie uma chave uma unica vez e guarde a senha em local seguro:

```bash
keytool -genkeypair -v \
  -keystore android/ultimo-sobrevivente-release.jks \
  -alias ultimo-sobrevivente \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Depois crie `android/keystore.properties`:

```properties
storeFile=ultimo-sobrevivente-release.jks
storePassword=SUA_SENHA_DO_KEYSTORE
keyAlias=ultimo-sobrevivente
keyPassword=SUA_SENHA_DA_CHAVE
```

Nao envie `.jks` nem `keystore.properties` ao GitHub.

## Gerar arquivo para Google Play

```bash
npm run cap:sync
npm run android:build:release
```

O arquivo para envio ao Google Play fica em:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Publicar no Google Play Console

1. Crie uma conta no Google Play Console.
2. Crie um app novo com o nome `Ultimo Sobrevivente`.
3. Preencha categoria, descricao curta, descricao completa, email de suporte e politica de privacidade.
4. Envie icone, screenshots de telefone e arte de destaque.
5. Em `Teste interno`, crie uma versao e envie o `app-release.aab`.
6. Adicione testadores e valide instalacao, perguntas, suporte e privacidade.
7. Preencha seguranca de dados e classificacao indicativa.
8. Promova a versao para teste fechado, teste aberto ou producao.

## Atualizacoes futuras

Antes de cada nova publicacao:

1. Atualize `versionCode` e `versionName` em `android/app/build.gradle`.
2. Rode `npm run cap:sync`.
3. Gere novo AAB com `npm run android:build:release`.
4. Envie o novo AAB no Play Console.
