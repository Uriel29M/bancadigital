(() => {
  'use strict';

  const loadApp = () => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'js/app.js?v=2.2.10.503-volume-edition-number';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Não foi possível carregar o app.js.'));
    document.body.appendChild(script);
  });

  Promise.resolve(window.BancaCbrFixReady)
    .catch(error => console.warn('[CBR] Correção não ficou pronta antes do app.', error))
    .then(loadApp)
    .catch(error => console.error(error));
})();
