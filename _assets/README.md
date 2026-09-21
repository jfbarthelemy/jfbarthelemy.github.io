# Master assets

Sources kept under version control but **not deployed**: Quarto ignores any directory whose
name starts with `_`, so nothing here is copied into `_site/`.

- `originals/id_jfb_cartoon.png` — 1024×1024 master of the portrait. `images/portrait.png`,
  `images/apple-touch-icon.png` and `images/favicon.ico` are derived from it.
- `originals/jfb.jpg` — photograph, currently unused on the site.
- `originals/LogoCerema_horizontal.jpg` — master of `images/logo-cerema.jpg`.
- `originals/UMR MCD-couleur-300dpi.png` — master of `images/logo-umr-mcd.png`
  (the `.jpg` has no transparency; the `.pdf` is the only vector version).

Regenerate the derived files with the commands recorded in `_scripts/README.md`.
