# Banca Digital — site de quadrinhos e mangás

Este projeto é uma banca digital leve: o catálogo, capas e metadados ficam no site, mas os arquivos de leitura podem continuar hospedados fora dele.

## O que já existe

- Página inicial com:
  - uma edição em destaque;
  - "Mais lidos", baseado nos cliques;
  - seleção aleatória;
  - trilhos separados de Quadrinhos e Mangás;
  - Coleções/coletâneas.
- Pesquisa por título, edição, autor, descrição e tags.
- Leitor:
  - PDF;
  - CBZ;
  - imagens JPG/JPEG/PNG/WebP/GIF;
  - fallback para outros formatos.
- Administração:
  - cadastrar/editar/excluir edições;
  - capa;
  - link da fonte do arquivo (URL direta);
  - formato;
  - tipo Quadrinho/Mangá;
  - peso da seleção aleatória;
  - destaque;
  - exportação/importação do catálogo em JSON.
- Formulário para leitores enviarem quadrinhos.
- O projeto não exige upload dos arquivos de quadrinhos para o servidor, funcionando com URLs diretas.

## CORS

PDF.js e JSZip fazem requisições do navegador. O servidor que entrega o PDF/CBZ precisa permitir CORS para o domínio da banca.

Se o servidor não permitir CORS:
- PDF: o navegador ainda pode abrir o arquivo em outra aba;
- CBZ: o leitor JS não consegue baixar o ZIP para extrair as páginas.

## Proxy MediaFire

O leitor encaminha URLs HTTPS do MediaFire para a Edge Function `mediafire-proxy` do Supabase. A função permite apenas hosts MediaFire, segue os redirecionamentos do download e devolve o arquivo com CORS. Arquivos locais e URLs de outros provedores continuam seguindo o fluxo original.

Prefira cadastrar a URL permanente da página do MediaFire, no formato `https://www.mediafire.com/file/...`. URLs diretas de download MediaFire também são aceitas, embora possam expirar.

Para publicar a função, configure o projeto Supabase e execute:

supabase functions deploy mediafire-proxy --no-verify-jwt

O limite atual do proxy é de 512 MB. O leitor ainda carrega o arquivo inteiro na memória do navegador e não armazena os quadrinhos no Storage do Supabase.

## Proxy Google Drive

Links compartilhados do Google Drive são convertidos em URLs de download e encaminhados pela Edge Function `drive-proxy`, permitindo que o PDF.js abra o arquivo dentro do leitor sem bloqueio de CORS.

Para publicar a função:

supabase functions deploy drive-proxy --no-verify-jwt

## Gateway Telegram

Postagens públicas do Telegram não fornecem uma URL de download ao navegador. Para ler um arquivo do canal, cadastre na edição a URL da postagem em `telegramUrl` e o `telegramFileId` recebido pelo bot ao publicar o documento. O leitor prioriza essa fonte e chama a Edge Function `telegram-mtproto`, que usa MTProto para devolver o arquivo em faixas com CORS, sem o limite de 20 MB da Bot API hospedada.

Crie um bot, adicione-o como administrador do canal e configure o token exclusivamente nos secrets do Supabase:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=SEU_TOKEN
supabase secrets set TELEGRAM_API_ID=SEU_API_ID TELEGRAM_API_HASH=SEU_API_HASH
supabase functions deploy telegram-mtproto --no-verify-jwt
```

O `file_id` não pode ser deduzido de `https://t.me/canal/mensagem`: ele deve vir de uma atualização recebida pelo bot (campo `message.document.file_id` ou `channel_post.document.file_id`). Configure também `SUPABASE_URL` e `SUPABASE_ANON_KEY` nos secrets da função. As credenciais da API do Telegram devem ser obtidas em `my.telegram.org/apps` e nunca colocadas no navegador ou no repositório.

## Rodar

Por ser JavaScript no navegador, é melhor abrir com um servidor local em vez de `file://`.

Exemplo com Python:

python -m http.server 8000

Depois abra:

http://localhost:8000

## Antes de publicar

O painel administrativo publica alterações de edições e coleções no arquivo do selo ativo (`js/data/dc-comics/recentes.js` por padrão) do GitHub através da Edge Function `github-catalog`. O arquivo `js/data.js` funciona como registro das fontes; novos selos devem ser adicionados como novos scripts em `index.html`. O token do GitHub fica somente nos secrets do Supabase.

Crie um fine-grained token no GitHub com acesso `Contents: Read and write` somente neste repositório e configure:

```text
supabase secrets set GITHUB_TOKEN=SEU_TOKEN GITHUB_REPOSITORY=Uriel29M/banca-digital-quadrinhos-v3 GITHUB_BRANCH=main GITHUB_CATALOG_PATH=js/data/dc-comics/recentes.js
supabase functions deploy github-catalog --no-verify-jwt
```

Não coloque o token em `js/supabase.js` nem no código do navegador. O usuário precisa estar autenticado com um perfil cujo plano seja `admin`.

### Xerifes dos chats

Depois de atualizar o código, execute novamente `supabase/schema.sql` no projeto Supabase. O recurso fica limitado a Chat Geral, Decenautas, Marvetes e Leitores e Colecionadores; chats de facção, Staff e conversas privadas não possuem xerife. As funções protegidas permitem ao xerife fixar, desfixar e excluir mensagens somente na sala em que ele foi designado.

O formulário público de envio continua sendo uma fila local de análise; ele não publica automaticamente conteúdo enviado por leitores.

### Bot de capas variantes

O `cover-variants-bot` examina as edições enviadas pelo painel administrativo, consulta as fontes configuradas e verifica por HTTP se cada URL responde como imagem. As candidatas entram em `bot_actions` como pendentes; somente a aprovação da equipe no Monitoramento cadastra a variante em `comic_cover_variants`.

Configure as fontes autorizadas como JSON nos secrets do Supabase. A URL pode usar `{item_id}`, `{series}`, `{issue}` e `{publisher}`:

Sem esse secret, a função usa automaticamente a página correspondente do DCU Guide como fonte padrão. Se `COVER_VARIANT_SOURCES` for definido como uma lista vazia, o fallback padrão também será usado.

```text
supabase secrets set COVER_VARIANT_SOURCES='[{"name":"Fonte autorizada","url":"https://fonte.exemplo/busca?serie={series}&edicao={issue}"}]'
supabase functions deploy cover-variants-bot
```

Essa função faz a autenticação do administrador dentro do próprio código; por isso ela usa `verify_jwt = false` para que o preflight CORS do navegador seja aceito.

Não configure fontes sem permissão para consulta. Depois da execução, confira a miniatura e o link da imagem no Monitoramento antes de aprovar.

O catálogo publicado recebe uma nova versão e invalida o catálogo antigo salvo no `localStorage` quando os usuários recarregam o site.

Para a versão online, substitua o DataStore por uma API com banco de dados. Uma estrutura simples seria:

- `works`: obras/edições
- `collections`: coletâneas
- `submissions`: envios dos leitores

## Verificação diária de links

A Edge Function `link-checker-bot` combina o catálogo publicado com as edições atualizadas em `catalog_edition_overrides`. Quando todas as fontes estão comprovadamente indisponíveis, oculta a edição em `catalog_item_visibility`, usando a mesma aparência vermelha e restrição aos administradores da ocultação manual. O carrossel do Bucho continua visível para todos, como antes. Essa ação não cria relato.

Se o principal falhar e houver um alternativo funcional, o bot troca os links, mantém o antigo nos alternativos e cria um relato em `file_reports`. A troca e o relato são gravados na mesma transação. Timeouts, limites de acesso e respostas inconclusivas não causam ocultação.

Administradores podem ativar ou desativar o verificador em **Administração > Verificador de links**. Desativar bloqueia novas alterações, inclusive de lotes em andamento; não desoculta edições anteriores.

A migração `link_checker_admin_visibility` configura o agendamento no Supabase. O ciclo diário começa às 03:17 UTC (00:17 de Brasília), em lotes de até 20 edições. O cursor e a trava de execução ficam no esquema privado, e o segredo de autenticação é gerado no banco. O workflow antigo do GitHub está desativado e não é mais necessário configurar secrets nele.

Para publicar o código da função:

```bash
supabase functions deploy link-checker-bot --no-verify-jwt
```

Defina `CATALOG_FILES` se houver outros catálogos, separados por vírgula. O bot `series-link-monitor`, que procurava novas edições nas fontes, está desativado; as descobertas anteriores continuam disponíveis para consulta.
