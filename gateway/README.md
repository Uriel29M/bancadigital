# Banca Media Gateway

Transporta PDF/CBZ/CBR fora do Supabase.

O Supabase valida a edição/fonte, cifra um ticket AES-GCM de 15 minutos e responde com HTTP 307. O arquivo pesado é transmitido por este serviço.

## Telegram > 20 MB
O Telegram usa MTProto por `@mtcute`, não o endpoint hospedado `getFile` da Bot API. Portanto, o limite de 20 MB da Bot API não se aplica ao transporte do gateway.

## Railway
O `Dockerfile` da raiz já executa este gateway. Configure somente:
- `BANCA_MEDIA_GATEWAY_KEY` — chave base64url de 32 bytes.

As credenciais do Telegram permanecem no Supabase e viajam apenas dentro do ticket cifrado de curta duração.
