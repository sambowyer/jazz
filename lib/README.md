# Vendored libraries

Downloaded once and committed so the app works offline and copies cleanly into
the Jekyll site. To update, re-run the curl commands and bump the version in
the comment at the top of `index.html`.

| File | Version | Source |
|---|---|---|
| `tonal.min.js` | 6.4.3 | https://cdn.jsdelivr.net/npm/tonal@6.4.3/browser/tonal.min.js |
| `vexflow.js` | 4.2.5 | https://cdn.jsdelivr.net/npm/vexflow@4.2.5/build/cjs/vexflow.js |

```bash
curl -sL -o lib/tonal.min.js https://cdn.jsdelivr.net/npm/tonal@6.4.3/browser/tonal.min.js
curl -sL -o lib/vexflow.js  https://cdn.jsdelivr.net/npm/vexflow@4.2.5/build/cjs/vexflow.js
```
