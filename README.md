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
