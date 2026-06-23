# `_scripts/` — postprints build

The **Postprints** section of the site (the `postprints/` tree, the Postprints page cards, the
"featured" block on Publications, and the inline postprint links in the bibliography) is **generated**
from a single source of truth. You never edit the generated files by hand.

## Files

| File | Role |
|---|---|
| `postprints_data.py` | **Single source of truth** — one entry per postprint (`dir, slug, key, title, authors, journal, year, doi`). |
| `build_postprints.py` | Build script: deploys the rendered bundles + thumbnails, then regenerates all derived files. |

## What gets generated (do **not** edit by hand)

- `postprints/<slug>/` — the deployed postprint (`index.html`, `<slug>.pdf`, `thumb.png`, `figures/`,
  `<slug>_files/`, `cc-by-nc-nd.png`). Only the **rendered** outputs are copied — never the sources.
- `_includes/_postprints_cards.qmd` — card grid, included by `postprints.qmd`.
- `_includes/_postprints_featured.qmd` — "Open-access postprints" block, included by `publications.qmd`.
- `_extensions/postprint-links/postprint_map.lua` — bib-key → slug map read by the Lua filter
  `postprint-links.lua`, which injects the inline "📄 Postprint" links into matching bibliography entries.

## Add or update a postprint (the whole workflow)

1. (Re)render the article's Quarto project so that `~/articles/<dir>/Webpublish/web/` is current.
2. Add or edit **one entry** in [`postprints_data.py`](postprints_data.py).
   The bib `key` must match the entry in `_biblio/1_acl.bib` (that's how the inline link is attached).
3. `make postprints`   (runs `build_postprints.py`; needs the PyMuPDF interpreter — see the `Makefile`).
4. `quarto preview` to check, then commit & push (push to `main` triggers the GitHub Pages deploy).

## Notes

- URLs are `https://jfbarthelemy.github.io/postprints/<slug>/`. If you change a slug, the QR codes in
  the companion talk (`~/articles/Postprints_ClaudeCode/_data/qrcodes.py`) must be regenerated too.
- `postprints/` is declared under `project: resources:` in `_quarto.yml` so Quarto copies the standalone
  bundles verbatim (it does not crawl their internal assets otherwise).
