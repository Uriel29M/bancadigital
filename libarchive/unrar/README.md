# Local UnRAR runtime

Vendored from `node-unrar-js@2.0.2` (MIT), which embeds UnRAR 6.1.7
(see UNRAR-LICENSE.txt). Upstream: https://github.com/YuJianrong/node-unrar.js

`unrar.wasm` is copied unchanged from `esm/js/unrar.wasm`.
`unrar.mjs` is built from `esm/index.esm.js` using esbuild 0.28.2:

```sh
npm install --prefix /tmp/banca-rar-tools node-unrar-js@2.0.2 esbuild@0.28.2
/tmp/banca-rar-tools/node_modules/.bin/esbuild /tmp/banca-rar-tools/node_modules/node-unrar-js/esm/index.esm.js --bundle --format=esm --platform=browser --minify --outfile=libarchive/unrar/unrar.mjs
```

The app routes RAR4 solid archives to this runtime in a dedicated worker.
Other archive types retain libarchive's lazy extraction. Solid archives are
extracted sequentially and validated before exposing pages; extracted image
Blobs remain in memory for the reading session. The worker terminates after
extraction or when the reader closes. All runtime assets are local and included
in the service worker shell for offline reading.

Regression (original comic is intentionally not committed):

```sh
CBR_FIXTURE=/path/to/Arlequina.cbr node scripts/test-solid-rar-browser.mjs
```

Requires Playwright (or `PLAYWRIGHT_MODULE` pointing to its module). Verified
with the 34,945,915-byte MediaFire file `9yasaucn97twwcw`: libarchive lists one
image, UnRAR extracts 22 images, and Chromium decodes all 22. A truncated copy
is rejected. The Banca reader adds its end page for a total of 23.
