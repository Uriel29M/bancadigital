# Testes E2E

A suíte usa Playwright e roda a aplicação localmente em `http://127.0.0.1:4173`.

## Comandos

- `npm test`: unitários selecionados + regressão de PDF/CBZ/CBR + Playwright core.
- `npm run test:e2e`: testes Playwright que não dependem de fontes externas.
- `npm run test:e2e:external`: Telegram, MediaFire, Google Drive, 4shared e formatos reais do catálogo.
- `npm run test:e2e:auth`: apenas os testes autenticados.

## Conta de teste

Os testes autenticados são ignorados quando as variáveis abaixo não existem:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `E2E_CHAT_USERNAME` (opcional; habilita envio real no chat)

No GitHub, configure essas variáveis como Actions Secrets. Use uma conta comum dedicada, nunca uma conta administrativa.

Os testes de perfil e progresso restauram o estado original ao final. O teste de chat só envia mensagem quando `E2E_CHAT_USERNAME` estiver configurado.

## Fontes externas

Os testes marcados com `@external` ficam fora do job obrigatório porque serviços de terceiros podem oscilar. Eles podem ser executados manualmente pelo workflow **Testes automáticos**, marcando `run_external`.

A regressão do núcleo do leitor não depende dessas fontes: `scripts/test-reader-loading-browser.mjs` exercita PDF, CBZ e CBR nos modos de página única, página dupla e rolagem contínua.
