# 4shared source adapter

The live function is named `fourshared-proxy` and is deployed to the Banca Digital Supabase project. The browser adapter calls `/functions/v1/fourshared-proxy?url=...` and `/functions/v1/fourshared-proxy?url=...&meta=1`.

Only publicly accessible HTTPS 4shared files are supported. The proxy checks file signatures, returns CORS headers and byte ranges, and never uses user credentials. Pages requiring login, a download wait, CAPTCHA, or another inaccessible download must fail clearly. No specific 4shared share URL has been verified as accessible in a live end-to-end test.

The `feature/4shared-reader` branch includes the integration script and a workflow that applies its guarded changes to the large existing reader. Do not replace the entire app.js with an older copy. Keep the branch unmerged until the live example and existing sources have been tested.
