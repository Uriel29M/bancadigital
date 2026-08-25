# Catálogos por editora e selo

Cada selo possui um arquivo JavaScript próprio, carregado depois de `js/data.js` e antes de `js/app.js`.

Estrutura:

```text
data/
└── dc-comics/
    └── recentes.js
```

Para adicionar uma editora ou selo:

1. Crie `js/data/<editora>/<selo>.js`.
2. Faça o arquivo preencher `window.DEFAULT_SERIES`, `window.DEFAULT_LIBRARY` e `window.DEFAULT_COLLECTIONS` (ou usar `.push()` para complementar o catálogo já carregado).
3. Encapsule helpers e constantes em uma IIFE para evitar conflitos entre selos.
4. Adicione o `<script>` do arquivo em `index.html`, depois de `js/data.js` e antes de `js/app.js`.
5. Configure `GITHUB_CATALOG_PATH` para o arquivo do selo que será publicado pelo painel administrativo.

Os arquivos são scripts globais para manter compatibilidade com o hosting estático atual; não é necessário bundler.
