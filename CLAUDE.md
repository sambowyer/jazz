# jazz — jazz guitar practice app

Static single-page app, no build step. See PLAN.md for the full design.

- Run: `python3 -m http.server 8000` (launch config "jazz"), open http://localhost:8000
- Libraries are vendored in `lib/` (Tonal 6.4.3, VexFlow 4.2.5). Don't add a bundler.
  Download URLs are in `lib/README.md`.
- All paths relative (app is served from `/` on the separate repo's Pages site and from `/jazz/` on sambowyer.com).
- `js/catalogue.js`, `js/theory.js`, `js/session.js` must stay DOM-free; tests in `tests/test.html`.
- Deploy to the personal site with `./deploy-to-site.sh` (see PLAN.md §10).
- Theme palette borrowed from `sambowyer.github.io/_sass/_theme.scss`; dark is the default here.
