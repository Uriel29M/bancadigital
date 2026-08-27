/*
 * Ponto de entrada dos dados do catálogo.
 * Os catálogos ficam separados por editora e selo em js/data/.
 * Ordem de carregamento: este arquivo -> catálogos -> app.js.
 */
window.CATALOG_DATA_SOURCES = {
  publishers: [
    { id: "dc-comics", name: "DC Comics", imprints: ["recentes", "black-label"] }
  ]
};
