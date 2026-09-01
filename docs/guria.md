# Guria — Guia da Banca

Guria é um perfil normal (`@guria`) marcado no banco como `is_bot`, `is_official` e `bot_type=assistant`. O selo `IA oficial` aparece no perfil e nas mensagens. O banco cria, de forma idempotente, o follow e uma única mensagem de boas-vindas quando um novo perfil é criado. Respostas são processadas pela Edge Function `guria-chat`; o modelo só produz texto e nunca executa ações no sistema.

## Provisionamento

Faça login na CLI e aplique a migration:

```powershell
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
npx supabase functions deploy provision-guria
```

`provision-guria` exige `GURIA_PROVISION_SECRET` no header `X-Guria-Provision-Secret`, usa o secret administrativo automático do Supabase somente dentro da Edge Function, é idempotente e não cria senha utilizável no frontend. Não tente cadastrar um secret personalizado com prefixo `SUPABASE_`: o Supabase fornece `SUPABASE_SECRET_KEYS` automaticamente. Após o deploy, invoque-a pelo Dashboard ou por um backend protegido; a CLI 2.115 deste projeto não possui subcomando `functions invoke`. Nunca copie uma chave administrativa para `index.html`, `js/` ou variáveis `NEXT_PUBLIC_`.

## Provedores gratuitos

Configure os segredos no Dashboard ou com `npx supabase secrets set`. `cloudflare` chama Workers AI e `ollama` usa um gateway remoto protegido; `disabled` usa o fallback e mantém chat/social funcionando. A Edge Function hospedada não acessa `localhost`. Não exponha a porta 11434: coloque o Ollama atrás de HTTPS, autenticação e um gateway que valide `X-Gateway-Secret`.

Variáveis: `GURIA_AI_PROVIDER`, `GURIA_AI_MODEL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_TOKEN`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_GATEWAY_SECRET`, `GURIA_DAILY_GLOBAL_LIMIT`, `GURIA_DAILY_USER_LIMIT` e `GURIA_AUTH_EMAIL`. O código limita contexto, tamanho da resposta e timeout; configure limites de quota no gateway/Cloudflare e mantenha o modo `disabled` quando não quiser chamadas externas.

## Conhecimento e moderação

`guria_knowledge` é uma base textual com título, resumo, metadados, fonte e URL. Administradores podem inserir registros pelo SQL Editor/importador JSON/CSV; `is_demo=true` identifica exemplos. A busca inicial usa full-text `tsvector` gratuito; pgvector fica deliberadamente para uma evolução quando houver pipeline de embeddings local consistente.

Mensagens destinadas à Guria podem ser analisadas automaticamente para segurança. Eventos ficam em `guria_moderation_events` e apenas administradores podem revisá-los. Não há banimento automático: risco médio gera limite textual, reincidência pode ser revisada, e decisões permanentes continuam sendo administrativas.

## Proatividade e testes

Mensagens proativas devem ser textos fixos e no máximo duas nos primeiros sete dias. Para ativá-las, crie um job agendado que consulte contas ativas, respeite bloqueio/silenciamento, resposta recente e `guria_proactive_enabled`, e insira com uma chave idempotente. Para desligar globalmente, mantenha o provedor `disabled` e desative o job; para um usuário, altere `guria_proactive_enabled` no fluxo de preferências.

Teste localmente sem dados reais com `npx supabase start`, `npx supabase db reset` e `npx supabase test db`. Use `npx supabase functions serve guria-chat --env-file .env.local`. Instale o Ollama manualmente apenas se quiser: depois de instalar o aplicativo, baixe um modelo local; ele não é instalado pelo projeto.
